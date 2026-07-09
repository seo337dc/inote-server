import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Category } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ description: '금액 (원)', example: 15000 })
  @IsInt()
  @Min(1)
  amount: number;

  @ApiProperty({ description: '날짜 (YYYY-MM-DD)', example: '2026-07-03' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ description: '사용처', example: '스타벅스' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '카테고리', enum: Category, default: Category.ETC })
  @IsOptional()
  @IsEnum(Category)
  category?: Category;

  @ApiPropertyOptional({ description: '낭비 여부', default: false })
  @IsOptional()
  @IsBoolean()
  isWaste?: boolean;

  @ApiPropertyOptional({ description: '메모', example: '충동구매였음' })
  @IsOptional()
  @IsString()
  memo?: string;
}
