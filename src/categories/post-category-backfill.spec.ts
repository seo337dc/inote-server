import {
  applyLinks,
  assertSafeTarget,
  describeTarget,
  formatPlan,
  parseBackfillArgs,
  planBackfill,
} from './post-category-backfill';

const cat = (
  id: string,
  userId: string,
  name: string,
  parentId: string | null = null,
) => ({ id, userId, name, parentId });
const post = (id: string, userId: string | null, category: string) => ({
  id,
  title: `글 ${id}`,
  userId,
  category,
});

// 사용자 u1: 학습(c1) > AI(c2), 사이드프로젝트 기록(c3) > AI(c4) > 이슈 하위(c5), 일기(c6)
const CATS = [
  cat('c1', 'u1', '학습'),
  cat('c2', 'u1', 'AI', 'c1'),
  cat('c3', 'u1', '사이드프로젝트 기록'),
  cat('c4', 'u1', 'AI', 'c3'),
  cat('c6', 'u1', '일기'),
  // 다른 사용자는 'AI'가 하나뿐
  cat('d1', 'u2', 'AI'),
];

describe('planBackfill', () => {
  it('작성자 카테고리 중 이름이 정확히 하나면 그 id로 잇는다', () => {
    const plan = planBackfill([post('p1', 'u1', '일기')], CATS);

    expect(plan.links).toEqual([{ postId: 'p1', categoryId: 'c6' }]);
    expect(plan.ambiguous).toEqual([]);
    expect(plan.unmatched).toEqual([]);
  });

  it('같은 이름이 둘 이상이면 잇지 않고 후보(경로·id)와 함께 직접 지정 목록에 넣는다', () => {
    const plan = planBackfill([post('p2', 'u1', 'AI')], CATS);

    expect(plan.links).toEqual([]);
    expect(plan.ambiguous).toHaveLength(1);
    expect(plan.ambiguous[0]).toMatchObject({ postId: 'p2', category: 'AI' });
    expect(plan.ambiguous[0].candidates).toEqual([
      { id: 'c2', path: '학습 > AI' },
      { id: 'c4', path: '사이드프로젝트 기록 > AI' },
    ]);
  });

  it('이름이 같아도 다른 작성자의 카테고리는 보지 않는다 (작성자마다 트리가 따로다)', () => {
    // u2의 'AI'는 하나뿐이라 자동으로 이어지고, u1의 'AI' 두 곳과 섞이지 않는다
    const plan = planBackfill([post('p3', 'u2', 'AI')], CATS);

    expect(plan.links).toEqual([{ postId: 'p3', categoryId: 'd1' }]);
  });

  it('이름이 맞는 카테고리가 없으면 잇지 않고 unmatched에 넣는다', () => {
    const plan = planBackfill([post('p4', 'u1', '지워진카테고리')], CATS);

    expect(plan.links).toEqual([]);
    expect(plan.unmatched).toEqual([
      expect.objectContaining({ postId: 'p4', category: '지워진카테고리' }),
    ]);
  });

  it('작성자가 없는 글과 카테고리 이름이 빈 글은 대상에서 빼고 개수만 센다', () => {
    const plan = planBackfill(
      [
        post('p5', null, '학습'),
        post('p6', 'u1', ''),
        post('p7', 'u1', '학습'),
      ],
      CATS,
    );

    expect(plan.skipped).toEqual({ noAuthor: 1, emptyCategory: 1 });
    expect(plan.links).toEqual([{ postId: 'p7', categoryId: 'c1' }]);
  });

  it('이름 비교는 정확히 같은 문자열일 때만 맞는다 (공백·대소문자가 다르면 맞지 않는다)', () => {
    const plan = planBackfill(
      [post('p8', 'u1', '학습 '), post('p9', 'u1', 'ai')],
      CATS,
    );

    expect(plan.links).toEqual([]);
    expect(plan.unmatched).toHaveLength(2);
  });

  it('섞인 입력을 한꺼번에 나눈다', () => {
    const plan = planBackfill(
      [
        post('a', 'u1', '학습'),
        post('b', 'u1', 'AI'),
        post('c', 'u1', '없는것'),
        post('d', 'u1', '일기'),
      ],
      CATS,
    );

    expect(plan.links.map((l) => l.postId)).toEqual(['a', 'd']);
    expect(plan.ambiguous.map((a) => a.postId)).toEqual(['b']);
    expect(plan.unmatched.map((u) => u.postId)).toEqual(['c']);
  });

  it('부모가 서로를 가리키는 순환 데이터여도 후보 경로 계산이 끝난다', () => {
    const cyc = [cat('x', 'u1', 'AI', 'y'), cat('y', 'u1', 'AI', 'x')];

    const plan = planBackfill([post('p', 'u1', 'AI')], cyc);

    expect(plan.ambiguous[0].candidates).toHaveLength(2);
  });
});

describe('formatPlan', () => {
  it('dry-run이면 "이을 수 있음", apply면 "이음"으로 보여주고 직접 지정 대상은 후보와 함께 나열한다', () => {
    const plan = planBackfill(
      [post('p1', 'u1', '일기'), post('p2', 'u1', 'AI')],
      CATS,
    );

    const dry = formatPlan(plan, 2, false).join('\n');
    const applied = formatPlan(plan, 2, true).join('\n');

    expect(dry).toContain('자동으로 이을 수 있음: 1개');
    expect(applied).toContain('자동으로 이음: 1개');
    expect(dry).toContain('직접 지정 필요 — 같은 이름이 둘 이상: 1개');
    expect(dry).toContain('후보: 학습 > AI  (c2)');
    expect(dry).toContain('후보: 사이드프로젝트 기록 > AI  (c4)');
  });
});

describe('parseBackfillArgs', () => {
  it('아무 옵션도 없으면 dry-run이다 (apply false, 원격 불허)', () => {
    expect(parseBackfillArgs([])).toEqual({ apply: false, allowRemote: false });
  });

  it('--apply, --allow-remote, --user를 읽는다', () => {
    expect(
      parseBackfillArgs(['--apply', '--allow-remote', '--user', 'u1']),
    ).toEqual({ apply: true, allowRemote: true, userId: 'u1' });
  });

  it('--user 값이 없거나 알 수 없는 옵션이면 거절한다', () => {
    expect(() => parseBackfillArgs(['--user'])).toThrow('사용자 id');
    expect(() => parseBackfillArgs(['--user', '--apply'])).toThrow('사용자 id');
    expect(() => parseBackfillArgs(['--force'])).toThrow('알 수 없는 옵션');
  });
});

describe('assertSafeTarget / describeTarget', () => {
  const LOCAL = 'postgresql://inote:secret@127.0.0.1:5435/inote_dev';
  const REMOTE =
    'postgresql://user:secret@db.example.supabase.co:5432/postgres';

  it('로컬 DB는 옵션 없이도 통과한다', () => {
    expect(() => assertSafeTarget(LOCAL, false)).not.toThrow();
  });

  it('원격 DB는 --allow-remote 없이는 거절한다', () => {
    expect(() => assertSafeTarget(REMOTE, false)).toThrow('--allow-remote');
    expect(() => assertSafeTarget(REMOTE, true)).not.toThrow();
  });

  it('DATABASE_URL이 없거나 이상하면 거절하고, 오류에 연결 문자열을 싣지 않는다', () => {
    expect(() => assertSafeTarget(undefined, false)).toThrow('DATABASE_URL');
    expect(() => assertSafeTarget('이상한값 secret', false)).toThrow(
      /해석할 수 없습니다/,
    );
    try {
      assertSafeTarget('이상한값 secret', false);
    } catch (e) {
      expect((e as Error).message).not.toContain('secret');
    }
  });

  it('대상 설명에는 host/db만 나오고 비밀번호는 없다', () => {
    expect(describeTarget(REMOTE)).toBe('db.example.supabase.co/postgres');
    expect(describeTarget(REMOTE)).not.toContain('secret');
  });
});

describe('applyLinks', () => {
  it('카테고리별로 묶어 한 번씩 쓰고, 이미 지정된 글을 덮어쓰지 않게 categoryId: null 조건을 건다', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });

    const updated = await applyLinks(
      [
        { postId: 'p1', categoryId: 'c1' },
        { postId: 'p2', categoryId: 'c1' },
        { postId: 'p3', categoryId: 'c6' },
      ],
      { updateMany },
    );

    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p1', 'p2'] }, categoryId: null },
      data: { categoryId: 'c1' },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p3'] }, categoryId: null },
      data: { categoryId: 'c6' },
    });
    expect(updated).toBe(4); // mock이 매번 2를 돌려주므로 2 + 2
  });

  it('이을 글이 없으면 DB를 쓰지 않는다', async () => {
    const updateMany = jest.fn();

    const updated = await applyLinks([], { updateMany });

    expect(updateMany).not.toHaveBeenCalled();
    expect(updated).toBe(0);
  });
});
