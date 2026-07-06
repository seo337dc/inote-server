import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateSettingHistoryDto {
  @ApiPropertyOptional({ description: '기록 제목', example: '7월 자산 현황' })
  @IsOptional()
  @IsString()
  title?: string;
}
