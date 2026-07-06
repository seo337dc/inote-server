import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SettingsItemDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  day?: number;
}

export class UpsertSettingsDto {
  @ApiPropertyOptional({ description: '월급 (원)', example: 3000000 })
  @IsOptional()
  @IsInt()
  salary?: number;

  @ApiPropertyOptional({ description: '월급 입금일 (1~31)', example: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  salaryDate?: number;

  @ApiPropertyOptional({ description: '일일 지출 한도 (원)', example: 50000 })
  @IsOptional()
  @IsInt()
  dailyLimit?: number;

  @ApiPropertyOptional({ description: '월 저축 목표 (원)', example: 500000 })
  @IsOptional()
  @IsInt()
  monthlySavingGoal?: number;

  @ApiPropertyOptional({ description: '자산 업데이트일 (1~31)', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  assetUpdateDate?: number;

  @ApiPropertyOptional({
    description: '적금 항목 목록',
    type: [SettingsItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettingsItemDto)
  savings?: SettingsItemDto[];

  @ApiPropertyOptional({
    description: '고정 지출 항목 목록',
    type: [SettingsItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettingsItemDto)
  fixedExpenses?: SettingsItemDto[];

  @ApiPropertyOptional({ description: '메모', example: '연봉 인상 후 재설정' })
  @IsOptional()
  @IsString()
  memo?: string;
}
