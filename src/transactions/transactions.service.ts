import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTransactionDto) {
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
}
