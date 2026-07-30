// src/transactions/transactions.controller.ts
import { Body, Controller, Param, Post } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(@Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(dto);
  }

  @Post(':id/authorize')
  authorize(@Param('id') id: string) {
    return this.transactionsService.authorize(id);
  }
}
