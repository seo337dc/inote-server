import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MoveCategoryDto } from './move-category.dto';

/**
 * MoveCategoryDto 검증 — PATCH /categories/:id/move 요청 본문
 *   parentId: string | null   ← null이면 최상위. 키 자체가 없는 것(undefined)·빈 문자열은 허용하지 않는다
 *   index:    number          ← 0 이상의 정수, 필수. 숫자 문자열("2")은 변환하지 않고 거절한다 (JSON 본문이라 숫자로 온다)
 * (실제 서버에서는 ValidationPipe({ whitelist: true, transform: true })가 같은 검증을 한다)
 */
describe('MoveCategoryDto', () => {
  async function check(body: Record<string, unknown>) {
    const dto = plainToInstance(MoveCategoryDto, body);
    return { dto, errors: await validate(dto) };
  }
  const failedProperties = (errors: { property: string }[]) =>
    errors.map((e) => e.property);

  it('parentId가 문자열이고 index가 0 이상 정수면 통과한다', async () => {
    const { errors } = await check({ parentId: 'p1', index: 0 });

    expect(errors).toHaveLength(0);
    expect((await check({ parentId: 'p1', index: 7 })).errors).toHaveLength(0);
  });

  it('parentId가 null이면 통과한다 (최상위로 이동)', async () => {
    const { dto, errors } = await check({ parentId: null, index: 2 });

    expect(errors).toHaveLength(0);
    expect(dto.parentId).toBeNull();
  });

  it('parentId 키가 없으면(undefined) 실패한다 — null과 구별한다', async () => {
    const { errors } = await check({ index: 0 });

    expect(failedProperties(errors)).toEqual(['parentId']);
  });

  it('parentId가 문자열이 아니면(숫자 등) 실패한다', async () => {
    expect(
      failedProperties((await check({ parentId: 1, index: 0 })).errors),
    ).toEqual(['parentId']);
    expect(
      failedProperties((await check({ parentId: {}, index: 0 })).errors),
    ).toEqual(['parentId']);
  });

  it('parentId가 빈 문자열이면 실패한다 (최상위로 착각하지 않게)', async () => {
    const { errors } = await check({ parentId: '', index: 0 });

    expect(failedProperties(errors)).toEqual(['parentId']);
  });

  it('index가 없으면 실패한다', async () => {
    const { errors } = await check({ parentId: null });

    expect(failedProperties(errors)).toEqual(['index']);
  });

  it('index가 음수면 실패한다', async () => {
    const { errors } = await check({ parentId: null, index: -1 });

    expect(failedProperties(errors)).toEqual(['index']);
  });

  it('index가 소수면 실패한다', async () => {
    const { errors } = await check({ parentId: null, index: 1.5 });

    expect(failedProperties(errors)).toEqual(['index']);
  });

  it('index가 숫자 문자열("2")이면 변환하지 않고 실패한다', async () => {
    const { dto, errors } = await check({ parentId: null, index: '2' });

    expect(failedProperties(errors)).toEqual(['index']);
    expect(dto.index).toBe('2');
  });

  it('둘 다 잘못되면 두 항목 모두 실패로 알려 준다', async () => {
    const { errors } = await check({ parentId: 1, index: 'x' });

    expect(failedProperties(errors).sort()).toEqual(['index', 'parentId']);
  });
});
