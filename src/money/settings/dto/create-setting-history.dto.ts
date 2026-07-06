import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class CreateSettingHistoryDto {
  @ApiProperty({ description: '기록 대상 월 (YYYY-MM)', example: '2026-07' })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month는 YYYY-MM 형식이어야 합니다' })
  month: string;
}
