import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpsertSettingsDto {
  @ApiPropertyOptional({ description: '월급 (원)', example: 3000000 })
  @IsOptional()
  @IsInt()
  salary?: number;

  @ApiPropertyOptional({ description: '월 저축 목표 (원)', example: 500000 })
  @IsOptional()
  @IsInt()
  savings?: number;

  @ApiPropertyOptional({ description: '고정 지출 합계 (원)', example: 300000 })
  @IsOptional()
  @IsInt()
  fixedExpense?: number;

  @ApiPropertyOptional({ description: '월급 입금일 (1~31)', example: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  salaryDate?: number;
}
