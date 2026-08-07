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

export class CreateBookDto {
  @ApiProperty({ description: '책 제목', example: '부의 추월차선' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @ApiProperty({ description: '저자', example: 'MJ 드마코' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  author: string;

  @ApiProperty({
    description: '한줄 코멘트',
    example: '자산과 소득의 차이를 명확히 알려주는 책',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  comment: string;

  @ApiProperty({
    description: '카테고리',
    enum: FinanceCategory,
    example: FinanceCategory.ECONOMY,
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
