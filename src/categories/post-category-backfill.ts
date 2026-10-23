// 기존 글의 Post.categoryId 채우기 — 글이 카테고리를 이름 문자열(Post.category)로만 가리키던 시절의 글을 id로 잇는다.
// 규칙: 글 작성자의 카테고리 중 이름이 **정확히 하나** 맞는 글만 자동으로 잇는다.
//  - 하나도 없음(unmatched): 카테고리가 지워졌거나 이름이 바뀐 글 — 건드리지 않고 목록으로 보여준다
//  - 둘 이상(ambiguous): 같은 이름이 여러 곳(예: 학습 > AI, 사이드프로젝트 기록 > AI) — 어느 쪽인지 알 수 없어 건드리지 않고
//    후보와 함께 목록으로 보여준다 (글 이동 기능으로 직접 지정한다)
// 쓰기는 기본이 아니다: dry-run이 기본이고 --apply를 줄 때만 쓴다. 이미 categoryId가 있는 글은 대상이 아니라 여러 번 실행해도 안전하다.
// 설명: docs/runbooks/post-category-backfill.md

export type BackfillOptions = {
  apply: boolean;
  allowRemote: boolean;
  userId?: string;
};

export function parseBackfillArgs(argv: string[]): BackfillOptions {
  const options: BackfillOptions = { apply: false, allowRemote: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--allow-remote') options.allowRemote = true;
    else if (arg === '--user') {
      const value = argv[++i];
      if (!value || value.startsWith('--')) {
        throw new Error('--user 다음에 사용자 id가 필요합니다.');
      }
      options.userId = value;
    } else {
      throw new Error(
        `알 수 없는 옵션: ${arg} (사용: --apply, --allow-remote, --user <id>)`,
      );
    }
  }
  return options;
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

function parseDbUrl(databaseUrl: string | undefined): URL {
  if (!databaseUrl) throw new Error('DATABASE_URL이 설정되지 않았습니다.');
  try {
    return new URL(databaseUrl);
  } catch {
    // 연결 문자열 원문(비밀번호 포함)을 오류에 싣지 않는다
    throw new Error('DATABASE_URL을 해석할 수 없습니다.');
  }
}

// 어느 DB에 연결하는지 — 비밀번호 없이 host/db만
export function describeTarget(databaseUrl: string | undefined): string {
  const url = parseDbUrl(databaseUrl);
  return `${url.hostname}${url.pathname}`;
}

// 원격(운영) DB는 --allow-remote를 줘야만 연결한다 — 실수로 운영 DB에 돌리지 않게 (dry-run도 마찬가지로 먼저 의식하게 한다)
export function assertSafeTarget(
  databaseUrl: string | undefined,
  allowRemote: boolean,
): void {
  const url = parseDbUrl(databaseUrl);
  if (!LOCAL_HOSTS.includes(url.hostname) && !allowRemote) {
    throw new Error(
      `원격 DB입니다(host=${url.hostname}). 운영에 실행하려면 --allow-remote를 붙이세요. ` +
        '먼저 --apply 없이(dry-run) 결과를 확인한 뒤 --apply를 더하세요.',
    );
  }
}

export type BackfillPostRow = {
  id: string;
  title: string;
  userId: string | null;
  category: string;
};
export type BackfillCategoryRow = {
  id: string;
  userId: string;
  name: string;
  parentId: string | null;
};

export type Candidate = { id: string; path: string };
export type PostRef = {
  postId: string;
  title: string;
  userId: string;
  category: string;
};

export type BackfillPlan = {
  // 자동으로 이을 글 — 작성자 카테고리 중 이름이 정확히 하나
  links: { postId: string; categoryId: string }[];
  // 이름이 맞는 카테고리가 하나도 없는 글
  unmatched: PostRef[];
  // 같은 이름의 카테고리가 둘 이상이라 어느 쪽인지 알 수 없는 글 + 후보
  ambiguous: (PostRef & { candidates: Candidate[] })[];
  // 대상에서 뺀 글 수: 작성자 없음 / 카테고리 이름이 비어 있음(빈 draft 등)
  skipped: { noAuthor: number; emptyCategory: number };
};

// 최상위부터 해당 카테고리까지의 경로 문자열 ("학습 > AI")
function pathString(
  byId: Map<string, BackfillCategoryRow>,
  category: BackfillCategoryRow,
): string {
  const names: string[] = [];
  const visited = new Set<string>(); // 순환 데이터여도 끝나게
  let current: BackfillCategoryRow | undefined = category;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    names.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return names.join(' > ');
}

export function planBackfill(
  posts: BackfillPostRow[],
  categories: BackfillCategoryRow[],
): BackfillPlan {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const byUserAndName = new Map<string, BackfillCategoryRow[]>();
  for (const c of categories) {
    const key = `${c.userId}\u0000${c.name}`;
    byUserAndName.set(key, [...(byUserAndName.get(key) ?? []), c]);
  }

  const plan: BackfillPlan = {
    links: [],
    unmatched: [],
    ambiguous: [],
    skipped: { noAuthor: 0, emptyCategory: 0 },
  };

  for (const post of posts) {
    if (!post.userId) {
      plan.skipped.noAuthor++;
      continue;
    }
    if (!post.category) {
      plan.skipped.emptyCategory++;
      continue;
    }
    const ref: PostRef = {
      postId: post.id,
      title: post.title,
      userId: post.userId,
      category: post.category,
    };
    const matches =
      byUserAndName.get(`${post.userId}\u0000${post.category}`) ?? [];
    if (matches.length === 1) {
      plan.links.push({ postId: post.id, categoryId: matches[0].id });
    } else if (matches.length === 0) {
      plan.unmatched.push(ref);
    } else {
      plan.ambiguous.push({
        ...ref,
        candidates: matches.map((c) => ({
          id: c.id,
          path: pathString(byId, c),
        })),
      });
    }
  }
  return plan;
}

// 사람이 읽는 요약 — 무엇을 이을지, 무엇이 남는지
export function formatPlan(
  plan: BackfillPlan,
  total: number,
  apply: boolean,
): string[] {
  const lines = [
    `대상 글(카테고리가 아직 지정되지 않은 글): ${total}개`,
    `  자동으로 ${apply ? '이음' : '이을 수 있음'}: ${plan.links.length}개 (작성자 카테고리 중 이름이 정확히 하나)`,
    `  직접 지정 필요 — 같은 이름이 둘 이상: ${plan.ambiguous.length}개`,
    `  이름이 맞는 카테고리 없음: ${plan.unmatched.length}개`,
    `  제외: 작성자 없음 ${plan.skipped.noAuthor}개, 카테고리 이름이 빈 글 ${plan.skipped.emptyCategory}개`,
  ];
  if (plan.ambiguous.length > 0) {
    lines.push(
      '',
      '[직접 지정 필요 — 글 이동 기능으로 어느 카테고리인지 정해 주세요]',
    );
    for (const a of plan.ambiguous) {
      lines.push(
        `  - ${a.postId} "${a.title || '(제목 없음)'}" — 이름 "${a.category}"`,
        ...a.candidates.map((c) => `      후보: ${c.path}  (${c.id})`),
      );
    }
  }
  if (plan.unmatched.length > 0) {
    lines.push(
      '',
      '[이름이 맞는 카테고리가 없음 — 카테고리가 지워졌거나 이름이 바뀐 글]',
    );
    for (const u of plan.unmatched) {
      lines.push(
        `  - ${u.postId} "${u.title || '(제목 없음)'}" — 이름 "${u.category}"`,
      );
    }
  }
  return lines;
}

type UpdateDeps = {
  updateMany: (args: {
    where: { id: { in: string[] }; categoryId: null };
    data: { categoryId: string };
  }) => Promise<{ count: number }>;
};

// 카테고리별로 묶어 한꺼번에 쓴다. where에 categoryId: null을 한 번 더 걸어서, 그 사이 사용자가 저장해 이미 지정된 글은 덮어쓰지 않는다.
export async function applyLinks(
  links: BackfillPlan['links'],
  deps: UpdateDeps,
): Promise<number> {
  const byCategory = new Map<string, string[]>();
  for (const l of links) {
    byCategory.set(l.categoryId, [
      ...(byCategory.get(l.categoryId) ?? []),
      l.postId,
    ]);
  }
  let updated = 0;
  for (const [categoryId, postIds] of byCategory) {
    const { count } = await deps.updateMany({
      where: { id: { in: postIds }, categoryId: null },
      data: { categoryId },
    });
    updated += count;
  }
  return updated;
}
