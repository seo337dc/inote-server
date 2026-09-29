import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListPostsQueryDto {
  @ApiPropertyOptional({
    description: '일반 글 페이지 번호 (1부터 시작, 없으면 1)',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: '고정 글 페이지 번호 (1부터 시작, 없으면 1) — 고정 글은 3개씩',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pinnedPage?: number = 1;

  @ApiPropertyOptional({
    description: '일반 글 페이지당 글 수 (고정 글 제외)',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 10;

  @ApiPropertyOptional({ description: '카테고리 이름으로 필터 (없으면 전체)' })
  @IsOptional()
  @IsString()
  category?: string;
}
