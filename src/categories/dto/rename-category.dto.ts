import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RenameCategoryDto {
  @ApiProperty({
    description: '새 이름 (앞뒤 공백을 지운 뒤 1~50자)',
    minLength: 1,
    maxLength: 50,
  })
  // 숫자 같은 문자열이 아닌 값은 그대로 두어 아래 @IsString이 400으로 거절하게 한다 (변환 단계에서 터져 500이 나지 않도록)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;
}
