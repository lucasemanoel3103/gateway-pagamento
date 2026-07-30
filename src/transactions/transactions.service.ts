import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { isValidLuhn } from '../domain/luhn';
import { shouldSimulateFailure } from '../domain/fraud-rules';
import {
  TransactionStatus,
  assertValidTransition,
  InvalidTransitionError,
} from '../domain/transaction-status';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTransactionDto) {
    if (!isValidLuhn(dto.cardNumber)) {
      throw new BadRequestException('Número de cartão inválido');
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: dto.merchantId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant não encontrado');
    }

    const existing = await this.prisma.transaction.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });

    if (existing) {
      return existing;
    }

    const cardLast4 = dto.cardNumber.slice(-4);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.transaction.create({
          data: {
            merchantId: dto.merchantId,
            amount: dto.amount,
            currency: dto.currency,
            cardLast4,
            cardBrand: dto.cardBrand,
            idempotencyKey: dto.idempotencyKey,
            status: 'pending',
          },
        });

        await tx.event.create({
          data: {
            transactionId: created.id,
            type: 'transaction.created',
            payload: created satisfies Prisma.InputJsonValue,
          },
        });

        return created;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const race = await this.prisma.transaction.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
        });

        if (race) {
          return race;
        }
      }

      throw error;
    }
  }

  async authorize(transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException('Transação não encontrada');
    }

    const willFail = shouldSimulateFailure(
      transaction.amount,
      transaction.cardLast4,
    );
    const nextStatus = willFail
      ? TransactionStatus.FAILED
      : TransactionStatus.AUTHORIZED;

    try {
      assertValidTransition(
        transaction.status as TransactionStatus,
        nextStatus,
      );
    } catch (error) {
      if (error instanceof InvalidTransitionError) {
        throw new UnprocessableEntityException(error.message);
      }
      throw error;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: willFail
          ? {
              status: TransactionStatus.FAILED,
              failureReason: 'Recusado pela simulação de antifraude',
            }
          : {
              status: TransactionStatus.AUTHORIZED,
              authorizedAt: new Date(),
            },
      });

      await tx.event.create({
        data: {
          transactionId: updated.id,
          type: willFail ? 'transaction.failed' : 'transaction.authorized',
          payload: updated satisfies Prisma.InputJsonValue,
        },
      });

      return updated;
    });
  }
}
