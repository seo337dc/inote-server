import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateMandalartItemDto {
  @ApiProperty({ description: '축 (t1~t9)', example: 't9' })
  @IsString()
  theme: string;

  @ApiProperty({ description: '축 이름', example: '기능 고도화' })
  @IsString()
  themeName: string;

  @ApiProperty({ description: '항목 제목', example: 'FE/BE/AI 모니터링' })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description:
      '그리드 내 표시 순서 (생략 시 해당 축의 마지막 순번 뒤에 추가)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
