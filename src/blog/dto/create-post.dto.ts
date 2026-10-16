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

  @ApiProperty({
    description:
      '카테고리 이름 — 이전 방식. 새 코드는 categoryId를 쓴다(같은 이름이 다른 부모 아래 있을 수 있어서). categoryId가 같이 오면 무시된다',
    example: '학습',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  category: string;
}
