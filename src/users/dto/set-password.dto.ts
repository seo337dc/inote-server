import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SetPasswordDto {
  @ApiProperty({ description: '새 비밀번호 (최소 8자)' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
