import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { MEMO_TARGET_TYPES, type MemoTargetType } from '../memo-target';

export const MEMO_GROUPS_DEFAULT_LIMIT = 20;
export const MEMO_GROUPS_MAX_LIMIT = 50;

export class FindMemoGroupsQuery {
  @ApiPropertyOptional({
    description: '메모 종류 (생략하면 전체)',
    enum: MEMO_TARGET_TYPES,
  })
  @IsOptional()
  @IsIn(MEMO_TARGET_TYPES)
  targetType?: MemoTargetType;

  @ApiPropertyOptional({
    description:
      '이전 응답의 nextCursor (불투명 문자열, 그대로 되돌려 준다). 생략하면 첫 페이지',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cursor?: string;

  @ApiPropertyOptional({
    description: `한 페이지의 그룹 수 (1~${MEMO_GROUPS_MAX_LIMIT}, 기본 ${MEMO_GROUPS_DEFAULT_LIMIT})`,
    default: MEMO_GROUPS_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MEMO_GROUPS_MAX_LIMIT)
  limit?: number;
}
