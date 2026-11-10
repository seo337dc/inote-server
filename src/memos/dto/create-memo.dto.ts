import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  MEMO_MAX_LENGTH,
  MEMO_TARGET_TYPES,
  MEMO_TITLE_MAX_LENGTH,
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

  @ApiPropertyOptional({
    description: `메모 제목 (최대 ${MEMO_TITLE_MAX_LENGTH}자, 생략하면 빈 문자열)`,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MEMO_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({
    description: `메모 내용 (일반 텍스트, 최대 ${MEMO_MAX_LENGTH}자, 생략하면 빈 문자열)`,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MEMO_MAX_LENGTH)
  content?: string;
}
