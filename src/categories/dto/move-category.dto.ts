import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min, ValidateIf } from 'class-validator';

// 카테고리 위치 이동 요청 — "어느 부모 밑의 몇 번째로" (같은 부모 안에서 순서만 바꾸는 것도, 다른 카테고리 안으로 옮기는 것도 같은 요청)
export class MoveCategoryDto {
  @ApiProperty({
    description:
      '새 부모 카테고리 ID. null이면 최상위로 옮긴다. 키를 아예 빼는 것은 허용하지 않는다',
    type: String,
    nullable: true,
  })
  // null만 검증을 건너뛴다 — 키가 없는 값(undefined)은 아래 @IsString이 거절한다.
  // 빈 문자열("")도 @IsNotEmpty가 거절한다 (서비스가 "" 를 최상위로 착각하지 않게)
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @IsNotEmpty()
  parentId: string | null;

  @ApiProperty({
    description:
      '"옮기는 카테고리를 뺀 새 부모의 자식 목록"에서의 위치 (0부터). 범위를 넘으면 맨 뒤로 맞춘다',
    minimum: 0,
  })
  // 쿼리가 아니라 JSON 본문이라 숫자로 온다 — 숫자 문자열("2")은 변환하지 않고 거절한다
  @IsInt()
  @Min(0)
  index: number;
}
