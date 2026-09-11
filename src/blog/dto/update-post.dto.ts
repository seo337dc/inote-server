import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
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
}
