import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

/**
 * MoveCategoryDto 검증 — 직접 작성할 테스트 골격
 *
 * 만들 DTO (아직 없음):  src/categories/dto/move-category.dto.ts
 *   parentId: string | null   ← null이면 최상위. 키 자체가 없는 것(undefined)은 허용하지 않는다
 *   index:    number          ← 0 이상의 정수, 필수
 *
 * 골격 예시:
 *   const dto = plainToInstance(MoveCategoryDto, { parentId: 'p1', index: 0 });
 *   const errors = await validate(dto);
 *   expect(errors).toHaveLength(0);          // 또는 errors[0].property === 'index'
 *
 * (구현 후에 아래 import 두 줄의 주석을 풀고 사용)
 *   import { MoveCategoryDto } from './move-category.dto';
 */
describe('MoveCategoryDto', () => {
  it('검증 도구(class-transformer / class-validator)를 불러올 수 있다 (골격 확인용 — 나머지를 채운 뒤 지워도 됨)', () => {
    expect(plainToInstance).toBeDefined();
    expect(validate).toBeDefined();
  });

  it.todo('parentId가 문자열이고 index가 0 이상 정수면 통과한다');
  it.todo('parentId가 null이면 통과한다 (최상위로 이동)');
  it.todo('parentId 키가 없으면(undefined) 실패한다');
  it.todo('parentId가 문자열이 아니면(숫자 등) 실패한다');
  it.todo('index가 없으면 실패한다');
  it.todo('index가 음수면 실패한다');
  it.todo('index가 소수면 실패한다');
  it.todo(
    'index가 숫자 문자열("2")이면 어떻게 할지 정하고 테스트한다 (@Type(() => Number) 사용 여부)',
  );
});
