import { ApiProperty } from '@nestjs/swagger';
import { ReviewType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpsertReviewDto {
  @ApiProperty({ enum: ReviewType, example: 'WEEKLY' })
  @IsEnum(ReviewType)
  type: ReviewType;

  @ApiProperty({ example: 2026 })
  @IsInt()
  year: number;

  @ApiProperty({ description: 'WEEKLY: ISO 주차(1-53), MONTHLY: 월(1-12)', example: 28 })
  @IsInt()
  @Min(1)
  @Max(53)
  period: number;

  @ApiProperty({ example: 4, minimum: 0, maximum: 5 })
  @IsInt()
  @Min(0)
  @Max(5)
  rating: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  text?: string;
}
