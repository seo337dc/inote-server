import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ description: '카테고리 이름' })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({ description: '상위 카테고리 ID (없으면 최상위)' })
  @IsOptional()
  @IsString()
  parentId?: string;
}
