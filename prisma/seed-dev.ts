import { PrismaClient } from '@prisma/client';

// 로컬 개발 DB 시드 — 실행: scripts/dev-db.sh seed (여러 번 실행해도 안전: 같은 id는 덮어쓴다)
//
// 넣는 것
// 1. 배포된 사이트의 **공개 목록 API**에서 가져온 공개 글 (글 id·제목·본문·카테고리는 그대로).
//    작성자는 실제 사용자가 아니라 **가상의 개발용 사용자**(dev-user-a, dev-user-b …)로 바꿔 넣는다 — 실제 사용자 정보를 개발 DB에 옮기지 않는다.
// 2. 테스트용 글(id가 'dev-seed-'로 시작): **비공개 글·임시저장 글·다른 사용자의 공개/비공개 글**.
//    공개 범위 규칙(비공개 글이 남에게 안 보이는지)을 로컬에서 실제 데이터로 확인하려는 용도다. 특히 비공개 글 중 하나는
//    공개 도커 글과 내용이 비슷해서, "비슷해도 후보에서 빠지는지"를 시험할 수 있다.
// 3. 글의 카테고리 경로(categoryPath)로 만든 사용자별 카테고리 트리.

const BLOG_API_URL =
  process.env.BLOG_API_URL ?? 'https://inote-server-5a63.onrender.com/api/v1';
const PAGE_SIZE = 50;

// ── 안전장치: 로컬 개발 DB가 아니면 아무것도 하지 않는다 ─────────────────────────────
export function assertLocalDevDatabase(databaseUrl: string | undefined): void {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL이 없습니다. scripts/dev-db.sh seed 로 실행하세요.',
    );
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NODE_ENV=production에서는 시드를 실행하지 않습니다.');
  }
  const url = new URL(databaseUrl);
  const host = url.hostname;
  const database = url.pathname.replace(/^\//, '');
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) {
    throw new Error(
      `로컬 DB가 아닙니다(host=${host}). 개발 시드는 로컬 개발 DB에서만 실행합니다.`,
    );
  }
  if (!database.endsWith('_dev')) {
    throw new Error(
      `개발 DB 이름(…_dev)이 아닙니다(db=${database}). 개발 시드는 *_dev 데이터베이스에서만 실행합니다.`,
    );
  }
}

// ── 공개 API에서 공개 글 가져오기 ─────────────────────────────────────────────────────
type PublicPost = {
  id: string;
  title: string;
  content: string;
  excerpt: string | null;
  category: string;
  categoryPath?: string[];
  userId: string | null;
  createdAt: string;
  publishedAt: string | null;
  lastEditedAt: string | null;
  isPrivate: boolean;
  pinned: boolean;
};

type PostsPage = {
  pinned: PublicPost[];
  items: PublicPost[];
  totalPages: number;
  pinnedTotalPages: number;
};

async function fetchPage(query: string): Promise<PostsPage> {
  const res = await fetch(`${BLOG_API_URL}/blog/posts?${query}`, {
    signal: AbortSignal.timeout(90_000), // 무료 호스팅이 잠들어 있으면 첫 응답이 느리다
  });
  if (!res.ok) throw new Error(`공개 목록 API 오류: ${res.status}`);
  return (await res.json()) as PostsPage;
}

async function fetchPublicPosts(): Promise<PublicPost[]> {
  const posts = new Map<string, PublicPost>();
  const first = await fetchPage(`pageSize=${PAGE_SIZE}&page=1&pinnedPage=1`);
  [...first.pinned, ...first.items].forEach((p) => posts.set(p.id, p));
  for (let page = 2; page <= first.totalPages; page++) {
    (await fetchPage(`pageSize=${PAGE_SIZE}&page=${page}&pinnedPage=1`)).items
      .filter((p) => p)
      .forEach((p) => posts.set(p.id, p));
  }
  for (let pp = 2; pp <= first.pinnedTotalPages; pp++) {
    (await fetchPage(`pageSize=${PAGE_SIZE}&page=1&pinnedPage=${pp}`)).pinned
      .filter((p) => p)
      .forEach((p) => posts.set(p.id, p));
  }
  // 한 번 더 걸러서, 공개 API가 비공개·미발행 글을 줬더라도 개발 DB에는 넣지 않는다 (테스트용 비공개 글은 아래에서 직접 만든다)
  return [...posts.values()].filter((p) => !p.isPrivate && p.publishedAt);
}

// ── 개발용 가상 사용자 ────────────────────────────────────────────────────────────────
const DEV_USERS = [
  { id: 'dev-user-a', name: '개발용 사용자 A', email: 'dev-a@example.test' },
  { id: 'dev-user-b', name: '개발용 사용자 B', email: 'dev-b@example.test' },
  { id: 'dev-user-c', name: '개발용 사용자 C', email: 'dev-c@example.test' },
  { id: 'dev-user-d', name: '개발용 사용자 D', email: 'dev-d@example.test' },
];

// 실제 작성자 id → 가상 사용자 id. 글이 많은 작성자부터 a, b, … 순서로 배정한다 (작성자 없음(null)은 그대로 null)
function mapAuthors(posts: PublicPost[]): Map<string, string> {
  const counts = new Map<string, number>();
  posts.forEach((p) => {
    if (p.userId) counts.set(p.userId, (counts.get(p.userId) ?? 0) + 1);
  });
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > DEV_USERS.length) {
    throw new Error(`작성자가 ${ranked.length}명이라 가상 사용자가 모자랍니다.`);
  }
  return new Map(ranked.map(([realId], i) => [realId, DEV_USERS[i].id]));
}

// ── 테스트용 글 (공개 범위 확인용) ─────────────────────────────────────────────────────
type SeedPost = {
  id: string;
  userId: string;
  title: string;
  category: string;
  categoryPath: string[];
  content: string;
  isPrivate: boolean;
  published: boolean; // false면 임시저장(draft)
  daysAgo: number;
};

const TEST_POSTS: SeedPost[] = [
  {
    id: 'dev-seed-a-private-docker',
    userId: 'dev-user-a',
    title: '[dev-seed] 비공개 — 도커 볼륨으로 내 데이터 백업하기',
    category: 'DevOps',
    categoryPath: ['학습', 'DevOps'],
    isPrivate: true,
    published: true,
    daysAgo: 3,
    // 공개 도커 글과 내용이 비슷하다 — 비슷해도 남에게 후보로 나오면 안 된다
    content:
      '<h2>도커 볼륨 백업</h2><p>컨테이너를 지워도 데이터가 남도록 도커 볼륨을 마운트하고, 볼륨 내용을 tar로 묶어 백업한다.</p>' +
      '<p>개인 메모라 비공개로 둔다. docker run -v 로 볼륨을 붙이고, 백업용 임시 컨테이너에서 압축한다.</p>',
  },
  {
    id: 'dev-seed-a-private-career',
    userId: 'dev-user-a',
    title: '[dev-seed] 비공개 — 이직 연봉 협상 메모',
    category: '이직',
    categoryPath: ['이직'],
    isPrivate: true,
    published: true,
    daysAgo: 8,
    content:
      '<p>희망 연봉과 협상 순서를 정리한 개인 메모. 면접 후 오퍼를 받으면 현재 연봉, 희망 연봉, 스톡옵션 조건을 차례로 비교한다.</p>',
  },
  {
    id: 'dev-seed-a-draft',
    userId: 'dev-user-a',
    title: '[dev-seed] 쓰다 만 글 — 임베딩 테스트',
    category: '학습',
    categoryPath: ['학습'],
    isPrivate: false,
    published: false,
    daysAgo: 1,
    content:
      '<p>아직 발행하지 않은 임시저장 글. 벡터를 만들지 않아야 하는 대상이다.</p>',
  },
  {
    id: 'dev-seed-b-public',
    userId: 'dev-user-b',
    title: '[dev-seed] B 사용자의 공개 글 — React 상태 관리 비교',
    category: '프론트엔드',
    categoryPath: ['학습', '프론트엔드'],
    isPrivate: false,
    published: true,
    daysAgo: 5,
    content:
      '<h2>React 상태 관리</h2><p>useState와 Context, 그리고 서버 상태를 다루는 라이브러리의 역할을 비교한다.</p>',
  },
  {
    id: 'dev-seed-b-private',
    userId: 'dev-user-b',
    title: '[dev-seed] B 사용자의 비공개 메모 — 리액트 상태 관리 고민',
    category: '프론트엔드',
    categoryPath: ['학습', '프론트엔드'],
    isPrivate: true,
    published: true,
    daysAgo: 2,
    // B의 공개 글과 비슷하다 — 다른 사용자(A)에게는 후보로 나오면 안 된다
    content:
      '<p>리액트에서 전역 상태를 어떻게 나눌지 고민한 개인 메모. 컨텍스트로 충분한지, 별도 상태 관리 라이브러리가 필요한지 정리 중.</p>',
  },
];

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function main() {
  assertLocalDevDatabase(process.env.DATABASE_URL);
  const prisma = new PrismaClient();

  try {
    console.log(`공개 글 가져오는 중: ${BLOG_API_URL}`);
    const publicPosts = await fetchPublicPosts();
    const authorMap = mapAuthors(publicPosts);
    console.log(
      `공개 글 ${publicPosts.length}개, 작성자 ${authorMap.size}명 → 가상 사용자로 대체`,
    );

    // 1) 가상 사용자
    for (const u of DEV_USERS) {
      await prisma.user.upsert({
        where: { id: u.id },
        update: { name: u.name },
        create: { ...u, emailVerified: true, usesInote: true },
      });
    }

    // 2) 사용자별 카테고리 트리 — 글의 categoryPath로 만든다 (같은 사용자·부모·이름이면 재사용)
    const categoryCache = new Map<string, string>(); // "userId|parentId|name" → category id
    async function ensureCategories(userId: string, path: string[]) {
      let parentId: string | null = null;
      for (let i = 0; i < path.length; i++) {
        const key = `${userId}|${parentId ?? ''}|${path[i]}`;
        let id = categoryCache.get(key);
        if (!id) {
          const found = await prisma.postCategory.findFirst({
            where: { userId, parentId, name: path[i] },
          });
          id = (
            found ??
            (await prisma.postCategory.create({
              data: { userId, parentId, name: path[i], depth: i + 1 },
            }))
          ).id;
          categoryCache.set(key, id);
        }
        parentId = id;
      }
    }

    // 3) 공개 글
    for (const p of publicPosts) {
      const userId = p.userId ? (authorMap.get(p.userId) ?? null) : null;
      if (userId) {
        await ensureCategories(
          userId,
          p.categoryPath?.length ? p.categoryPath : [p.category],
        );
      }
      const data = {
        title: p.title,
        content: p.content,
        excerpt: p.excerpt,
        category: p.category,
        userId,
        createdAt: new Date(p.createdAt),
        publishedAt: new Date(p.publishedAt as string),
        lastEditedAt: p.lastEditedAt ? new Date(p.lastEditedAt) : null,
        isPrivate: false,
        pinned: p.pinned,
      };
      await prisma.post.upsert({
        where: { id: p.id },
        update: data,
        create: { id: p.id, ...data },
      });
    }

    // 4) 테스트용 글
    for (const t of TEST_POSTS) {
      await ensureCategories(t.userId, t.categoryPath);
      const published = t.published ? daysAgo(t.daysAgo) : null;
      const data = {
        title: t.title,
        content: t.content,
        category: t.category,
        userId: t.userId,
        createdAt: daysAgo(t.daysAgo),
        publishedAt: published,
        lastEditedAt: published,
        isPrivate: t.isPrivate,
        pinned: false,
      };
      await prisma.post.upsert({
        where: { id: t.id },
        update: data,
        create: { id: t.id, ...data },
      });
    }

    // 요약
    const [users, categories, total, pub, priv, draft] = await Promise.all([
      prisma.user.count(),
      prisma.postCategory.count(),
      prisma.post.count(),
      prisma.post.count({
        where: { publishedAt: { not: null }, isPrivate: false },
      }),
      prisma.post.count({
        where: { publishedAt: { not: null }, isPrivate: true },
      }),
      prisma.post.count({ where: { publishedAt: null } }),
    ]);
    console.log(
      `\n완료 — 사용자 ${users}명, 카테고리 ${categories}개, 글 ${total}개 (공개 ${pub} · 비공개 ${priv} · 임시저장 ${draft})`,
    );
    console.log(
      `테스트용 글: ${TEST_POSTS.map((t) => t.id).join(', ')}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
