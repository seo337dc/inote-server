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
import { R2Service } from '../uploads/r2.service';
import { applyPromotions, planPromotions, type Promotion } from './post-images';
import { UpdatePostDto } from './dto/update-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';

const AUTHOR_SELECT = { user: { select: { name: true, email: true } } };
const DETAIL_INCLUDE = {
  ...AUTHOR_SELECT,
  aiSummary: { select: { summary: true } },
};

// 목록·트리 정렬: 새로 쓴(생성한) 글이 위로. 예전에는 마지막 저장 시각(lastEditedAt)순이라 글을 고치면 맨 위로
// 올라왔는데, 목록이 수정 때마다 뒤바뀌지 않게 생성순으로 바꿨다 (2026-10-21). lastEditedAt은 화면의 "수정일" 표시용으로만 남는다.
const LIST_ORDER: Prisma.PostOrderByWithRelationInput[] = [
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

// 글 목록·상세의 카테고리 경로 한 칸 — 링크를 이름이 아니라 id로 걸 수 있게 id를 같이 준다.
// id가 null인 칸은 아직 카테고리가 지정되지 않은 글(이름 사본만 있음)을 뜻한다.
type CategoryPathItem = { id: string | null; name: string };

// 카테고리별 글 수 맵에서 카테고리가 지정되지 않은 글(categoryId null)을 세는 키
const UNASSIGNED_KEY = 'unassigned';

// groupBy(categoryId) 결과를 { [categoryId]: 개수 } 맵으로 — categoryId가 null인 글은 UNASSIGNED_KEY로 센다.
function countsByCategoryId(
  grouped: { categoryId: string | null; _count: { _all: number } }[],
): Record<string, number> {
  return Object.fromEntries(
    grouped.map((g) => [g.categoryId ?? UNASSIGNED_KEY, g._count._all]),
  );
}

// 글의 카테고리 경로 — 작성자 카테고리 목록에서 post.categoryId부터 부모를 따라 올라가 최상위부터 이 글의 카테고리까지.
// 같은 이름이 여러 곳에 있어도 id로 찾으니 섞이지 않는다.
// - categoryId가 없으면(아직 지정 안 된 글): 이름 사본이 있으면 [{ id: null, name }], 없으면 []
// - id는 있는데 목록에서 못 찾으면(작성자 탈퇴 등으로 트리를 못 읽음): [{ id, name: 이름 사본 }], 이름 사본도 없으면 []
function pathOf(
  categories: CategoryRow[],
  post: { category: string; categoryId: string | null },
): CategoryPathItem[] {
  if (!post.categoryId) {
    return post.category ? [{ id: null, name: post.category }] : [];
  }
  const byId = new Map(categories.map((c) => [c.id, c]));
  const path: CategoryPathItem[] = [];
  const visited = new Set<string>(); // 잘못된 순환 데이터여도 무한 루프에 빠지지 않게
  let current = byId.get(post.categoryId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift({ id: current.id, name: current.name });
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  if (path.length > 0) return path;
  return post.category ? [{ id: post.categoryId, name: post.category }] : [];
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2Service,
  ) {}

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
        await this.categoryFilter(query.categoryId),
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
  // 공개 글의 카테고리별 개수(직속, 카테고리 id 기준 — 아직 지정 안 된 글은 'unassigned'). 비공개 글만 있는 카테고리는 이름도 내려가지 않는다.
  // 개수는 목록의 category·q 필터와 상관없이 그 사람의 공개 글 전체 기준이다 (나의 글의 categoryCounts와 같은 방식).
  private async publicCategorySummary(userId: string) {
    const [grouped, rows] = await Promise.all([
      this.prisma.post.groupBy({
        by: ['categoryId'],
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
    const categoryCounts = countsByCategoryId(grouped);

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
        (categoryCounts[row.id] ?? 0) > 0 ||
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

  // 카테고리 id로 거르는 조건 — 그 카테고리의 글과 그 아래(하위) 카테고리의 글을 모두 포함한다.
  // 글은 카테고리 id(Post.categoryId)로 가리키므로 같은 이름이 다른 부모 아래 있어도 섞이지 않는다.
  // 하위는 그 카테고리 **주인의** 트리에서 찾는다. ownerUserId를 주면(내 글 목록) 그 사용자의 트리를 바로 읽고,
  // 없으면(공개 목록) 그 카테고리의 주인을 먼저 찾는다. 없는 id·남의 카테고리 id는 오류가 아니라 "아무 글도 안 걸리는" 조건이 된다
  // (글은 자기 카테고리만 가리킬 수 있으므로 id 하나로 거르면 빈 목록이다).
  private async categoryFilter(
    categoryId: string | undefined,
    ownerUserId?: string,
  ): Promise<Prisma.PostWhereInput> {
    if (!categoryId) return {};

    let treeOwnerId = ownerUserId;
    if (!treeOwnerId) {
      const root = await this.prisma.postCategory.findUnique({
        where: { id: categoryId },
        select: { userId: true },
      });
      if (!root) return { categoryId };
      treeOwnerId = root.userId;
    }

    const categories = await this.prisma.postCategory.findMany({
      where: { userId: treeOwnerId },
      select: { id: true, parentId: true },
    });
    const childrenOf = new Map<string, string[]>();
    for (const c of categories) {
      if (!c.parentId) continue;
      childrenOf.set(c.parentId, [...(childrenOf.get(c.parentId) ?? []), c.id]);
    }

    // 자기 자신부터 아래로 훑는다 (순환 데이터여도 끝나게 방문 기록을 둔다)
    const ids = [categoryId];
    const visited = new Set<string>(ids);
    for (let i = 0; i < ids.length; i++) {
      for (const child of childrenOf.get(ids[i]) ?? []) {
        if (visited.has(child)) continue;
        visited.add(child);
        ids.push(child);
      }
    }
    return ids.length === 1 ? { categoryId } : { categoryId: { in: ids } };
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
        categoryId: true,
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
        categoryId: true,
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

  // 글 상세의 카테고리 경로 — 작성자의 카테고리 트리에서 최상위부터 이 글의 카테고리까지 ([{ id, name }, ...], 예: 학습 > AI).
  // 글의 categoryId로 PostCategory를 찾아 parentId를 따라 올라간다 (같은 이름이 여러 곳이어도 정확).
  // 카테고리가 지정되지 않은 글(categoryId null)은 이름 사본 하나([{ id: null, name }]), 이름도 비어 있으면 []. 이 경우 DB를 읽지 않는다.
  private async buildCategoryPath(post: {
    userId: string | null;
    category: string;
    categoryId: string | null;
  }): Promise<CategoryPathItem[]> {
    if (!post.categoryId || !post.userId) return pathOf([], post);

    const categories = await this.prisma.postCategory.findMany({
      where: { userId: post.userId },
      select: { id: true, name: true, parentId: true },
    });
    return pathOf(categories, post);
  }

  // 목록의 각 글에 categoryPath를 붙인다 — 이번 페이지 글들의 작성자(보통 소수) 카테고리를 한 번에 읽어 글마다 경로를 만든다.
  // 작성자가 없거나 categoryId가 없는 글은 조회 없이 이름 사본 하나 / []. 대상이 하나도 없으면 DB를 읽지 않는다.
  private async withCategoryPaths<
    T extends {
      userId: string | null;
      category: string;
      categoryId: string | null;
    },
  >(posts: T[]): Promise<(T & { categoryPath: CategoryPathItem[] })[]> {
    const userIds = [
      ...new Set(
        posts.filter((p) => p.categoryId && p.userId).map((p) => p.userId!),
      ),
    ];
    const byUser = new Map<string, CategoryRow[]>();
    if (userIds.length > 0) {
      const rows = await this.prisma.postCategory.findMany({
        where: { userId: { in: userIds } },
        select: { id: true, userId: true, name: true, parentId: true },
      });
      for (const row of rows) {
        byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]);
      }
    }
    return posts.map((post) => ({
      ...post,
      categoryPath: pathOf(
        post.userId ? (byUser.get(post.userId) ?? []) : [],
        post,
      ),
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
          categoryId: true,
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
        categoryId: true,
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
    const categoryFilter = await this.categoryFilter(query.categoryId, userId);
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
        by: ['categoryId'],
        where: { userId, NOT: EMPTY_DRAFT },
        _count: { _all: true },
      }),
    ]);
    // 카테고리 id → 직속 글 수 (아직 지정 안 된 글은 'unassigned')
    const categoryCounts = countsByCategoryId(grouped);
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
    // 저장(발행)할 때만 본문의 내 tmp 이미지를 post/<userId>/<postId>/로 옮기고 본문 주소를 바꾼다.
    // 자동 임시저장은 tmp 주소 그대로 둔다 (계약: inote 레포 docs/EDITOR_IMAGE_UPLOAD.md)
    let promoted: Promotion[] = [];
    if (publish) {
      const result = await this.promotePostImages(
        userId,
        id,
        fields.content ?? post.content,
      );
      promoted = result.promoted;
      if (promoted.length > 0) fields.content = result.content;
    }
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

    // 옮긴 이미지의 tmp 원본은 글이 저장된 뒤에야 지운다 — 저장이 실패했는데 먼저 지우면 임시저장본의 이미지가 깨진다
    await this.deleteTmpImages(promoted);

    if (publish) {
      // 임베딩은 기다리지 않는다(약 5초) — 요약과 동시에 시작만 하고, 실패해도 저장 응답엔 영향이 없다
      this.syncEmbedding(updated);
      await this.summarize(updated.id, updated.title, updated.content);
    }

    return updated;
  }

  // 본문의 내 tmp 이미지를 영구 위치로 복사한다. 복사가 실패한 이미지는 tmp 주소 그대로 두고(저장은 막지 않는다 —
  // 이미지 문제로 글 저장이 실패하는 쪽이 더 나쁘다) 경고만 남긴다. 다음 저장 때 다시 시도된다.
  private async promotePostImages(
    userId: string,
    postId: string,
    content: string,
  ): Promise<{ content: string; promoted: Promotion[] }> {
    const plan = planPromotions(content, {
      publicUrl: this.r2.publicBaseUrl(),
      userId,
      postId,
    });
    const copied = await Promise.all(
      plan.map(async (promotion) => {
        try {
          await this.r2.copy(promotion.fromKey, promotion.toKey);
          return promotion;
        } catch (e) {
          this.logger.warn(
            `failed to promote image ${promotion.fromKey} for post ${postId}: ${e}`,
          );
          return null;
        }
      }),
    );
    const promoted = copied.filter((p): p is Promotion => p !== null);
    return { content: applyPromotions(content, promoted), promoted };
  }

  private async deleteTmpImages(promoted: Promotion[]) {
    await Promise.all(
      promoted.map(async ({ fromKey }) => {
        try {
          await this.r2.delete(fromKey);
        } catch (e) {
          this.logger.warn(`failed to delete tmp image ${fromKey}: ${e}`);
        }
      }),
    );
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
    await this.deletePostImages(userId, id, post.content);
    return deleted;
  }

  // 글을 지우면 그 글의 이미지도 R2에서 지운다 — DB 삭제가 끝난 뒤라 실패해도 삭제는 막지 않고 경고만 남긴다.
  //  - 저장된 글의 이미지: post/<userId>/<postId>/ 폴더째
  //  - 아직 승격되지 않은 이미지(임시저장 글, 승격에 실패한 것): 본문에 있는 "내 tmp" 파일만 개별로 (planPromotions와 같은
  //    규칙이라 남의 파일·외부 주소는 지울 수 없다)
  // 본문에서 지웠거나 저장 없이 나간 업로드는 어디에도 연결돼 있지 않아 여기서 못 지운다 (정리 배치 — inote 레포 docs/todo)
  private async deletePostImages(
    userId: string,
    postId: string,
    content: string,
  ) {
    const tmpKeys = planPromotions(content, {
      publicUrl: this.r2.publicBaseUrl(),
      userId,
      postId,
    }).map((p) => p.fromKey);
    await Promise.all([
      ...tmpKeys.map((key) =>
        this.r2.delete(key).catch((e) => {
          this.logger.warn(`failed to delete tmp image ${key}: ${e}`);
        }),
      ),
      this.r2.deletePrefix(`post/${userId}/${postId}/`).catch((e) => {
        this.logger.warn(`failed to delete images of post ${postId}: ${e}`);
      }),
    ]);
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
