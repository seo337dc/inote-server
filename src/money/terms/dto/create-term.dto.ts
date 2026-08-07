import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FinanceCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTermDto {
  @ApiProperty({ description: '용어명', example: 'PER' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  term: string;

  @ApiProperty({
    description: '설명 (자유 형식)',
    example: '주가수익비율. 주가를 주당순이익으로 나눈 값.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description: string;

  @ApiProperty({
    description: '카테고리',
    enum: FinanceCategory,
    example: FinanceCategory.STOCK,
  })
  @IsEnum(FinanceCategory)
  category: FinanceCategory;

  @ApiPropertyOptional({
    description: '공유 여부 (기본 false)',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isShared?: boolean;
}
