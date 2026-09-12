/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TransactionStatus } from '../domain/transaction-status';

describe('TransactionsService', () => {
  let service: TransactionsService;

  const mockMerchant = {
    id: 'merchant-1',
    name: 'Test Merchant',
  };

  const mockTransaction = {
    id: 'tx-1',
    merchantId: 'merchant-1',
    amount: 10000,
    currency: 'BRL',
    cardLast4: '1234',
    cardBrand: 'VISA',
    idempotencyKey: 'idempotency-1',
    status: TransactionStatus.PENDING,
    refundedAmount: 0,
    authorizedAt: null,
    capturedAt: null,
    failureReason: null,
  };

  const createMockTransactionClient = () => ({
    transaction: {
      create: jest.fn().mockResolvedValue(mockTransaction),
      update: jest.fn().mockResolvedValue(mockTransaction),
    },
    refund: {
      create: jest.fn(),
    },
    event: {
      create: jest.fn(),
    },
  });

  type MockTransactionClient = ReturnType<typeof createMockTransactionClient>;

  const prismaMock = {
    merchant: {
      findUnique: jest.fn(),
    },
    transaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refund: {
      create: jest.fn(),
    },
    event: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb: (tx: MockTransactionClient) => unknown) => {
      return cb(createMockTransactionClient());
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  describe('create', () => {
    it('should create a transaction successfully', async () => {
      prismaMock.merchant.findUnique.mockResolvedValueOnce(mockMerchant);
      prismaMock.transaction.findUnique.mockResolvedValueOnce(null);

      const dto = {
        merchantId: 'merchant-1',
        amount: 10000,
        currency: 'BRL',
        cardNumber: '4532015112830366',
        cardBrand: 'VISA',
        idempotencyKey: 'idempotency-1',
      };

      const result = await service.create(dto);

      expect(result).toBeDefined();
      expect(prismaMock.merchant.findUnique).toHaveBeenCalledWith({
        where: { id: 'merchant-1' },
      });
    });

    it('should throw BadRequestException for invalid card number', async () => {
      const dto = {
        merchantId: 'merchant-1',
        amount: 10000,
        currency: 'BRL',
        cardNumber: '1234567890123456',
        cardBrand: 'VISA',
        idempotencyKey: 'idempotency-1',
      };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when merchant does not exist', async () => {
      prismaMock.merchant.findUnique.mockResolvedValueOnce(null);

      const dto = {
        merchantId: 'invalid-merchant',
        amount: 10000,
        currency: 'BRL',
        cardNumber: '4532015112830366',
        cardBrand: 'VISA',
        idempotencyKey: 'idempotency-1',
      };

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });

    it('should return existing transaction for duplicate idempotencyKey', async () => {
      prismaMock.merchant.findUnique.mockResolvedValueOnce(mockMerchant);
      prismaMock.transaction.findUnique.mockResolvedValueOnce(mockTransaction);

      const dto = {
        merchantId: 'merchant-1',
        amount: 10000,
        currency: 'BRL',
        cardNumber: '4532015112830366',
        cardBrand: 'VISA',
        idempotencyKey: 'idempotency-1',
      };

      const result = await service.create(dto);

      expect(result).toEqual(mockTransaction);
    });
  });

  describe('authorize', () => {
    it('should authorize a transaction successfully', async () => {
      const pendingTransaction = {
        ...mockTransaction,
        status: TransactionStatus.PENDING,
      };

      prismaMock.transaction.findUnique.mockResolvedValueOnce(
        pendingTransaction,
      );

      const result = await service.authorize('tx-1');

      expect(result).toBeDefined();
      expect(prismaMock.transaction.findUnique).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
      });
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      prismaMock.transaction.findUnique.mockResolvedValueOnce(null);

      await expect(service.authorize('invalid-tx')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw UnprocessableEntityException for invalid status transition', async () => {
      const capturedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.CAPTURED,
      };

      prismaMock.transaction.findUnique.mockResolvedValueOnce(
        capturedTransaction,
      );

      await expect(service.authorize('tx-1')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('capture', () => {
    it('should capture an authorized transaction', async () => {
      const authorizedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.AUTHORIZED,
      };

      prismaMock.transaction.findUnique.mockResolvedValueOnce(
        authorizedTransaction,
      );

      const result = await service.capture('tx-1');

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      prismaMock.transaction.findUnique.mockResolvedValueOnce(null);

      await expect(service.capture('invalid-tx')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw UnprocessableEntityException for invalid status transition', async () => {
      const refundedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.REFUNDED,
      };

      prismaMock.transaction.findUnique.mockResolvedValueOnce(
        refundedTransaction,
      );

      await expect(service.capture('tx-1')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('refund', () => {
    it('should refund a captured transaction partially', async () => {
      const capturedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.CAPTURED,
        refundedAmount: 0,
      };

      prismaMock.transaction.findUnique.mockResolvedValueOnce(
        capturedTransaction,
      );

      const dto = { amount: 5000 };
      const result = await service.refund('tx-1', dto);

      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      prismaMock.transaction.findUnique.mockResolvedValueOnce(null);

      const dto = { amount: 5000 };
      await expect(service.refund('invalid-tx', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when refund amount exceeds remaining balance', async () => {
      const capturedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.CAPTURED,
        amount: 10000,
        refundedAmount: 8000,
      };

      prismaMock.transaction.findUnique.mockResolvedValueOnce(
        capturedTransaction,
      );

      const dto = { amount: 3000 };
      await expect(service.refund('tx-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw UnprocessableEntityException for invalid status transition', async () => {
      const failedTransaction = {
        ...mockTransaction,
        status: TransactionStatus.FAILED,
      };

      prismaMock.transaction.findUnique.mockResolvedValueOnce(
        failedTransaction,
      );

      const dto = { amount: 5000 };
      await expect(service.refund('tx-1', dto)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
