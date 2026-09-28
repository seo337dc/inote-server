import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateReadingLogDto {
  @ApiPropertyOptional({
    description:
      'true면 진짜 저장(발행) — 자동저장 시엔 없거나 false. 발행 시엔 title이 필요 ' +
      '(이번 요청에 없으면 기존 저장값 기준으로 서비스 레벨에서 검증함 — ' +
      'class-validator의 IsOptional은 값이 없을 때 ValidateIf 조건부 검증까지 건너뛰어버려서 DTO로는 표현 불가)',
  })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;

  @ApiPropertyOptional({
    description: '책 제목 (자동저장 시엔 비어 있어도 됨)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: '작가' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  author?: string;

  @ApiPropertyOptional({
    description: '책 표지 이미지 URL (POST /uploads/image 결과)',
  })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({ description: '읽기 시작일 (ISO 날짜)' })
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @ApiPropertyOptional({ description: '읽기 완료일 (ISO 날짜)' })
  @IsOptional()
  @IsDateString()
  finishedAt?: string;

  @ApiPropertyOptional({ description: '독후감 (자유글, HTML)' })
  @IsOptional()
  @IsString()
  content?: string;
}
