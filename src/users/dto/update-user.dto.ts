import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: '이름' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '닉네임' })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiPropertyOptional({ description: '전화번호' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: '프로필 이미지 URL' })
  @IsOptional()
  @IsUrl()
  image?: string;

  @ApiPropertyOptional({
    description:
      'inote 서비스 이용 확인 — 로그인/가입 시 프론트에서 true로 세팅 (AUTH_POLICY.md 3번)',
  })
  @IsOptional()
  @IsBoolean()
  usesInote?: boolean;
}
