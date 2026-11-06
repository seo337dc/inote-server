import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  MEMO_MAX_LENGTH,
  MEMO_TARGET_TYPES,
  type MemoTargetType,
} from '../memo-target';

export class CreateMemoDto {
  @ApiProperty({ description: '대상 종류', enum: MEMO_TARGET_TYPES })
  @IsIn(MEMO_TARGET_TYPES)
  targetType: MemoTargetType;

  @ApiProperty({ description: '대상 ID (본인이 작성한 글 또는 독서 기록)' })
  @IsString()
  @IsNotEmpty()
  targetId: string;

  @ApiProperty({
    description: `메모 내용 (일반 텍스트, 최대 ${MEMO_MAX_LENGTH}자, 빈 문자열 가능)`,
  })
  @IsString()
  @MaxLength(MEMO_MAX_LENGTH)
  content: string;
}
