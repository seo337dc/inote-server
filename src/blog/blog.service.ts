import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  deletePostEmbedding,
  isEmbeddingsEnabled,
  isEmptyPost,
  upsertPostEmbedding,
} from '../embeddings/inote-ai-embeddings';
import {
  findCandidateIds,
  publicCandidatesWhere,
  readableCandidatesWhere,
} from '../embeddings/embedding-candidates';
import { findSimilarPosts } from '../embeddings/similar-posts';
import { UpdatePostDto } from './dto/update-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';

const AUTHOR_SELECT = { user: { select: { name: true, email: true } } };
const DETAIL_INCLUDE = {
  ...AUTHOR_SELECT,
  aiSummary: { select: { summary: true } },
};

// 목록·트리 정렬: 마지막으로 저장(발행)한 글이 위로. draft는 lastEditedAt이 null이라 맨 뒤로 보내고
// (Postgres는 DESC에서 null을 맨 앞에 두므로 nulls: 'last' 명시), 같으면 생성순.
const LIST_ORDER: Prisma.PostOrderByWithRelationInput[] = [
  { lastEditedAt: { sort: 'desc', nulls: 'last' } },
  { createdAt: 'desc' },
];

const EMPTY_CONTENT = ['', '<p></p>'];
const PINNED_PAGE_SIZE = 3;
const OUTLINE_LIMIT = 500;

// 검색어가 있으면 제목 또는 본문에 들어 있는 글만 (대소문자 무시). 본문은 HTML 그대로라
// 태그 이름(strong 등)으로 검색하면 걸릴 수 있다 — 필요해지면 텍스트 전용 컬럼을 따로 둔다.
function searchWhere(q?: string): Prisma.PostWhereInput {
  if (!q) return {};
  return {
    OR: [
      { title: { contains: q, mode: 'insensitive' } },
      { content: { contains: q, mode: 'insensitive' } },
    ],
  };
}

// 두 조건을 한 where로 합친다. 카테고리 필터(하위 카테고리 포함)와 검색은 둘 다 최상위 OR을 쓸 수 있어
// 그냥 펼치면 서로 덮어쓰므로, 둘 다 OR일 때만 AND로 묶는다 (아니면 평평하게 합쳐 기존 모양 유지).
function combineWhere(
  a: Prisma.PostWhereInput,
  b: Prisma.PostWhereInput,
): Prisma.PostWhereInput {
  return a.OR && b.OR ? { AND: [a, b] } : { ...a, ...b };
}

type CategoryRow = { id: string; name: string; parentId: string | null };

// 작성자 한 명의 카테고리 목록(깊이·생성순으로 정렬돼 있어야 함)에서 name의 경로를 만든다 — 최상위부터 name까지의 이름.
// 같은 이름이 여러 곳이면 목록에서 먼저 나온 것(가장 얕고 먼저 만든 것)을 쓴다. 목록에 없으면 [name].
function pathOf(categories: CategoryRow[], name: string): string[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const path: string[] = [];
  const visited = new Set<string>(); // 잘못된 순환 데이터여도 무한 루프에 빠지지 않게
  let current = categories.find((c) => c.name === name);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path.length > 0 ? path : [name];
}

// 제목도 본문도 없는 발행 전 글 — 글쓰기 화면에 들어오기만 해도 생기는 빈 draft라서
// 목록·알림에는 draft로 취급하지 않는다 (사용자가 뭐라도 쓰면 그때부터 draft).
const EMPTY_DRAFT: Prisma.PostWhereInput = {
  publishedAt: null,
  title: '',
  content: { in: EMPTY_CONTENT },
};

@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);

  constructor(private readonly prisma: PrismaService) {}

  // 고정 글과 일반 글을 각각 따로 페이지네이션한다.
  // - 고정 글: PINNED_PAGE_SIZE(3)개씩, pinnedPage 페이지 (기본 1)
  // - 일반 글: 고정 글을 모두 뺀 나머지를 pageSize개씩, page 페이지 (기본 1)
  // 쿼리에 아무것도 없으면 두 영역 모두 1페이지. total은 고정 + 일반 전체 개수.
  private async listPage(
    baseWhere: Prisma.PostWhereInput,
    { page = 1, pageSize = 10, pinnedPage = 1 }: ListPostsQueryDto,
  ) {
    const pinnedWhere: Prisma.PostWhereInput = { ...baseWhere, pinned: true };
    const listWhere: Prisma.PostWhereInput = { ...baseWhere, pinned: false };

    // findMany 호출 순서: 1) 고정 글 2) 일반 글 / count 호출 순서: 1) 고정 글 2) 일반 글
    const [pinned, pinnedTotal, items, listTotal] = await Promise.all([
      this.prisma.post.findMany({
        where: pinnedWhere,
        orderBy: LIST_ORDER,
        skip: (pinnedPage - 1) * PINNED_PAGE_SIZE,
        take: PINNED_PAGE_SIZE,
        include: AUTHOR_SELECT,
      }),
      this.prisma.post.count({ where: pinnedWhere }),
      this.prisma.post.findMany({
        where: listWhere,
        orderBy: LIST_ORDER,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: AUTHOR_SELECT,
      }),
      this.prisma.post.count({ where: listWhere }),
    ]);

    const [pinnedWithPath, itemsWithPath] = await Promise.all([
      this.withCategoryPaths(pinned),
      this.withCategoryPaths(items),
    ]);

    return {
      pinned: pinnedWithPath,
      pinnedPage,
      pinnedTotal,
      pinnedTotalPages: Math.max(1, Math.ceil(pinnedTotal / PINNED_PAGE_SIZE)),
      items: itemsWithPath,
      total: pinnedTotal + listTotal,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(listTotal / pageSize)),
    };
  }

  // 전체 공개 글. userId를 주면 그 작성자의 공개 글만 보고, 응답에 그 작성자(author)를 함께 준다 —
  // 글이 0개(검색 결과 없음 포함)여도 화면 제목에 이름을 쓸 수 있고, 없는 사용자면 author가 null이다.
  async findAll(query: ListPostsQueryDto) {
    const where: Prisma.PostWhereInput = {
      publishedAt: { not: null },
      isPrivate: false,
      ...(query.userId ? { userId: query.userId } : {}),
      ...combineWhere(
        await this.categoryFilter(query.category),
        searchWhere(query.q),
      ),
    };
    if (!query.userId) return this.listPage(where, query);

    const [page, author, summary] = await Promise.all([
      this.listPage(where, query),
      this.prisma.user.findUnique({
        where: { id: query.userId },
        select: { id: true, name: true },
      }),
      this.publicCategorySummary(query.userId),
    ]);
    return { ...page, author, ...summary };
  }

  // 작성자 페이지의 카테고리 목록 — 그 사람의 카테고리 중 "공개 글이 있는 것"(그 아래 하위에 있는 경우 포함)과
  // 공개 글의 카테고리별 개수(직속, 이름 기준). 비공개 글만 있는 카테고리는 이름도 내려가지 않는다.
  // 개수는 목록의 category·q 필터와 상관없이 그 사람의 공개 글 전체 기준이다 (나의 글의 categoryCounts와 같은 방식).
  private async publicCategorySummary(userId: string) {
    const [grouped, rows] = await Promise.all([
      this.prisma.post.groupBy({
        by: ['category'],
        where: { userId, publishedAt: { not: null }, isPrivate: false },
        _count: { _all: true },
      }),
      this.prisma.postCategory.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          parentId: true,
          depth: true,
          createdAt: true,
        },
        orderBy: [{ depth: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    const categoryCounts = Object.fromEntries(
      grouped.map((g) => [g.category, g._count._all]),
    );

    const childrenOf = new Map<string, typeof rows>();
    for (const row of rows) {
      if (row.parentId) {
        childrenOf.set(row.parentId, [
          ...(childrenOf.get(row.parentId) ?? []),
          row,
        ]);
      }
    }
    // 자기 직속 글이 있거나 하위 중 하나라도 공개 글이 있으면 보인다 (순환 데이터여도 끝나게 방문 기록을 둔다)
    const hasPublicPosts = (
      row: (typeof rows)[number],
      visited = new Set<string>(),
    ): boolean => {
      if (visited.has(row.id)) return false;
      visited.add(row.id);
      return (
        (categoryCounts[row.name] ?? 0) > 0 ||
        (childrenOf.get(row.id) ?? []).some((child) =>
          hasPublicPosts(child, visited),
        )
      );
    };

    return {
      categories: rows.filter((row) => hasPublicPosts(row)),
      categoryCounts,
    };
  }

  // 카테고리 이름으로 거르는 조건 — 그 카테고리의 글과 그 아래(하위) 카테고리의 글을 모두 포함한다.
  // 글의 category는 이름 문자열이라, 하위 여부는 "글 작성자의" 카테고리 트리에서 판단한다 (작성자마다 트리가 다름).
  // - 이름이 같은 카테고리가 트리 여러 곳에 있으면(생성 시 중복을 막지 않음) 각각의 하위를 모두 합친다
  // - 하위가 없거나 트리에 없는 이름이면 예전처럼 { category: name } 정확 일치
  // ownerUserId를 주면 그 사용자의 트리만 본다 (내 글 목록), 없으면 그 이름을 가진 카테고리가 있는 모든 작성자의 트리를 본다 (공개 목록).
  private async categoryFilter(
    name: string | undefined,
    ownerUserId?: string,
  ): Promise<Prisma.PostWhereInput> {
    if (!name) return {};

    const categories = await this.prisma.postCategory.findMany({
      where: ownerUserId
        ? { userId: ownerUserId }
        : { user: { categories: { some: { name } } } },
      select: { id: true, userId: true, name: true, parentId: true },
    });

    // 작성자별로 트리를 따로 훑어 name 아래의 하위 카테고리 이름을 모은다
    const childrenOf = new Map<string, typeof categories>();
    for (const c of categories) {
      if (!c.parentId) continue;
      childrenOf.set(c.parentId, [...(childrenOf.get(c.parentId) ?? []), c]);
    }
    const descendantsByUser = new Map<string, Set<string>>();
    for (const root of categories.filter((c) => c.name === name)) {
      const names = descendantsByUser.get(root.userId) ?? new Set<string>();
      const visited = new Set<string>([root.id]); // 순환 데이터여도 무한 루프에 빠지지 않게
      const queue = [root];
      for (let node = queue.shift(); node; node = queue.shift()) {
        for (const child of childrenOf.get(node.id) ?? []) {
          if (visited.has(child.id)) continue;
          visited.add(child.id);
          names.add(child.name);
          queue.push(child);
        }
      }
      descendantsByUser.set(root.userId, names);
    }

    const perUser = [...descendantsByUser]
      .map(([userId, names]) => ({ userId, names: [...names] }))
      .filter(({ names }) => names.length > 0);
    if (perUser.length === 0) return { category: name };

    if (ownerUserId) {
      return { category: { in: [name, ...perUser[0].names] } };
    }
    return {
      OR: [
        { category: name },
        ...perUser.map(({ userId, names }) => ({
          userId,
          category: { in: names },
        })),
      ],
    };
  }

  // 내 글 상세 왼쪽 카테고리 트리용 — 본문 없이 제목·카테고리만 가볍게 내려준다.
  // 내가 발행한 글만(비공개 포함). draft는 제외. 다른 사람의 글 상세는 findUserOutline이 맡는다.
  findOutline(userId: string) {
    return this.prisma.post.findMany({
      where: { userId, publishedAt: { not: null } },
      select: {
        id: true,
        title: true,
        category: true,
        isPrivate: true,
        pinned: true,
      },
      orderBy: LIST_ORDER,
      take: OUTLINE_LIMIT,
    });
  }

  // 글 조회 없이 존재만 확인 — update/remove가 소유권 체크 전에 씀.
  // (draft 노출 제한과 무관하게, 작성자 본인은 항상 자기 글을 가져올 수 있어야 함)
  private async findRaw(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!post) throw new NotFoundException('글을 찾을 수 없습니다.');
    return post;
  }

  // 공개 조회 — 발행+ 비공개 아닌 글은 누구나, draft·비공개 글은 작성자 본인만
  // (그 외엔 404로 존재 자체를 숨김)
  async findOne(id: string, requesterUserId?: string) {
    const post = await this.findRaw(id);
    const hiddenFromOthers = !post.publishedAt || post.isPrivate;
    if (hiddenFromOthers && post.userId !== requesterUserId) {
      throw new NotFoundException('글을 찾을 수 없습니다.');
    }
    return { ...post, categoryPath: await this.buildCategoryPath(post) };
  }

  // 공개 글 id 목록 — inote-ai의 글 목록 채팅("글 찾기")이 검색 후보로 쓴다(내부 전용, 비밀키 필요). 공개 여부의 판정은 항상 BE가 한다:
  // 발행됨 AND 공개인 글만. 최근 저장순, 최대 5000개(embedding-candidates의 상한). 설계: inote 레포 docs/kure/PLAN.md 결정 17.
  async listPublicPostIds() {
    const ids = await findCandidateIds(
      this.prisma,
      publicCandidatesWhere(),
      this.logger,
    );
    return { ids };
  }

  // 글 상세 아래 "비슷한 글" — 이 글과 뜻이 가까운, 요청자가 볼 수 있는 글. 설계: inote 레포 docs/kure/PLAN.md 6절 B.
  // 1) 이 글을 볼 권한을 상세와 같은 규칙으로 확인(없으면 404) → 2) 후보 = 발행됨 AND (공개 OR 내 글), 이 글 제외
  // → 3) inote-ai가 후보 안에서만 순위를 매겨 돌려줌 → 4) 글 정보를 붙임. AI 장애·벡터 없음·기준 미달은 오류가 아니라 빈 목록.
  // 응답이 요청자마다 달라서(내 비공개 글이 후보에 들어감) 컨트롤러가 캐시를 금지한다.
  async findSimilar(
    id: string,
    requesterUserId: string | undefined,
    limit: number,
  ) {
    const source = await this.prisma.post.findUnique({
      where: { id },
      select: { userId: true, publishedAt: true, isPrivate: true },
    });
    const hiddenFromOthers = !source || !source.publishedAt || source.isPrivate;
    if (!source || (hiddenFromOthers && source.userId !== requesterUserId)) {
      throw new NotFoundException('글을 찾을 수 없습니다.');
    }
    // 아직 발행 전인 글(내 draft)은 벡터가 없고, 꺼져 있으면 AI를 부르지 않으니 후보를 계산할 이유도 없다
    if (!source.publishedAt || !isEmbeddingsEnabled()) return { items: [] };

    const visible = readableCandidatesWhere(requesterUserId, id);
    const candidateIds = await findCandidateIds(
      this.prisma,
      visible,
      this.logger,
    );
    const similar = await findSimilarPosts(
      { postId: id, candidateIds, limit },
      this.logger,
    );
    if (similar.length === 0) return { items: [] };

    // 글 정보를 읽을 때 **읽기 규칙을 다시 건다** — 그 사이 비공개로 바뀐 글이나 AI가 잘못 보낸 id는 여기서도 걸러진다
    const posts = await this.prisma.post.findMany({
      where: { AND: [visible, { id: { in: similar.map((s) => s.postId) } }] },
      select: {
        id: true,
        title: true,
        category: true,
        userId: true,
        isPrivate: true,
        user: { select: { name: true } },
      },
    });
    const withPaths = await this.withCategoryPaths(posts);
    const byId = new Map(withPaths.map((p) => [p.id, p]));

    const items = similar.flatMap(({ postId, score }) => {
      const post = byId.get(postId);
      if (!post) return []; // 그 사이 지워졌거나 볼 수 없게 된 글
      const isMine = !!requesterUserId && post.userId === requesterUserId;
      return [
        {
          id: post.id,
          title: post.title,
          category: post.category,
          categoryPath: post.categoryPath,
          isMine,
          isPrivate: isMine && post.isPrivate,
          user: post.user ? { name: post.user.name } : null,
          score,
        },
      ];
    });
    return { items };
  }

  // 글 상세의 카테고리 경로 — 작성자의 카테고리 트리에서 최상위부터 이 글의 카테고리까지의 이름 (예: ['학습', 'AI']).
  // 글의 category는 이름 문자열이라 작성자의 PostCategory 중 이름이 같은 것을 찾아 parentId를 따라 올라간다.
  // 트리에서 못 찾으면(작성자 탈퇴, 트리 미생성 등) [category], category가 비어 있으면 [].
  private async buildCategoryPath(post: {
    userId: string | null;
    category: string;
  }): Promise<string[]> {
    if (!post.category) return [];
    if (!post.userId) return [post.category];

    const categories = await this.prisma.postCategory.findMany({
      where: { userId: post.userId },
      select: { id: true, name: true, parentId: true },
      orderBy: [{ depth: 'asc' }, { createdAt: 'asc' }],
    });
    return pathOf(categories, post.category);
  }

  // 목록의 각 글에 categoryPath를 붙인다 — 이번 페이지 글들의 작성자(보통 소수) 카테고리를 한 번에 읽어 글마다 경로를 만든다.
  // 작성자가 없거나 category가 빈 글은 조회 없이 각각 [category] / []. 대상이 하나도 없으면 DB를 읽지 않는다.
  private async withCategoryPaths<
    T extends { userId: string | null; category: string },
  >(posts: T[]): Promise<(T & { categoryPath: string[] })[]> {
    const userIds = [
      ...new Set(
        posts.filter((p) => p.category && p.userId).map((p) => p.userId!),
      ),
    ];
    const byUser = new Map<string, CategoryRow[]>();
    if (userIds.length > 0) {
      const rows = await this.prisma.postCategory.findMany({
        where: { userId: { in: userIds } },
        select: { id: true, userId: true, name: true, parentId: true },
        orderBy: [{ depth: 'asc' }, { createdAt: 'asc' }],
      });
      for (const row of rows) {
        byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]);
      }
    }
    return posts.map((post) => ({
      ...post,
      categoryPath: !post.category
        ? []
        : post.userId
          ? pathOf(byUser.get(post.userId) ?? [], post.category)
          : [post.category],
    }));
  }

  // inote-ai가 대화 기록 접근 제어에 쓰는 내부 전용 조회 — 존재 안 하면 null.
  async getOwnerId(id: string): Promise<string | null> {
    const post = await this.prisma.post.findUnique({ where: { id } });
    return post?.userId ?? null;
  }

  // 다른 사람의 글 상세 왼쪽 카테고리 트리용 — 그 작성자의 공개 글(발행, 비공개 제외)과 공개 글이 있는 카테고리.
  // 요청자가 누구든(작성자 본인이라도) 공개된 것만 준다. 없는 사용자면 author가 null이고 나머지는 비어 있다.
  async findUserOutline(userId: string) {
    const [author, posts, summary] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true },
      }),
      this.prisma.post.findMany({
        where: { userId, publishedAt: { not: null }, isPrivate: false },
        select: {
          id: true,
          title: true,
          category: true,
          isPrivate: true,
          pinned: true,
        },
        orderBy: { createdAt: 'desc' },
        take: OUTLINE_LIMIT,
      }),
      this.publicCategorySummary(userId),
    ]);
    return { author, categories: summary.categories, posts };
  }

  // 카테고리 관리의 '글 이동' 탭용 — 내 글 전부(임시저장 포함, 빈 임시저장 제외)를 본문 없이 가볍게. 최신순, 최대 OUTLINE_LIMIT개.
  // 공개 글 트리용 findOutline과 달리 내 글만이고 임시저장(publishedAt null)도 담긴다.
  findMyOutline(userId: string) {
    return this.prisma.post.findMany({
      where: { userId, NOT: EMPTY_DRAFT },
      select: {
        id: true,
        title: true,
        category: true,
        isPrivate: true,
        publishedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: OUTLINE_LIMIT,
    });
  }

  findMyDrafts(userId: string) {
    return this.prisma.post.findMany({
      where: { userId, publishedAt: null, NOT: EMPTY_DRAFT },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // 나의 글 목록 — 발행·비공개 여부 상관없이 내가 쓴 글 전부 (/my-posts에서 사용).
  // 사이드바 카테고리별 개수는 페이지와 무관한 전체 기준이라 categoryCounts로 따로 내려줌.
  async findMine(userId: string, query: ListPostsQueryDto) {
    const categoryFilter = await this.categoryFilter(query.category, userId);
    const [page, grouped] = await Promise.all([
      this.listPage(
        {
          userId,
          NOT: EMPTY_DRAFT,
          ...combineWhere(categoryFilter, searchWhere(query.q)),
        },
        query,
      ),
      this.prisma.post.groupBy({
        by: ['category'],
        where: { userId, NOT: EMPTY_DRAFT },
        _count: { _all: true },
      }),
    ]);
    const categoryCounts = Object.fromEntries(
      grouped.map((g) => [g.category, g._count._all]),
    );
    return { ...page, categoryCounts };
  }

  // 글쓰기 화면에 들어올 때마다 새 행이 쌓이지 않도록, 이미 비어 있는 draft가 있으면 그걸 재사용.
  async createDraft(userId: string) {
    const emptyDraft = await this.prisma.post.findFirst({
      where: { userId, ...EMPTY_DRAFT },
      orderBy: { updatedAt: 'desc' },
    });
    if (emptyDraft) return emptyDraft;

    return this.prisma.post.create({
      data: { title: '', content: '', category: '', userId },
    });
  }

  // 저장 요청의 카테고리를 글에 쓸 값({ categoryId, category })으로 바꾼다. 아무것도 안 보냈으면 {} (카테고리는 그대로).
  // - categoryId가 오면 그 카테고리가 "내 것"인지 확인하고(없거나 남의 것이면 404) 이름 사본을 거기서 가져온다. 이름이 같이 와도 무시.
  // - 이름(category)만 오는 건 이전 방식(전환 기간): 내 카테고리 중 그 이름이 정확히 하나면 그 id를 잇고,
  //   하나도 없거나 여럿(같은 이름이 두 곳)이면 id는 비운다 — 어느 쪽인지 알 수 없는 글을 임의로 잇지 않는다.
  private async resolveCategory(
    userId: string,
    input: { category?: string; categoryId?: string },
  ): Promise<{ categoryId?: string | null; category?: string }> {
    if (input.categoryId !== undefined) {
      const found = await this.prisma.postCategory.findUnique({
        where: { id: input.categoryId },
      });
      if (!found || found.userId !== userId) {
        throw new NotFoundException('카테고리를 찾을 수 없습니다.');
      }
      return { categoryId: found.id, category: found.name };
    }
    if (input.category !== undefined) {
      const sameName = await this.prisma.postCategory.findMany({
        where: { userId, name: input.category },
        select: { id: true },
      });
      return {
        category: input.category,
        categoryId: sameName.length === 1 ? sameName[0].id : null,
      };
    }
    return {};
  }

  // publish가 true일 때만 진짜 저장(발행 + AI 요약 갱신). 그 외엔 임시저장 — 내용만 갱신하고
  // 발행 상태·요약은 건드리지 않는다 (자동저장이 Groq를 계속 호출하지 않도록).
  async update(userId: string, id: string, dto: UpdatePostDto) {
    const post = await this.findRaw(id);
    if (post.userId !== userId) {
      throw new ForbiddenException('본인이 작성한 글만 수정할 수 있습니다.');
    }
    const { publish, category, categoryId, ...fields } = dto;
    // 카테고리는 id로 가리킨다 — 이름 사본(Post.category)은 서버가 채운다. 안 보냈으면 카테고리는 건드리지 않는다
    const categoryData = await this.resolveCategory(userId, {
      category,
      categoryId,
    });
    // 진짜 저장(발행)일 때만 lastEditedAt을 갱신 — 첫 발행이면 publishedAt과 같은 시각으로 맞춘다
    const now = new Date();
    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        ...fields,
        ...categoryData,
        ...(publish
          ? { publishedAt: post.publishedAt ?? now, lastEditedAt: now }
          : {}),
      },
      include: DETAIL_INCLUDE,
    });

    if (publish) {
      // 임베딩은 기다리지 않는다(약 5초) — 요약과 동시에 시작만 하고, 실패해도 저장 응답엔 영향이 없다
      this.syncEmbedding(updated);
      await this.summarize(updated.id, updated.title, updated.content);
    }

    return updated;
  }

  async remove(userId: string, id: string) {
    const post = await this.findRaw(id);
    if (post.userId !== userId) {
      throw new ForbiddenException('본인이 작성한 글만 삭제할 수 있습니다.');
    }
    const deleted = await this.prisma.post.delete({ where: { id } });
    // 벡터 삭제는 기다리지 않는다 — 실패하면 고아 벡터가 남지만 후보 id에 없어서 노출되지 않는다
    void deletePostEmbedding(id, this.logger);
    await this.deleteAiSession(id);
    return deleted;
  }

  // 저장(발행)한 글의 벡터를 inote-ai에 맞춘다 — 기다리지 않고 시작만 한다 (실패해도 던지지 않음).
  // 제목도 본문도 빈 글만 제외한다: 새로 만들 벡터가 없으니, 이전 벡터가 남아 있으면 지운다.
  // 공개↔비공개 전환·임시저장은 이 함수를 부르지 않는다 (벡터에 공개 여부가 없고 후보 id는 BE가 정한다).
  private syncEmbedding(post: { id: string; title: string; content: string }) {
    if (isEmptyPost(post.title, post.content)) {
      void deletePostEmbedding(post.id, this.logger);
    } else {
      void upsertPostEmbedding(post.id, post.title, post.content, this.logger);
    }
  }

  // 글쓰기 세션의 id는 post_id를 그대로 쓰므로, 글이 삭제되면 그 세션(+대화 기록)도 같이
  // 지워달라고 inote-ai에 요청. 실패해도 글 삭제 자체는 이미 끝난 뒤라 막지 않는다
  // (요약 호출 실패 처리와 동일한 fail-open 패턴).
  private async deleteAiSession(postId: string) {
    try {
      const res = await fetch(
        `${process.env.INOTE_AI_URL}/sessions/${postId}`,
        {
          method: 'DELETE',
          headers: { 'x-internal-secret': process.env.INTERNAL_SECRET ?? '' },
        },
      );
      if (!res.ok) throw new Error(`inote-ai responded ${res.status}`);
    } catch (e) {
      this.logger.warn(
        `failed to delete inote-ai session for post ${postId}: ${e}`,
      );
    }
  }

  // 저장 직후 inote-ai에 요약을 요청해 PostSummary에 반영.
  // AI 서버 장애가 글 저장 자체를 막으면 안 되므로 실패해도 예외를 던지지 않는다.
  // inote-ai에 요약을 요청하고 결과를 저장해 돌려준다 — 실패하면 예외를 던진다.
  private async requestSummary(
    postId: string,
    title: string,
    content: string,
  ): Promise<string[]> {
    const res = await fetch(`${process.env.INOTE_AI_URL}/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_SECRET ?? '',
      },
      body: JSON.stringify({ title, content }),
    });
    if (!res.ok) throw new Error(`inote-ai responded ${res.status}`);

    const { summary } = (await res.json()) as { summary: string[] };
    // AI가 빈 요약을 주면 기존 요약을 빈 값으로 덮어쓰지 않고 그대로 둔다.
    if (!Array.isArray(summary) || summary.length === 0) {
      throw new Error('inote-ai returned an empty summary');
    }
    await this.prisma.postSummary.upsert({
      where: { postId },
      create: { postId, summary },
      update: { summary },
    });
    return summary;
  }

  // 저장/발행 때 자동으로 도는 요약 — 실패해도 저장 자체는 성공해야 하므로 fail-open.
  private async summarize(postId: string, title: string, content: string) {
    if (EMPTY_CONTENT.includes(content)) return;

    try {
      await this.requestSummary(postId, title, content);
    } catch (e) {
      this.logger.warn(`failed to summarize post ${postId}: ${e}`);
    }
  }

  // 작성자가 직접 누르는 "AI 다시 요약하기" — 저장된 본문 기준. 자동 요약과 달리 실패를 그대로 알려준다.
  async resummarize(userId: string, id: string) {
    const post = await this.findRaw(id);
    if (post.userId !== userId) {
      throw new ForbiddenException(
        '본인이 작성한 글만 다시 요약할 수 있습니다.',
      );
    }
    if (EMPTY_CONTENT.includes(post.content)) {
      throw new BadRequestException('본문이 비어 있어 요약할 수 없습니다.');
    }

    try {
      const summary = await this.requestSummary(id, post.title, post.content);
      return { summary };
    } catch (e) {
      this.logger.warn(`failed to re-summarize post ${id}: ${e}`);
      throw new BadGatewayException(
        'AI 요약에 실패했어요. 잠시 후 다시 시도해 주세요.',
      );
    }
  }
}
