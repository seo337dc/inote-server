import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { CreatePostDto } from './create-post.dto';

export class UpdatePostDto extends PartialType(CreatePostDto) {
  @ApiPropertyOptional({
    description:
      'true면 진짜 저장(발행) — publishedAt이 없으면 지금 시각으로 채우고 AI 요약도 갱신. ' +
      '없거나 false면 임시저장(자동저장) — 내용만 갱신, 발행 상태는 그대로.',
  })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;

  // 자동저장(publish 없음)은 제목/본문이 비어 있어도 되지만, 진짜 저장(publish: true)은
  // CreatePostDto와 동일하게 최소 1자 이상이어야 함 — PartialType이 지운 MinLength를
  // publish가 true일 때만 되살림.
  @ApiPropertyOptional({ description: '제목 (자동저장 시엔 비어 있어도 됨)' })
  @IsOptional()
  @IsString()
  @ValidateIf((o: UpdatePostDto) => o.publish === true)
  @MinLength(1)
  title?: string;

  @ApiPropertyOptional({ description: '본문 (자동저장 시엔 비어 있어도 됨)' })
  @IsOptional()
  @IsString()
  @ValidateIf((o: UpdatePostDto) => o.publish === true)
  @MinLength(1)
  content?: string;
}
