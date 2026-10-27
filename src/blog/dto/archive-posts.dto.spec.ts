import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ARCHIVE_MAX_IDS, ArchivePostsDto } from './archive-posts.dto';
import { ListPostsQueryDto } from './list-posts-query.dto';

/**
 * ArchivePostsDto — 보관·보관 해제 요청 본문
 *  - ids는 글 id 문자열 배열, 1~100개 (단건도 한 개짜리 배열)
 */
describe('ArchivePostsDto', () => {
  async function check(ids: unknown) {
    return validate(plainToInstance(ArchivePostsDto, { ids }));
  }

  it('1개짜리 목록(단건 보관)은 통과한다', async () => {
    expect(await check(['p1'])).toHaveLength(0);
  });

  it(`${ARCHIVE_MAX_IDS}개는 통과하고 ${ARCHIVE_MAX_IDS + 1}개는 실패한다`, async () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

    expect(await check(ids(ARCHIVE_MAX_IDS))).toHaveLength(0);
    expect(await check(ids(ARCHIVE_MAX_IDS + 1))).not.toHaveLength(0);
  });

  it('빈 배열·ids 없음·배열이 아닌 값은 실패한다', async () => {
    expect(await check([])).not.toHaveLength(0);
    expect(await check(undefined)).not.toHaveLength(0);
    expect(await check('p1')).not.toHaveLength(0);
  });

  it('문자열이 아니거나 빈 문자열인 id가 섞여 있으면 실패한다', async () => {
    expect(await check(['p1', 2])).not.toHaveLength(0);
    expect(await check(['p1', ''])).not.toHaveLength(0);
  });
});

/**
 * ListPostsQueryDto의 보관함 보기(archived)
 *  - 쿼리스트링은 문자열이라 'true'/'false'만 불리언으로 바꾼다. 없으면 undefined(보관한 글을 뺀 나의 글)
 */
describe('ListPostsQueryDto — 보관함(archived)', () => {
  async function check(archived: unknown) {
    const dto = plainToInstance(ListPostsQueryDto, { archived });
    return { dto, errors: await validate(dto) };
  }

  it("'true'는 true가 된다", async () => {
    const { dto, errors } = await check('true');

    expect(errors).toHaveLength(0);
    expect(dto.archived).toBe(true);
  });

  it("'false'는 false가 된다", async () => {
    const { dto, errors } = await check('false');

    expect(errors).toHaveLength(0);
    expect(dto.archived).toBe(false);
  });

  it('없으면 undefined다', async () => {
    const { dto, errors } = await check(undefined);

    expect(errors).toHaveLength(0);
    expect(dto.archived).toBeUndefined();
  });

  it("'true'/'false'가 아닌 값('yes', '1')은 실패한다", async () => {
    expect((await check('yes')).errors).not.toHaveLength(0);
    expect((await check('1')).errors).not.toHaveLength(0);
  });
});
