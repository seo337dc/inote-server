import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const SEARCH_QUERY_MAX = 100;

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

  @ApiPropertyOptional({
    description:
      '검색어 — 제목 또는 본문에 들어 있는 글 (대소문자 무시). 앞뒤 공백을 지우고, 비어 있으면 검색 안 함. 최대 100자',
    maxLength: SEARCH_QUERY_MAX,
  })
  // 공백만 온 검색어는 "검색 안 함"으로 본다 (오류로 막지 않음). 문자열이 아니면 그대로 넘겨 IsString이 거른다
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(SEARCH_QUERY_MAX)
  q?: string;
}
