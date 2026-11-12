import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  MEMO_MAX_LENGTH,
  MEMO_TARGET_TYPES,
  MEMO_TITLE_MAX_LENGTH,
  type MemoTargetType,
} from '../memo-target';

export class CreateMemoDto {
  @ApiProperty({
    description: '메모 종류 (post·reading·general=대상 없는 일반 메모)',
    enum: MEMO_TARGET_TYPES,
  })
  @IsIn(MEMO_TARGET_TYPES)
  targetType: MemoTargetType;

  @ApiPropertyOptional({
    description:
      '대상 ID (본인이 작성한 글 또는 독서 기록). post·reading은 필수, general은 보내도 무시한다',
  })
  @ValidateIf((o: CreateMemoDto) => o.targetType !== 'general')
  @IsString()
  @IsNotEmpty()
  targetId?: string;

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
