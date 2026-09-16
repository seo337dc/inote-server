import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateMandalartItemDto {
  @ApiPropertyOptional({ description: '정리 내용 (마크다운)' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '완료 여부' })
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
