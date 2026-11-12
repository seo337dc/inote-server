import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { MEMO_TARGET_TYPES, type MemoTargetType } from '../memo-target';

// 둘 다 생략하면 내 메모 전체, targetType만 주면 그 종류 전체, 둘 다 주면 그 대상의 메모.
// targetId만 보내면(어느 종류의 id인지 알 수 없어) 400.
export class FindMemosQuery {
  @ApiPropertyOptional({
    description: '메모 종류 (생략하면 전체)',
    enum: MEMO_TARGET_TYPES,
  })
  @ValidateIf(
    (o: FindMemosQuery) =>
      o.targetType !== undefined || o.targetId !== undefined,
  )
  @IsIn(MEMO_TARGET_TYPES)
  targetType?: MemoTargetType;

  @ApiPropertyOptional({
    description:
      '대상 ID (글 또는 독서 기록). general에서는 무시한다. targetType 없이는 보낼 수 없다',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  targetId?: string;
}
