import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { MEMO_MAX_LENGTH } from '../memo-target';

export class UpdateMemoDto {
  @ApiProperty({
    description: `메모 내용 (일반 텍스트, 최대 ${MEMO_MAX_LENGTH}자, 빈 문자열이면 내용을 지운 것)`,
  })
  @IsString()
  @MaxLength(MEMO_MAX_LENGTH)
  content: string;
}
