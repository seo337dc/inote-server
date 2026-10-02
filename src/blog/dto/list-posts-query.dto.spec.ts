import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListPostsQueryDto } from './list-posts-query.dto';

/**
 * ListPostsQueryDto의 검색어(q) 규칙
 *  - 앞뒤 공백을 지운다. 공백만 오면 "검색 안 함"(undefined)으로 본다 — 오류로 막지 않음
 *  - 최대 100자, 문자열만
 * (실제 서버에서는 ValidationPipe({ transform: true })가 같은 변환·검증을 한다)
 */
describe('ListPostsQueryDto — 검색어(q)', () => {
  async function check(q: unknown) {
    const dto = plainToInstance(ListPostsQueryDto, { q });
    const errors = await validate(dto);
    return { dto, errors };
  }

  it('앞뒤 공백을 지운 검색어로 바뀐다', async () => {
    const { dto, errors } = await check('  리액트 ');

    expect(errors).toHaveLength(0);
    expect(dto.q).toBe('리액트');
  });

  it('공백만 있으면 오류 없이 검색 안 함(undefined)이 된다', async () => {
    const { dto, errors } = await check('   ');

    expect(errors).toHaveLength(0);
    expect(dto.q).toBeUndefined();
  });

  it('q가 없어도 통과한다', async () => {
    const { dto, errors } = await check(undefined);

    expect(errors).toHaveLength(0);
    expect(dto.q).toBeUndefined();
  });

  it('100자는 통과하고 101자는 실패한다', async () => {
    expect((await check('가'.repeat(100))).errors).toHaveLength(0);

    const { errors } = await check('가'.repeat(101));
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });

  it('문자열이 아니면 실패한다 — 공백 정리가 문자열 아닌 값에서 터지지 않는다', async () => {
    const { errors } = await check(123);

    expect(errors[0].constraints).toHaveProperty('isString');
  });
});
