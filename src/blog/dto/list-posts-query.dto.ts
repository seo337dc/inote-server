import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
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

  @ApiPropertyOptional({
    description:
      '카테고리 id로 필터 — 그 카테고리와 하위 카테고리의 글을 모두 포함 (없으면 전체). 이름이 아니라 id다: 같은 이름이 다른 부모 아래 있을 수 있다',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

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

  @ApiPropertyOptional({
    description:
      '보관함 보기 (나의 글 전용) — true면 보관한 글만 보관한 시각 최신순으로, 없거나 false면 보관한 글을 뺀 나의 글. 공개 목록(/blog/posts)에서는 무시된다',
  })
  // 쿼리스트링은 항상 문자열이라 'true'/'false'만 불리언으로 바꾼다 (그 외 값은 그대로 두어 IsBoolean이 거른다)
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @ApiPropertyOptional({
    description:
      '작성자 id로 필터 (공개 목록 전용) — 그 작성자의 공개 글만, 응답에 author가 함께 내려감',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
