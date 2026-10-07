import { Test } from '@nestjs/testing';
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BlogService } from './blog.service';
import { PrismaService } from '../prisma/prisma.service';

// 서비스의 EMPTY_DRAFT와 같은 조건 — 제목·본문이 모두 빈 발행 전 글
const EMPTY_DRAFT = {
  publishedAt: null,
  title: '',
  content: { in: ['', '<p></p>'] },
};

// 서비스의 searchWhere와 같은 조건 — 제목 또는 본문에 검색어 (대소문자 무시)
const SEARCH = (q: string) => ({
  OR: [
    { title: { contains: q, mode: 'insensitive' } },
    { content: { contains: q, mode: 'insensitive' } },
  ],
});

// 서비스의 LIST_ORDER와 같은 정렬 — 마지막 저장순, draft(null)는 맨 뒤, 같으면 생성순
const LIST_ORDER = [
  { lastEditedAt: { sort: 'desc', nulls: 'last' } },
  { createdAt: 'desc' },
];

describe('BlogService', () => {
  let service: BlogService;

  const mockPrisma = {
    post: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    // 목록의 category 필터가 하위 카테고리까지 포함하려고 작성자의 카테고리 트리를 읽는다 (기본은 트리 없음)
    postCategory: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    postSummary: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ summary: ['요약1'] }),
    } as Response);

    const module = await Test.createTestingModule({
      providers: [
        BlogService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(BlogService);
  });

  describe('findAll', () => {
    // ─────────────────────────────────────────────────────────────────
    // TODO(직접 작성): 고정 글 별도 페이지네이션 — 아래 케이스를 하나씩 채워 넣을 것.
    //
    // mock 순서 힌트 (listPage는 Promise.all로 이 순서대로 호출한다):
    //   mockPrisma.post.findMany → 1번째 = 고정 글, 2번째 = 일반 글
    //   mockPrisma.post.count    → 1번째 = 고정 글 개수, 2번째 = 일반 글 개수
    //
    // findMany 호출 인자의 include는 { user: { select: { name: true, email: true } } } 이다.
    //
    // 골격 예시:
    //   it('...', async () => {
    //     // Arrange: findMany/count에 mockResolvedValueOnce를 호출 순서대로
    //     // Act:     const result = await service.findAll({ ... });
    //     // Assert:  findMany 호출 인자(where/skip/take)와 result 필드 확인
    //   });
    // ─────────────────────────────────────────────────────────────────
    it.todo(
      '쿼리가 아무것도 없으면 일반 글 page=1, 고정 글 pinnedPage=1로 조회한다 (기본값)',
    );
    it.todo(
      '고정 글은 pinned: true 조건으로 3개씩 — pinnedPage에 맞게 skip/take를 계산한다',
    );
    it.todo(
      '일반 글은 pinned: false 조건이라 고정 글이 모두(4번째 이후 포함) 빠진다',
    );
    it.todo(
      '응답에 pinnedPage · pinnedTotal · pinnedTotalPages(3개 기준 올림)를 담는다',
    );
    it.todo('total은 고정 글 개수 + 일반 글 개수다');
    it.todo(
      'pinnedPage가 범위를 넘으면 pinned는 빈 배열이고 pinnedTotalPages는 그대로다',
    );
    it.todo('고정 글이 하나도 없어도 pinnedTotalPages는 최소 1이다');
    it.todo(
      'page를 넘겨도 pinned 조회의 skip은 변하지 않는다 (두 영역이 독립적)',
    );

    // TODO(테스트): 목록 글마다 categoryPath (구현됨: withCategoryPaths) — 나중에 작성할 테스트 목록.
    //  mock: mockPrisma.postCategory.findMany (post mock에 userId·category를 둔다)
    //  - 고정 글·일반 글 모두에 categoryPath가 붙는다 (예: 학습 > AI 글 → ['학습', 'AI'])
    //  - 이번 페이지 글들의 작성자 카테고리를 한 번에 읽는다 (where.userId.in = 중복 없는 작성자 id들, 조회 1번)
    //  - 작성자마다 트리가 달라서 같은 이름이어도 글마다 자기 작성자의 트리로 경로를 만든다
    //  - 트리에 없는 이름이면 [category] / userId가 null이면 조회 없이 [category] / category가 빈 문자열이면 []
    //  - 대상 글이 없거나 모두 조회 불필요(작성자 없음·카테고리 빈 값)면 카테고리를 읽지 않는다
    //  - findMine도 같은 응답 모양 (categoryCounts는 그대로)
    // TODO(테스트): category 필터가 하위 카테고리까지 포함 (구현됨: categoryFilter) — 나중에 작성할 테스트 목록.
    //  mock: mockPrisma.postCategory.findMany (기본은 빈 배열 = 트리 없음). 공개 목록은 where가
    //  { user: { categories: { some: { name } } } }, 내 글 목록은 { userId } 로 트리를 읽는다.
    //  - 하위 카테고리가 있으면 findAll where가 OR [{ category: 이름 }, { userId, category: { in: 하위 이름들 } } ...]
    //  - 작성자마다 트리가 달라서 하위 이름은 작성자별로 따로 묶인다 (A의 '학습' 하위 이름이 B의 글에는 적용되지 않음)
    //  - 3단계(학습 > AI > RAG)면 '학습' 필터에 AI·RAG 글이 모두 포함된다 / 중간(AI) 필터에는 RAG만 더해진다
    //  - 맨 아래 카테고리(하위 없음)이거나 트리에 없는 이름이면 예전처럼 { category: 이름 } 정확 일치 (OR 없음)
    //  - category 필터가 없으면 카테고리 트리를 조회하지 않는다
    //  - 고정 글 조회·일반 글 조회·count 모두 같은 필터를 쓴다 (listPage가 baseWhere를 공유)
    //  - 이름이 같은 카테고리가 한 작성자 트리에 여러 곳이면 각각의 하위를 합친다 / 순환 데이터여도 끝난다
    //  - category와 검색어(q)를 같이 주면 공개 목록은 둘 다 최상위 OR이라 AND: [카테고리 조건, 검색 조건]으로 묶인다 (한쪽이 덮어써지지 않음)
    //  - findMine: where는 { userId, NOT: EMPTY_DRAFT, category: { in: [이름, ...하위 이름들] } }, categoryCounts(groupBy)는 여전히 정확한 카테고리별 개수
    it('category가 있으면 고정 조회·목록 모두 그 카테고리로 거른다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);
      mockPrisma.post.count.mockResolvedValue(0);

      await service.findAll({ page: 1, pageSize: 10, category: '학습' });

      for (const n of [1, 2]) {
        expect(mockPrisma.post.findMany).toHaveBeenNthCalledWith(
          n,
          expect.objectContaining({
            where: expect.objectContaining({ category: '학습' }),
          }),
        );
      }
    });

    it('검색어(q)가 있으면 공개 조건은 그대로 두고 제목·본문 OR 조건을 고정 글·일반 글 모두에 붙인다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);
      mockPrisma.post.count.mockResolvedValue(0);

      await service.findAll({ q: '리액트' });

      for (const n of [1, 2]) {
        expect(mockPrisma.post.findMany).toHaveBeenNthCalledWith(
          n,
          expect.objectContaining({
            where: {
              publishedAt: { not: null },
              isPrivate: false,
              ...SEARCH('리액트'),
              pinned: n === 1,
            },
          }),
        );
      }
      // 개수도 같은 조건으로 센다 (total·totalPages가 검색 결과 기준이 되도록)
      expect(mockPrisma.post.count).toHaveBeenNthCalledWith(1, {
        where: expect.objectContaining(SEARCH('리액트')),
      });
    });

    it('검색어와 카테고리를 함께 주면 둘 다 만족하는 글만 찾는다 (카테고리 안에서 검색)', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);
      mockPrisma.post.count.mockResolvedValue(0);

      await service.findAll({ category: '학습', q: '리액트' });

      expect(mockPrisma.post.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            category: '학습',
            ...SEARCH('리액트'),
          }),
        }),
      );
    });

    it('검색어가 없으면 OR 조건을 붙이지 않는다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);
      mockPrisma.post.count.mockResolvedValue(0);

      await service.findAll({});

      const { where } = mockPrisma.post.findMany.mock.calls[0][0];
      expect(where).not.toHaveProperty('OR');
    });

    it('고정 글·일반 글 모두 마지막 저장순(lastEditedAt)으로 정렬한다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);
      mockPrisma.post.count.mockResolvedValue(0);

      await service.findAll({});

      for (const n of [1, 2]) {
        expect(mockPrisma.post.findMany).toHaveBeenNthCalledWith(
          n,
          expect.objectContaining({ orderBy: LIST_ORDER }),
        );
      }
    });

    it('글이 없어도 totalPages는 최소 1이다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);
      mockPrisma.post.count.mockResolvedValue(0);

      const result = await service.findAll({});

      expect(result.totalPages).toBe(1);
      expect(result.total).toBe(0);
    });
  });

  describe('findOutline', () => {
    const SELECT = {
      id: true,
      title: true,
      category: true,
      isPrivate: true,
      pinned: true,
    };

    it('비로그인이면 발행된 공개 글만 제목·카테고리만 골라 마지막 저장순으로 조회한다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([{ id: 'a' }]);

      const result = await service.findOutline();

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith({
        where: { publishedAt: { not: null }, OR: [{ isPrivate: false }] },
        select: SELECT,
        orderBy: LIST_ORDER,
        take: 500,
      });
      expect(result).toEqual([{ id: 'a' }]);
    });

    it('로그인했으면 공개 글에 더해 내 글(비공개 포함)도 조회한다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);

      await service.findOutline('u1');

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            publishedAt: { not: null },
            OR: [{ isPrivate: false }, { userId: 'u1' }],
          },
        }),
      );
    });
  });

  describe('findMine', () => {
    it('내 글 전체(발행·비공개 무관)를 같은 방식으로 조회하고 카테고리별 개수를 함께 준다', async () => {
      mockPrisma.post.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'a' }]);
      mockPrisma.post.count.mockResolvedValue(1);
      mockPrisma.post.groupBy.mockResolvedValue([
        { category: '학습', _count: { _all: 3 } },
        { category: '이직', _count: { _all: 1 } },
      ]);

      const result = await service.findMine('user-1', {
        page: 1,
        pageSize: 10,
      });

      expect(mockPrisma.post.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { userId: 'user-1', NOT: EMPTY_DRAFT, pinned: true },
        }),
      );
      expect(mockPrisma.post.groupBy).toHaveBeenCalledWith({
        by: ['category'],
        where: { userId: 'user-1', NOT: EMPTY_DRAFT },
        _count: { _all: true },
      });
      expect(result.categoryCounts).toEqual({ 학습: 3, 이직: 1 });
      // 목록의 글에는 카테고리 경로(categoryPath)가 붙는다 — 이 mock 글은 category가 없어 빈 배열
      expect(result.items).toEqual([{ id: 'a', categoryPath: [] }]);
    });

    it('내 글도 마지막 저장순으로 정렬하고, draft(lastEditedAt null)는 맨 뒤로 보낸다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);
      mockPrisma.post.count.mockResolvedValue(0);
      mockPrisma.post.groupBy.mockResolvedValue([]);

      await service.findMine('user-1', {});

      for (const n of [1, 2]) {
        expect(mockPrisma.post.findMany).toHaveBeenNthCalledWith(
          n,
          expect.objectContaining({ orderBy: LIST_ORDER }),
        );
      }
    });

    it('검색어(q)가 있으면 내 글 안에서만 제목·본문으로 찾는다 (다른 사람 글은 대상 아님)', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);
      mockPrisma.post.count.mockResolvedValue(0);
      mockPrisma.post.groupBy.mockResolvedValue([]);

      await service.findMine('user-1', { q: '리액트' });

      for (const n of [1, 2]) {
        expect(mockPrisma.post.findMany).toHaveBeenNthCalledWith(
          n,
          expect.objectContaining({
            where: {
              userId: 'user-1',
              NOT: EMPTY_DRAFT,
              ...SEARCH('리액트'),
              pinned: n === 1,
            },
          }),
        );
      }
    });

    it('검색 중이어도 카테고리별 개수는 검색어 없이 전체 기준으로 센다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);
      mockPrisma.post.count.mockResolvedValue(0);
      mockPrisma.post.groupBy.mockResolvedValue([]);

      await service.findMine('user-1', { q: '리액트' });

      expect(mockPrisma.post.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', NOT: EMPTY_DRAFT },
        }),
      );
    });

    it('category 필터가 있어도 카테고리별 개수는 필터 없이 전체 기준으로 센다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);
      mockPrisma.post.count.mockResolvedValue(0);
      mockPrisma.post.groupBy.mockResolvedValue([]);

      await service.findMine('user-1', { category: '학습' });

      expect(mockPrisma.post.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', NOT: EMPTY_DRAFT },
        }),
      );
    });
  });

  describe('findMyOutline', () => {
    // TODO(테스트): 내 글 목록 API (#7, 구현됨: findMyOutline) — 나중에 작성할 테스트 목록.
    //  mock: mockPrisma.post.findMany
    //  - where는 { userId, NOT: EMPTY_DRAFT } — 내 글만, 빈 임시저장은 제외(발행 전이어도 제목·본문이 있으면 포함)
    //  - select는 id·title·category·isPrivate·publishedAt만 (본문 없음)
    //  - 최신순(createdAt desc), 최대 500개(take)
    //  - 비공개 글도 포함한다 (내 글이므로)
    //  - 결과는 findMany 결과를 그대로 돌려준다
    it.todo('내 글 목록 API 테스트 (위 목록 참고)');
  });

  describe('findOne', () => {
    // TODO(테스트): 글 상세의 categoryPath (구현됨: buildCategoryPath) — 아래는 나중에 작성할 테스트 목록.
    //  mock은 mockPrisma에 postCategory.findMany를 추가하고, post mock에 category·userId를 둔다.
    //  계약: 작성자의 카테고리 트리에서 최상위→글 카테고리 이름 배열. 못 찾으면 [category], category가 빈 문자열이면 [].
    //  - 최상위 카테고리 글이면 이름 하나만 담는다 (일기 → ['일기'])
    //  - 2단계면 [상위, 하위] 순서 (학습 > AI), 3단계면 세 개 (학습 > AI > RAG)
    //  - 기존 응답 필드(id, title, category 등)는 그대로 두고 categoryPath만 더한다
    //  - 카테고리는 요청자가 아니라 글 작성자 것만 조회한다 (findMany where.userId = post.userId)
    //  - 같은 이름이 여러 곳에 있으면 orderBy [{depth:'asc'},{createdAt:'asc'}]로 요청하고, 목록에서 먼저 나온 것의 경로를 쓴다
    //  - 작성자 트리에 그 이름이 없으면 [post.category]
    //  - userId가 null(작성자 탈퇴)이면 조회 없이 [post.category]
    //  - category가 빈 문자열이면 조회 없이 []
    //  - 부모가 목록에 없어 체인이 끊기면 찾은 데까지만 담는다 (예외 없이)
    //  - parentId가 서로를 가리키는 순환 데이터여도 무한 루프 없이 끝난다
    //  - 다른 사람의 비공개 글이면 NotFoundException이고 카테고리는 조회하지 않는다
    //  - 작성자 본인의 비공개 글은 조회되고 categoryPath도 담긴다
    //  ※ 기존 findOne 테스트는 post mock에 category가 없어 조회를 건너뛰므로 그대로 통과한다.
    it('존재하지 않으면 NotFoundException', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null);

      await expect(service.findOne('p1')).rejects.toThrow(NotFoundException);
    });

    it('발행된 글은 누구나 조회 가능하다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'owner',
        publishedAt: new Date('2026-09-01'),
      });

      const result = await service.findOne('p1', 'other-user');
      expect(result.id).toBe('p1');
    });

    it('draft는 작성자 본인이 아니면 NotFoundException (404로 존재 자체를 숨김)', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'owner',
        publishedAt: null,
      });

      await expect(service.findOne('p1', 'other-user')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('draft는 작성자 본인이면 조회 가능하다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'owner',
        publishedAt: null,
      });

      const result = await service.findOne('p1', 'owner');
      expect(result.id).toBe('p1');
    });

    it('비공개 글은 작성자 본인이 아니면 NotFoundException (404로 존재 자체를 숨김)', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'owner',
        publishedAt: new Date('2026-09-01'),
        isPrivate: true,
      });

      await expect(service.findOne('p1', 'other-user')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('비공개 글도 작성자 본인이면 조회 가능하다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'owner',
        publishedAt: new Date('2026-09-01'),
        isPrivate: true,
      });

      const result = await service.findOne('p1', 'owner');
      expect(result.id).toBe('p1');
    });
  });

  describe('getOwnerId', () => {
    it('글이 있으면 userId를 반환한다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'owner' });

      expect(await service.getOwnerId('p1')).toBe('owner');
    });

    it('글이 없으면 null을 반환한다 (예외를 던지지 않음)', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null);

      expect(await service.getOwnerId('missing')).toBeNull();
    });
  });

  describe('findMyDrafts', () => {
    it('제목도 본문도 없는 빈 draft는 제외하고 최근 수정순으로 조회한다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);

      await service.findMyDrafts('user-1');

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', publishedAt: null, NOT: EMPTY_DRAFT },
        orderBy: { updatedAt: 'desc' },
      });
    });
  });

  describe('createDraft', () => {
    it('비어 있는 draft가 없으면 빈 값으로 새로 생성한다', async () => {
      mockPrisma.post.findFirst.mockResolvedValue(null);
      mockPrisma.post.create.mockResolvedValue({ id: 'p1' });

      await service.createDraft('user-1');

      expect(mockPrisma.post.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', ...EMPTY_DRAFT },
        orderBy: { updatedAt: 'desc' },
      });
      expect(mockPrisma.post.create).toHaveBeenCalledWith({
        data: { title: '', content: '', category: '', userId: 'user-1' },
      });
    });

    it('이미 비어 있는 draft가 있으면 새로 만들지 않고 그걸 재사용한다', async () => {
      mockPrisma.post.findFirst.mockResolvedValue({ id: 'empty-1' });

      const result = await service.createDraft('user-1');

      expect(result).toEqual({ id: 'empty-1' });
      expect(mockPrisma.post.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('본인 글이 아니면 ForbiddenException', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'owner',
      });

      await expect(
        service.update('other-user', 'p1', { title: '수정' }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.post.update).not.toHaveBeenCalled();
    });

    it('publish: false면 내용만 갱신하고 publishedAt/요약은 건드리지 않는다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        publishedAt: null,
      });
      mockPrisma.post.update.mockResolvedValue({ id: 'p1', title: '임시저장' });

      await service.update('user-1', 'p1', { title: '임시저장' });

      expect(mockPrisma.post.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { title: '임시저장' },
        include: expect.any(Object),
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('isPrivate/pinned만 보내면 그 필드만 갱신한다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        publishedAt: new Date('2026-09-01'),
      });
      mockPrisma.post.update.mockResolvedValue({ id: 'p1', isPrivate: true });

      await service.update('user-1', 'p1', { isPrivate: true, pinned: true });

      expect(mockPrisma.post.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { isPrivate: true, pinned: true },
        include: expect.any(Object),
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('thumbnailUrl을 보내면 저장하고, null을 보내면 썸네일을 제거한다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        publishedAt: null,
      });
      mockPrisma.post.update.mockResolvedValue({ id: 'p1' });

      await service.update('user-1', 'p1', {
        thumbnailUrl: 'https://r2/a.png',
      });
      await service.update('user-1', 'p1', { thumbnailUrl: null });

      expect(mockPrisma.post.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'p1' },
        data: { thumbnailUrl: 'https://r2/a.png' },
        include: expect.any(Object),
      });
      expect(mockPrisma.post.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'p1' },
        data: { thumbnailUrl: null },
        include: expect.any(Object),
      });
    });

    it('publish: true + 처음 발행이면 publishedAt을 새로 설정하고 요약을 요청한다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        publishedAt: null,
      });
      mockPrisma.post.update.mockResolvedValue({
        id: 'p1',
        title: '제목',
        content: '본문',
      });
      mockPrisma.postSummary.upsert.mockResolvedValue({});

      await service.update('user-1', 'p1', {
        title: '제목',
        content: '본문',
        publish: true,
      });

      expect(mockPrisma.post.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: {
          title: '제목',
          content: '본문',
          publishedAt: expect.any(Date),
          lastEditedAt: expect.any(Date),
        },
        include: expect.any(Object),
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/summarize'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(mockPrisma.postSummary.upsert).toHaveBeenCalledWith({
        where: { postId: 'p1' },
        create: { postId: 'p1', summary: ['요약1'] },
        update: { summary: ['요약1'] },
      });
    });

    it('이미 발행된 글이면 기존 publishedAt을 그대로 유지한다', async () => {
      const existingPublishedAt = new Date('2026-01-01');
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        publishedAt: existingPublishedAt,
      });
      mockPrisma.post.update.mockResolvedValue({
        id: 'p1',
        title: '제목',
        content: '본문',
      });

      await service.update('user-1', 'p1', {
        title: '제목',
        content: '본문',
        publish: true,
      });

      expect(mockPrisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ publishedAt: existingPublishedAt }),
        }),
      );
    });

    it('처음 발행하면 publishedAt과 lastEditedAt이 같은 시각이다 (= 수정 안 함)', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        publishedAt: null,
      });
      mockPrisma.post.update.mockResolvedValue({ id: 'p1', content: '' });

      await service.update('user-1', 'p1', { publish: true });

      const { data } = mockPrisma.post.update.mock.calls[0][0];
      expect(data.publishedAt).toBeInstanceOf(Date);
      expect(data.lastEditedAt).toBe(data.publishedAt);
    });

    it('이미 발행된 글을 다시 저장하면 lastEditedAt만 지금 시각으로 바뀐다', async () => {
      const existingPublishedAt = new Date('2026-01-01');
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        publishedAt: existingPublishedAt,
      });
      mockPrisma.post.update.mockResolvedValue({ id: 'p1', content: '' });

      const before = Date.now();
      await service.update('user-1', 'p1', { publish: true });

      const { data } = mockPrisma.post.update.mock.calls[0][0];
      expect(data.publishedAt).toBe(existingPublishedAt);
      expect(data.lastEditedAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('publish 없이 저장(임시저장·핀·비공개 전환)하면 lastEditedAt을 건드리지 않는다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        publishedAt: new Date('2026-09-01'),
      });
      mockPrisma.post.update.mockResolvedValue({ id: 'p1' });

      await service.update('user-1', 'p1', { content: '자동저장' });
      await service.update('user-1', 'p1', { pinned: true });
      await service.update('user-1', 'p1', { isPrivate: true });

      for (const [arg] of mockPrisma.post.update.mock.calls) {
        expect(arg.data).not.toHaveProperty('lastEditedAt');
      }
    });

    it('내용이 비어 있으면 발행이어도 요약을 요청하지 않는다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        publishedAt: null,
      });
      mockPrisma.post.update.mockResolvedValue({
        id: 'p1',
        title: '',
        content: '<p></p>',
      });

      await service.update('user-1', 'p1', {
        title: '',
        content: '<p></p>',
        publish: true,
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('AI가 빈 요약을 돌려주면 기존 요약을 덮어쓰지 않는다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        publishedAt: new Date('2026-09-01'),
      });
      mockPrisma.post.update.mockResolvedValue({
        id: 'p1',
        title: '제목',
        content: '본문',
      });
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ summary: [] }),
      } as Response);

      await service.update('user-1', 'p1', {
        title: '제목',
        content: '본문',
        publish: true,
      });

      expect(mockPrisma.postSummary.upsert).not.toHaveBeenCalled();
    });

    it('요약 API 호출이 실패해도 update 자체는 성공한다 (fail-open)', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        publishedAt: null,
      });
      mockPrisma.post.update.mockResolvedValue({
        id: 'p1',
        title: '제목',
        content: '본문',
      });
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('AI 서버 다운'));

      const result = await service.update('user-1', 'p1', {
        title: '제목',
        content: '본문',
        publish: true,
      });

      expect(result).toEqual({ id: 'p1', title: '제목', content: '본문' });
    });
  });

  describe('resummarize', () => {
    it('본인 글이 아니면 ForbiddenException', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'owner',
        content: '본문',
      });

      await expect(service.resummarize('other', 'p1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('본문이 비어 있으면 BadRequestException', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        content: '<p></p>',
      });

      await expect(service.resummarize('u1', 'p1')).rejects.toThrow(
        BadRequestException,
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('저장된 제목·본문으로 요약을 새로 만들어 저장하고 돌려준다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        title: '제목',
        content: '<p>본문</p>',
      });
      mockPrisma.postSummary.upsert.mockResolvedValue({});

      const result = await service.resummarize('u1', 'p1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/summarize'),
        expect.objectContaining({
          body: JSON.stringify({ title: '제목', content: '<p>본문</p>' }),
        }),
      );
      expect(mockPrisma.postSummary.upsert).toHaveBeenCalledWith({
        where: { postId: 'p1' },
        create: { postId: 'p1', summary: ['요약1'] },
        update: { summary: ['요약1'] },
      });
      expect(result).toEqual({ summary: ['요약1'] });
    });

    it('AI 호출이 실패하면 저장된 요약은 건드리지 않고 BadGatewayException', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        title: '제목',
        content: '<p>본문</p>',
      });
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue({ ok: false, status: 500 } as Response);

      await expect(service.resummarize('u1', 'p1')).rejects.toThrow(
        BadGatewayException,
      );
      expect(mockPrisma.postSummary.upsert).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('본인 글이 아니면 ForbiddenException', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'owner',
      });

      await expect(service.remove('other-user', 'p1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.post.delete).not.toHaveBeenCalled();
    });

    it('본인 글이면 삭제하고 inote-ai 세션 삭제도 요청한다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
      });
      mockPrisma.post.delete.mockResolvedValue({ id: 'p1' });

      await service.remove('user-1', 'p1');

      expect(mockPrisma.post.delete).toHaveBeenCalledWith({
        where: { id: 'p1' },
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/p1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('inote-ai 세션 삭제가 실패해도 글 삭제 결과는 그대로 반환한다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
      });
      mockPrisma.post.delete.mockResolvedValue({ id: 'p1' });
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('AI 서버 다운'));

      const result = await service.remove('user-1', 'p1');

      expect(result).toEqual({ id: 'p1' });
    });
  });
});
