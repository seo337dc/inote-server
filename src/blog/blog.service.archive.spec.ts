import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BlogService } from './blog.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../uploads/r2.service';
import { publicCandidatesWhere } from '../embeddings/embedding-candidates';

// 비슷한 글은 AI 서버를 부르는 기능이라, 이 파일에서는 "볼 수 있는 글인지" 판정(404)까지만 확인하고 꺼 둔다
jest.mock('../embeddings/inote-ai-embeddings', () => ({
  ...jest.requireActual<typeof import('../embeddings/inote-ai-embeddings')>(
    '../embeddings/inote-ai-embeddings',
  ),
  isEmbeddingsEnabled: () => false,
}));

// 글 보관함 — 계약: inote 레포 docs/adr/0007-archive-posts.md
//  - 보관한 글(archivedAt 값 있음)은 홈·작성자별 목록, 나의 글, 카테고리 개수, 글 트리, 글 이동 탭, 공개 글 id 목록에서 빠진다
//  - 보관함(mine?archived=true)은 보관한 글만, 보관한 시각 최신순, 카테고리 개수도 보관한 글 기준
//  - 직접 주소는 작성자만 (남·비로그인은 404 — 비공개 글과 같은 방식)
//  - 보관·해제는 일괄(ids), 내 글이 아니거나 없거나 발행 전인 id는 오류 없이 건너뛴다, 이미 된 것은 멱등
//  - 보관하면 고정이 풀리고, 보관한 글은 수정해도 다시 고정되지 않는다
describe('BlogService — 글 보관함', () => {
  let service: BlogService;

  const mockPrisma = {
    post: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    postCategory: { findMany: jest.fn(), findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    postSummary: { upsert: jest.fn() },
  };

  // 서비스의 ARCHIVE_ORDER·NOT_ARCHIVED와 같은 값
  const ARCHIVE_ORDER = [{ archivedAt: 'desc' }, { createdAt: 'desc' }];
  const EMPTY_DRAFT = {
    publishedAt: null,
    title: '',
    content: { in: ['', '<p></p>'] },
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    mockPrisma.post.findMany.mockResolvedValue([]);
    mockPrisma.post.count.mockResolvedValue(0);
    mockPrisma.post.groupBy.mockResolvedValue([]);
    mockPrisma.postCategory.findMany.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        BlogService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: R2Service, useValue: {} },
      ],
    }).compile();
    service = module.get(BlogService);
  });

  // ──────────────────────────────────────────────── 보관 / 해제
  describe('archive', () => {
    it('내 글 중 발행됐고 아직 보관 안 한 글만 보관한다 — 보관 시각을 채우고 고정은 푼다', async () => {
      mockPrisma.post.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.post.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

      await service.archive('u1', ['a', 'b']);

      expect(mockPrisma.post.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['a', 'b'] },
          userId: 'u1',
          publishedAt: { not: null },
          archivedAt: null,
        },
        data: { archivedAt: expect.any(Date), pinned: false },
      });
    });

    it('실제로 보관된 글의 id만 archivedIds로 돌려준다', async () => {
      mockPrisma.post.updateMany.mockResolvedValue({ count: 1 });
      // 요청은 3개지만 남의 글·없는 글은 조회에서 빠진다
      mockPrisma.post.findMany.mockResolvedValue([{ id: 'mine' }]);

      const result = await service.archive('u1', ['mine', 'others', 'nope']);

      expect(result).toEqual({ archivedIds: ['mine'] });
    });

    it('응답 조회도 내 글·발행된 글·보관된 글만 대상으로 한다 (남의 글 존재 여부가 새지 않는다)', async () => {
      mockPrisma.post.updateMany.mockResolvedValue({ count: 0 });

      await service.archive('u1', ['x']);

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['x'] },
          userId: 'u1',
          publishedAt: { not: null },
          archivedAt: { not: null },
        },
        select: { id: true },
      });
    });

    it('남의 글·없는 글·draft id만 보내도 오류 없이 빈 목록을 돌려준다', async () => {
      mockPrisma.post.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.post.findMany.mockResolvedValue([]);

      await expect(service.archive('u1', ['x', 'y'])).resolves.toEqual({
        archivedIds: [],
      });
    });

    it('이미 보관한 글은 보관 시각을 다시 쓰지 않지만(archivedAt: null 조건) 응답에는 포함한다 (멱등)', async () => {
      mockPrisma.post.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.post.findMany.mockResolvedValue([{ id: 'already' }]);

      const result = await service.archive('u1', ['already']);

      const { where } = mockPrisma.post.updateMany.mock.calls[0][0];
      expect(where.archivedAt).toBeNull();
      expect(result).toEqual({ archivedIds: ['already'] });
    });

    it('같은 id를 여러 번 보내도 한 번만 처리한다', async () => {
      mockPrisma.post.updateMany.mockResolvedValue({ count: 1 });

      await service.archive('u1', ['a', 'a', 'b', 'a']);

      expect(mockPrisma.post.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { in: ['a', 'b'] } }),
        }),
      );
    });
  });

  describe('unarchive', () => {
    it('내 글 중 보관한 글만 해제한다 — 보관 시각만 비우고 고정은 건드리지 않는다', async () => {
      mockPrisma.post.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.post.findMany.mockResolvedValue([{ id: 'a' }]);

      await service.unarchive('u1', ['a']);

      expect(mockPrisma.post.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['a'] },
          userId: 'u1',
          publishedAt: { not: null },
          archivedAt: { not: null },
        },
        data: { archivedAt: null },
      });
    });

    it('해제된(보관 안 한) 내 발행 글의 id만 unarchivedIds로 돌려준다', async () => {
      mockPrisma.post.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.post.findMany.mockResolvedValue([{ id: 'a' }]);

      const result = await service.unarchive('u1', ['a', 'others']);

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['a', 'others'] },
          userId: 'u1',
          publishedAt: { not: null },
          archivedAt: null,
        },
        select: { id: true },
      });
      expect(result).toEqual({ unarchivedIds: ['a'] });
    });

    it('남의 글·없는 글만 보내도 오류 없이 빈 목록이다', async () => {
      mockPrisma.post.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.unarchive('u1', ['x'])).resolves.toEqual({
        unarchivedIds: [],
      });
    });
  });

  // ──────────────────────────────────────────────── 보관함 목록 (나의 글)
  describe('findMine — 보관함', () => {
    it('archived가 true면 보관한 글만 보관한 시각 최신순으로 조회한다 (고정 글 영역·일반 글 영역 모두)', async () => {
      await service.findMine('u1', { archived: true });

      for (const n of [1, 2]) {
        expect(mockPrisma.post.findMany).toHaveBeenNthCalledWith(
          n,
          expect.objectContaining({
            where: {
              userId: 'u1',
              NOT: EMPTY_DRAFT,
              archivedAt: { not: null },
              pinned: n === 1,
            },
            orderBy: ARCHIVE_ORDER,
          }),
        );
      }
    });

    it('보관함의 카테고리별 개수는 보관한 글 기준으로 센다', async () => {
      mockPrisma.post.groupBy.mockResolvedValue([
        { categoryId: 'c1', _count: { _all: 4 } },
      ]);

      const result = await service.findMine('u1', { archived: true });

      expect(mockPrisma.post.groupBy).toHaveBeenCalledWith({
        by: ['categoryId'],
        where: { userId: 'u1', NOT: EMPTY_DRAFT, archivedAt: { not: null } },
        _count: { _all: true },
      });
      expect(result.categoryCounts).toEqual({ c1: 4 });
    });

    it('보관함에서도 검색어와 카테고리 필터가 같이 동작한다', async () => {
      await service.findMine('u1', { archived: true, q: '리액트' });

      expect(mockPrisma.post.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            archivedAt: { not: null },
            OR: [
              { title: { contains: '리액트', mode: 'insensitive' } },
              { content: { contains: '리액트', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('archived가 없거나 false면 보관한 글을 뺀 나의 글이다 (기본 정렬 유지)', async () => {
      for (const query of [{}, { archived: false }]) {
        mockPrisma.post.findMany.mockClear();

        await service.findMine('u1', query);

        const { where, orderBy } = mockPrisma.post.findMany.mock.calls[1][0];
        expect(where.archivedAt).toBeNull();
        expect(orderBy).not.toEqual(ARCHIVE_ORDER);
      }
    });

    it('나의 글의 카테고리별 개수는 보관한 글을 뺀다', async () => {
      await service.findMine('u1', {});

      expect(mockPrisma.post.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', NOT: EMPTY_DRAFT, archivedAt: null },
        }),
      );
    });
  });

  // ──────────────────────────────────────────────── 보관한 글이 빠지는 곳
  describe('보관한 글을 제외하는 조회', () => {
    it('홈 목록(findAll)은 보관한 글을 뺀다 — 고정 글·일반 글·개수 모두', async () => {
      await service.findAll({});

      for (const n of [1, 2]) {
        const { where } = mockPrisma.post.findMany.mock.calls[n - 1][0];
        expect(where.archivedAt).toBeNull();
      }
      for (const n of [0, 1]) {
        expect(
          mockPrisma.post.count.mock.calls[n][0].where.archivedAt,
        ).toBeNull();
      }
    });

    it('홈 목록은 archived=true 쿼리가 와도 무시한다 (보관한 글을 보여주지 않는다)', async () => {
      await service.findAll({ archived: true });

      const { where } = mockPrisma.post.findMany.mock.calls[1][0];
      expect(where.archivedAt).toBeNull();
    });

    it('작성자별 목록의 카테고리 개수(publicCategorySummary)도 보관한 글을 뺀다', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        name: '글쓴이',
      });

      await service.findAll({ userId: 'u1' });

      expect(mockPrisma.post.groupBy).toHaveBeenCalledWith({
        by: ['categoryId'],
        where: {
          userId: 'u1',
          publishedAt: { not: null },
          isPrivate: false,
          archivedAt: null,
        },
        _count: { _all: true },
      });
    });

    it('내 글 트리(findOutline)는 보관한 글을 뺀다', async () => {
      await service.findOutline('u1');

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'u1',
            publishedAt: { not: null },
            archivedAt: null,
          },
        }),
      );
    });

    it('작성자의 공개 글 트리(findUserOutline)는 보관한 글을 뺀다', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        name: '글쓴이',
      });

      await service.findUserOutline('u1');

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'u1',
            publishedAt: { not: null },
            isPrivate: false,
            archivedAt: null,
          },
        }),
      );
    });

    it('글 이동 탭(findMyOutline)은 보관한 글을 뺀다', async () => {
      await service.findMyOutline('u1');

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', NOT: EMPTY_DRAFT, archivedAt: null },
        }),
      );
    });

    it('공개 글 id 목록(listPublicPostIds)은 보관한 글을 뺀다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([{ id: 'a' }]);

      const result = await service.listPublicPostIds();

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [publicCandidatesWhere(), { archivedAt: null }] },
        }),
      );
      expect(result).toEqual({ ids: ['a'] });
    });
  });

  // ──────────────────────────────────────────────── 직접 주소 접근
  describe('findOne — 보관한 글', () => {
    const archivedPost = {
      id: 'p1',
      userId: 'owner',
      publishedAt: new Date('2026-09-01'),
      isPrivate: false,
      category: '',
      categoryId: null,
      archivedAt: new Date('2026-10-20'),
    };

    it('작성자 본인은 열 수 있다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(archivedPost);

      const result = await service.findOne('p1', 'owner');

      expect(result.id).toBe('p1');
      expect(result.archivedAt).toEqual(archivedPost.archivedAt);
    });

    it('다른 로그인 사용자는 404다 (존재 자체를 숨긴다)', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(archivedPost);

      await expect(service.findOne('p1', 'other')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('비로그인은 404다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(archivedPost);

      await expect(service.findOne('p1')).rejects.toThrow(NotFoundException);
    });

    it('보관하지 않은 공개 글은 누구나 그대로 열 수 있다 (archivedAt: null)', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        ...archivedPost,
        archivedAt: null,
      });

      const result = await service.findOne('p1', 'other');

      expect(result.id).toBe('p1');
    });
  });

  describe('findSimilar — 보관한 글이 원본일 때', () => {
    const archivedSource = {
      userId: 'owner',
      publishedAt: new Date('2026-09-01'),
      isPrivate: false,
      archivedAt: new Date('2026-10-20'),
    };

    it('다른 사용자·비로그인은 404다 (비슷한 글 조회로 보관한 글의 존재가 드러나지 않는다)', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(archivedSource);

      await expect(service.findSimilar('p1', 'other', 5)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findSimilar('p1', undefined, 5)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('작성자 본인은 404가 아니다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(archivedSource);

      await expect(service.findSimilar('p1', 'owner', 5)).resolves.toEqual({
        items: [],
      });
    });
  });

  // ──────────────────────────────────────────────── 수정
  describe('update — 보관한 글', () => {
    function arrangePost(archivedAt: Date | null) {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        title: '제목',
        content: '<p>본문</p>',
        publishedAt: new Date('2026-09-01'),
        archivedAt,
      });
      mockPrisma.post.update.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'p1', ...data }),
      );
    }

    it('수정해도 보관 상태(archivedAt)는 바뀌지 않는다 — 저장 데이터에 archivedAt이 들어가지 않는다', async () => {
      arrangePost(new Date('2026-10-20'));

      await service.update('u1', 'p1', { title: '새 제목' });

      const { data } = mockPrisma.post.update.mock.calls[0][0];
      expect(data).not.toHaveProperty('archivedAt');
      expect(data.title).toBe('새 제목');
    });

    it('보관한 글에 pinned: true를 보내도 고정되지 않는다 (pinned: false로 저장)', async () => {
      arrangePost(new Date('2026-10-20'));

      await service.update('u1', 'p1', { pinned: true });

      expect(mockPrisma.post.update.mock.calls[0][0].data.pinned).toBe(false);
    });

    it('보관하지 않은 글은 pinned: true가 그대로 저장된다', async () => {
      arrangePost(null);

      await service.update('u1', 'p1', { pinned: true });

      expect(mockPrisma.post.update.mock.calls[0][0].data.pinned).toBe(true);
    });
  });
});
