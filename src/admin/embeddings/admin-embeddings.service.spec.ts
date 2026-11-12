// AdminEmbeddingsService.list 테스트 목록 — 계약: inote 레포 docs/todo/admin-embeddings.md "1단계 계약(확정)".
//
// 만들 것
//   - AdminEmbeddingsService.list({ page, pageSize, status }) — Prisma로 모든 사용자의 글을 읽고,
//     대상(excluded 아님) 글의 id를 inote-ai에 한 번에 물어(fetchEmbeddingStatuses, 구현 예정) 상태를 합친다.
//   - AI 호출 함수는 jest.mock으로 가짜를 넣는다(admin-users.service.spec.ts가 inote-ai-client를 mock하는 것과 같은 방식).
//   - Prisma는 { post: { findMany: jest.fn() } } 가짜. 글 수천 편 이하 전제라 전체를 한 번 읽고 메모리에서 필터·정렬·페이지·집계한다.
//
// 가장 조심할 함정
//   - 응답 항목에 본문(content)·작성자(userId)·이메일 등이 들어가지 않는다(제목만 노출). Prisma select에 content를 넣지 않는 것까지 검사하면 좋다.
//   - excluded 글의 id는 AI 요청에 넘기지 않는다. 대상 글이 0개면 AI를 아예 부르지 않는다.
//   - AI 호출이 실패·타임아웃(5초)해도 throw하지 않고 aiAvailable: false로 응답한다. EMBEDDINGS_ENABLED가 꺼져 있어도 동작한다.
//   - summary는 페이지가 아니라 전체 글 기준이다(2페이지를 요청해도 같은 값). totalPages는 최소 1.
//   - 상태 필터는 판정이 끝난 뒤의 목록에 걸고, total·totalPages도 필터된 개수 기준이다.

import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import {
  fetchEmbedderHealth,
  fetchEmbeddingStatuses,
} from '../../embeddings/inote-ai-embedding-status';
import { AdminEmbeddingsService } from './admin-embeddings.service';
import type { AiEmbeddingState } from '../../embeddings/inote-ai-embedding-status';

jest.mock('../../embeddings/inote-ai-embedding-status', () => ({
  fetchEmbeddingStatuses: jest.fn(),
  fetchEmbedderHealth: jest.fn(),
}));

const mockStatuses = fetchEmbeddingStatuses as jest.Mock;
const mockHealth = fetchEmbedderHealth as jest.Mock;

const T = new Date('2026-11-06T09:00:00.000Z');
const at = (min: number) => new Date(T.getTime() + min * 60_000);

type PostRow = {
  id: string;
  title: string;
  category: string;
  isPrivate: boolean;
  publishedAt: Date | null;
  archivedAt: Date | null;
  lastEditedAt: Date | null;
  createdAt: Date;
};
const row = (id: string, o: Partial<PostRow> = {}): PostRow => ({
  id,
  title: `제목 ${id}`,
  category: '개발',
  isPrivate: false,
  publishedAt: T,
  archivedAt: null,
  lastEditedAt: T,
  createdAt: T,
  ...o,
});
const done = (o: Partial<AiEmbeddingState> = {}): AiEmbeddingState => ({
  chunkCount: 3,
  embeddedAt: T.toISOString(),
  job: null,
  ...o,
});
const failedJob = (): AiEmbeddingState => ({
  chunkCount: 0,
  embeddedAt: null,
  job: { status: 'failed', attempts: 3, lastError: 'timeout' },
});

describe('AdminEmbeddingsService.list', () => {
  let service: AdminEmbeddingsService;
  const mockPrisma = { post: { findMany: jest.fn() } };

  const run = (q: { page?: number; pageSize?: number; status?: string } = {}) =>
    service.list({ page: 1, pageSize: 20, status: 'all', ...q } as never);

  beforeEach(async () => {
    jest.clearAllMocks();
    mockStatuses.mockResolvedValue({});
    mockHealth.mockResolvedValue(true);
    const module = await Test.createTestingModule({
      providers: [
        AdminEmbeddingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(AdminEmbeddingsService);
  });

  describe('응답 모양', () => {
    it('항목에 제목·카테고리·공개/보관/발행 여부·lastEditedAt·상태·chunkCount·embeddedAt·job이 들어간다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([row('p1')]);
      mockStatuses.mockResolvedValue({ p1: done() });

      const { items } = await run();

      expect(items).toEqual([
        {
          postId: 'p1',
          title: '제목 p1',
          category: '개발',
          isPrivate: false,
          isArchived: false,
          isPublished: true,
          lastEditedAt: T.toISOString(),
          status: 'done',
          chunkCount: 3,
          embeddedAt: T.toISOString(),
          job: null,
        },
      ]);
    });
    it('항목에 본문·작성자·이메일이 들어가지 않는다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        { ...row('p1'), content: '<p>본문</p>', userId: 'u1' },
      ]);
      mockStatuses.mockResolvedValue({ p1: done() });

      const { items } = await run();

      expect(Object.keys(items[0])).not.toEqual(
        expect.arrayContaining(['content']),
      );
      expect(items[0]).not.toHaveProperty('userId');
      // 애초에 본문·작성자를 읽지 않는다 (select에 없다)
      const args = mockPrisma.post.findMany.mock.calls[0][0] as {
        select: Record<string, boolean>;
      };
      expect(args.select).not.toHaveProperty('content');
      expect(args.select).not.toHaveProperty('userId');
    });
    it('모든 사용자의 글이 대상이다 (userId로 거르지 않는다)', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);

      await run();

      const args = mockPrisma.post.findMany.mock.calls[0][0] as {
        where?: unknown;
      };
      expect(args.where).toBeUndefined();
    });
    it('lastEditedAt 내림차순, 없으면 createdAt으로 정렬한다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        row('old', { lastEditedAt: at(1) }),
        row('draftNew', { lastEditedAt: null, createdAt: at(30) }),
        row('mid', { lastEditedAt: at(10) }),
      ]);

      const { items } = await run();

      expect(items.map((i) => i.postId)).toEqual(['draftNew', 'mid', 'old']);
    });
  });

  describe('AI 호출', () => {
    it('대상(excluded 아님) 글의 id만 한 번에 넘긴다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        row('p1'),
        row('p2'),
        row('p3'),
      ]);

      await run();

      expect(mockStatuses).toHaveBeenCalledTimes(1);
      expect(mockStatuses.mock.calls[0][0].sort()).toEqual(['p1', 'p2', 'p3']);
    });
    it('excluded 글의 id는 넘기지 않는다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        row('ok'),
        row('priv', { isPrivate: true }),
        row('draft', { publishedAt: null }),
        row('arch', { archivedAt: T }),
      ]);

      await run();

      expect(mockStatuses.mock.calls[0][0]).toEqual(['ok']);
    });
    it('대상 글이 없으면 AI 상태 조회를 호출하지 않는다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        row('priv', { isPrivate: true }),
      ]);

      const res = await run();

      expect(mockStatuses).not.toHaveBeenCalled();
      expect(res.items[0].status).toBe('excluded');
    });
    it('AI 응답의 chunkCount·embeddedAt·job이 항목에 그대로 담긴다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([row('p1')]);
      mockStatuses.mockResolvedValue({ p1: failedJob() });

      const { items } = await run();

      expect(items[0]).toMatchObject({
        status: 'failed',
        chunkCount: 0,
        embeddedAt: null,
        job: { status: 'failed', attempts: 3, lastError: 'timeout' },
      });
    });
    it('AI가 응답하지 않으면 aiAvailable: false, embedder.reachable: false, 대상 글은 모두 unknown, summary.counts는 null', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        row('p1'),
        row('priv', { isPrivate: true }),
      ]);
      mockStatuses.mockResolvedValue(null); // 시간 초과·연결 실패는 호출 모듈이 null로 알린다
      mockHealth.mockResolvedValue(false);

      const res = await run();

      expect(res.aiAvailable).toBe(false);
      expect(res.embedder).toEqual({ reachable: false });
      expect(res.items.map((i) => i.status).sort()).toEqual([
        'excluded',
        'unknown',
      ]);
      expect(res.summary).toEqual({ eligible: 1, excluded: 1, counts: null });
    });
    it('AI 상태에 없는 글(응답에서 빠진 id)은 조각 0·job 없음으로 보고 incomplete로 판정한다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([row('p1')]);
      mockStatuses.mockResolvedValue({}); // p1에 대한 항목이 없다

      const { items } = await run();

      expect(items[0]).toMatchObject({
        status: 'incomplete',
        chunkCount: 0,
        embeddedAt: null,
        job: null,
      });
    });
    it('EMBEDDINGS_ENABLED가 꺼져 있어도 AI를 호출한다', async () => {
      const saved = process.env.EMBEDDINGS_ENABLED;
      delete process.env.EMBEDDINGS_ENABLED;
      mockPrisma.post.findMany.mockResolvedValue([row('p1')]);

      await run();

      expect(mockStatuses).toHaveBeenCalledTimes(1);
      if (saved !== undefined) process.env.EMBEDDINGS_ENABLED = saved;
    });
    it('임베딩 서비스에 닿는지(embedder.reachable)는 AI의 health 응답을 따른다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([row('p1')]);
      mockStatuses.mockResolvedValue({ p1: done() });

      mockHealth.mockResolvedValue(true);
      expect((await run()).embedder).toEqual({ reachable: true });

      mockHealth.mockResolvedValue(false);
      const res = await run();
      expect(res.embedder).toEqual({ reachable: false });
      expect(res.aiAvailable).toBe(true); // AI는 응답했고 임베딩 서비스만 닿지 않는다
    });
  });

  // 글 5개: done 2, failed 1, incomplete 1(AI 응답에 없음), excluded 1
  const mixed = () => {
    mockPrisma.post.findMany.mockResolvedValue([
      row('d1', { lastEditedAt: at(5) }),
      row('d2', { lastEditedAt: at(4) }),
      row('f1', { lastEditedAt: at(3) }),
      row('i1', { lastEditedAt: at(2) }),
      row('x1', { lastEditedAt: at(1), isPrivate: true }),
    ]);
    const fresh = done({ embeddedAt: at(10).toISOString() }); // 수정 시각(at(1)~at(5))보다 나중에 임베딩
    mockStatuses.mockResolvedValue({ d1: fresh, d2: fresh, f1: failedJob() });
  };

  describe('필터·페이지네이션', () => {
    it('status=all이면 전부, incomplete/failed/done/excluded면 해당 탭의 글만 나온다', async () => {
      mixed();
      const ids = async (status: string) =>
        (await run({ status })).items.map((i) => i.postId);

      expect(await ids('all')).toEqual(['d1', 'd2', 'f1', 'i1', 'x1']);
      expect(await ids('done')).toEqual(['d1', 'd2']);
      expect(await ids('failed')).toEqual(['f1']);
      expect(await ids('incomplete')).toEqual(['i1']);
      expect(await ids('excluded')).toEqual(['x1']);
    });
    it('total·totalPages는 필터된 개수 기준이다', async () => {
      mixed();

      const res = await run({ status: 'done', pageSize: 1 });

      expect(res).toMatchObject({ total: 2, totalPages: 2, items: [{}] });
    });
    it('page·pageSize로 잘라 준다 (2페이지 → 21~40번째)', async () => {
      mockPrisma.post.findMany.mockResolvedValue(
        Array.from({ length: 45 }, (_, i) =>
          row(`p${i + 1}`, { lastEditedAt: at(100 - i) }),
        ),
      );
      mockStatuses.mockResolvedValue({});

      const res = await run({ page: 2, pageSize: 20 });

      expect(res.items).toHaveLength(20);
      expect(res.items[0].postId).toBe('p21');
      expect(res.items[19].postId).toBe('p40');
      expect(res).toMatchObject({
        page: 2,
        pageSize: 20,
        total: 45,
        totalPages: 3,
      });
    });
    it('결과가 0개여도 totalPages는 1이다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);

      expect(await run()).toMatchObject({
        total: 0,
        totalPages: 1,
        items: [],
      });
    });
    it('범위를 넘은 page는 빈 items를 돌려준다', async () => {
      mixed();

      const res = await run({ page: 9 });

      expect(res.items).toEqual([]);
      expect(res.total).toBe(5);
    });
    it('AI가 응답하지 않으면 all 탭만 글이 보이고 다른 탭은 비어 있다', async () => {
      mixed();
      mockStatuses.mockResolvedValue(null);

      expect((await run({ status: 'all' })).total).toBe(5);
      expect((await run({ status: 'done' })).items).toEqual([]);
      expect((await run({ status: 'incomplete' })).items).toEqual([]);
      expect((await run({ status: 'excluded' })).items).toHaveLength(1);
    });
  });

  describe('summary (전체 글 기준)', () => {
    it('eligible은 excluded가 아닌 글 수, excluded는 제외된 글 수다', async () => {
      mixed();

      expect((await run()).summary).toMatchObject({ eligible: 4, excluded: 1 });
    });
    it('counts는 done·incomplete·outdated·pending·processing·failed를 전체 글 기준으로 센다', async () => {
      mixed();

      expect((await run()).summary.counts).toEqual({
        done: 2,
        incomplete: 1,
        outdated: 0,
        pending: 0,
        processing: 0,
        failed: 1,
      });
    });
    it('2페이지를 요청해도, 탭 필터를 걸어도 summary는 같다', async () => {
      mixed();
      const base = (await run()).summary;

      expect((await run({ page: 2, pageSize: 2 })).summary).toEqual(base);
      expect((await run({ status: 'failed' })).summary).toEqual(base);
    });
    it('counts의 합은 eligible과 같다 (AI가 정상일 때)', async () => {
      mixed();

      const { eligible, counts } = (await run()).summary;

      const sum = Object.values(counts!).reduce((a, b) => a + b, 0);
      expect(sum).toBe(eligible);
    });
  });
});
