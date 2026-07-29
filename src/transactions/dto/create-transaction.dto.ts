// src/transactions/dto/create-transaction.dto.ts
import {
  IsInt,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  IsIn,
} from 'class-validator';

export class CreateTransactionDto {
  @IsUUID()
  merchantId!: string;

  @IsInt()
  @IsPositive()
  amount!: number; // sempre em centavos

  @IsString()
  @IsIn(['BRL', 'USD'])
  currency!: string;

  @IsString()
  @Length(13, 19) // número "fake" de cartão, só pra rodar Luhn depois
  cardNumber!: string;

  @IsString()
  cardBrand!: string;

  @IsString()
  idempotencyKey!: string;
}
