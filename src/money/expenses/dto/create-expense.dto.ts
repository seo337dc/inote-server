import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ description: '금액 (원)', example: 15000 })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ description: '카테고리', example: '식비' })
  @IsString()
  category: string;

  @ApiProperty({ description: '타입', enum: ['income', 'expense'] })
  @IsIn(['income', 'expense'])
  type: string;

  @ApiProperty({ description: '날짜 (YYYY-MM-DD)', example: '2026-06-23' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ description: '메모', example: '점심' })
  @IsOptional()
  @IsString()
  memo?: string;
}
