import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
} from 'class-validator';

// 한 번에 보관·해제할 수 있는 글 수의 상한
export const ARCHIVE_MAX_IDS = 100;

// 보관·보관 해제 요청 본문 — 글 id 목록 (단건도 한 개짜리 목록으로 보낸다)
export class ArchivePostsDto {
  @ApiProperty({
    description: `보관(해제)할 글 id 목록 — 1~${ARCHIVE_MAX_IDS}개. 내 글이 아니거나 없거나 발행 전인 id는 오류 없이 건너뛴다`,
    type: [String],
    minItems: 1,
    maxItems: ARCHIVE_MAX_IDS,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ARCHIVE_MAX_IDS)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  ids!: string[];
}
