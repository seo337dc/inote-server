import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { MEMO_TARGET_TYPES, type MemoTargetType } from '../memo-target';

export class FindMemosQuery {
  @ApiProperty({ description: '대상 종류', enum: MEMO_TARGET_TYPES })
  @IsIn(MEMO_TARGET_TYPES)
  targetType: MemoTargetType;

  @ApiProperty({ description: '대상 ID (글 또는 독서 기록)' })
  @IsString()
  @IsNotEmpty()
  targetId: string;
}
