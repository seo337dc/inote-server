import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class CreateSettingHistoryDto {
  @ApiProperty({ description: '기록 대상 월 (YYYY-MM)', example: '2026-07' })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month는 YYYY-MM 형식이어야 합니다' })
  month: string;

  @ApiPropertyOptional({ description: '기록 제목', example: '7월 자산 현황' })
  @IsOptional()
  @IsString()
  title?: string;
}
