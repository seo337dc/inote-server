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

    return {
      pinned,
      pinnedPage,
      pinnedTotal,
      pinnedTotalPages: Math.max(1, Math.ceil(pinnedTotal / PINNED_PAGE_SIZE)),
      items,
      total: pinnedTotal + listTotal,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(listTotal / pageSize)),
    };
  }

  findAll(query: ListPostsQueryDto) {
    return this.listPage(
      {
        publishedAt: { not: null },
        isPrivate: false,
        ...(query.category ? { category: query.category } : {}),
      },
      query,
    );
  }

  // 글 상세 왼쪽 카테고리 트리용 — 본문 없이 제목·카테고리만 가볍게 전부 내려준다.
  // 발행된 공개 글 + (로그인했다면) 내 비공개 글. draft는 제외.
  findOutline(requesterUserId?: string) {
    return this.prisma.post.findMany({
      where: {
        publishedAt: { not: null },
        OR: [
          { isPrivate: false },
          ...(requesterUserId ? [{ userId: requesterUserId }] : []),
        ],
      },
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
    return post;
  }

  // inote-ai가 대화 기록 접근 제어에 쓰는 내부 전용 조회 — 존재 안 하면 null.
  async getOwnerId(id: string): Promise<string | null> {
    const post = await this.prisma.post.findUnique({ where: { id } });
    return post?.userId ?? null;
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
    const [page, grouped] = await Promise.all([
      this.listPage(
        {
          userId,
          NOT: EMPTY_DRAFT,
          ...(query.category ? { category: query.category } : {}),
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

  // publish가 true일 때만 진짜 저장(발행 + AI 요약 갱신). 그 외엔 임시저장 — 내용만 갱신하고
  // 발행 상태·요약은 건드리지 않는다 (자동저장이 Groq를 계속 호출하지 않도록).
  async update(userId: string, id: string, dto: UpdatePostDto) {
    const post = await this.findRaw(id);
    if (post.userId !== userId) {
      throw new ForbiddenException('본인이 작성한 글만 수정할 수 있습니다.');
    }
    const { publish, ...fields } = dto;
    // 진짜 저장(발행)일 때만 lastEditedAt을 갱신 — 첫 발행이면 publishedAt과 같은 시각으로 맞춘다
    const now = new Date();
    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        ...fields,
        ...(publish
          ? { publishedAt: post.publishedAt ?? now, lastEditedAt: now }
          : {}),
      },
      include: DETAIL_INCLUDE,
    });

    if (publish) {
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
    await this.deleteAiSession(id);
    return deleted;
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
