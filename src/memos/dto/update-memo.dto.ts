import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { MEMO_MAX_LENGTH, MEMO_TITLE_MAX_LENGTH } from '../memo-target';

// 둘 다 선택이지만 둘 중 하나는 있어야 한다 — 둘 다 없으면 서비스가 400을 던진다.
export class UpdateMemoDto {
  @ApiPropertyOptional({
    description: `메모 제목 (최대 ${MEMO_TITLE_MAX_LENGTH}자, 빈 문자열이면 제목을 지운 것)`,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MEMO_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({
    description: `메모 내용 (일반 텍스트, 최대 ${MEMO_MAX_LENGTH}자, 빈 문자열이면 내용을 지운 것)`,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MEMO_MAX_LENGTH)
  content?: string;
}
