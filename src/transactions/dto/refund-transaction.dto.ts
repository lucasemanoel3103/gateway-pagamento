import { IsInt, IsPositive } from 'class-validator';

export class RefundTransactionDto {
  @IsInt()
  @IsPositive()
  amount!: number;
}
