import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({
    description: '제목',
    example: 'RAG 파이프라인 설계할 때 헷갈렸던 것들',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: '본문 (Tiptap 에디터가 만드는 HTML)',
    example: '<p>내용...</p>',
  })
  @IsString()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({
    description: '목록에 보여줄 짧은 요약',
    example: '임베딩 모델을 고르는 기준을 정리했다.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  excerpt?: string;

  @ApiProperty({ description: '카테고리', example: '학습' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  category: string;
}
