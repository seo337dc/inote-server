import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const EMBEDDING_FILTERS = [
  'all',
  'incomplete',
  'failed',
  'done',
  'excluded',
] as const;

export class ListAdminEmbeddingsQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호 (1부터 시작)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지당 개수', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({
    description:
      '상태 탭 — incomplete는 incomplete·outdated·pending·processing을 묶는다',
    enum: EMBEDDING_FILTERS,
    default: 'all',
  })
  @IsOptional()
  @IsIn(EMBEDDING_FILTERS)
  status?: (typeof EMBEDDING_FILTERS)[number] = 'all';
}
