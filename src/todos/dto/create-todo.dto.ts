import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTodoDto {
  @ApiProperty({ description: '할 일 제목' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: '마감일 (ISO 날짜, 선택)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
