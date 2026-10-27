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
import { R2Service } from '../uploads/r2.service';

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
      findUnique: jest.fn(),
    },
    // 작성자 목록(findAll userId)이 작성자 정보를 읽는다
    user: {
      findUnique: jest.fn(),
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
        // 저장 때 이미지 승격에 쓰인다 — 이 파일의 관심사가 아니라 비어 있는 mock
        {
          provide: R2Service,
          useValue: {
            copy: jest.fn(),
            delete: jest.fn().mockResolvedValue(undefined),
            deletePrefix: jest.fn().mockResolvedValue(undefined),
            publicBaseUrl: jest.fn().mockReturnValue(''),
          },
        },
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

    // TODO(테스트): 다른 사람의 글 상세 카테고리 트리 API (구현됨: findUserOutline, GET /blog/posts/outline/user/:userId) — 나중에 작성할 테스트 목록.
    //  mock: mockPrisma.user.findUnique, post.findMany, post.groupBy, postCategory.findMany
    //  - 글은 { userId, publishedAt not null, isPrivate false }만 — 그 작성자의 비공개·임시저장 글은 본인이 불러도 안 나온다
    //  - select는 id·title·category·isPrivate·pinned만(본문 없음), 최신순(createdAt desc), 최대 500개
    //  - categories는 공개 글이 있는 것만 (publicCategorySummary와 같은 규칙: 하위에만 있어도 부모 포함, 비공개만 있는 카테고리 제외)
    //  - author는 { id, name } (이메일 없음), 없는 사용자면 null이고 목록들은 비어 있다(오류 아님)
    //  - 라우트: 'outline/user/:userId'가 ':id'(단건 조회)보다 먼저 잡히고 로그인 없이 호출된다
    // TODO(테스트): 작성자별 공개 글 목록 (구현됨: findAll의 userId) — 나중에 작성할 테스트 목록.
    //  mock: mockPrisma.user.findUnique를 추가한다 (기존 mockPrisma에는 user가 없음)
    //  - userId가 있으면 고정 조회·일반 조회·count 모두 where에 { userId }가 더해진다 (publishedAt not null, isPrivate false는 그대로)
    //  - 그 작성자의 비공개·임시저장 글은 본인이 불러도 이 목록에 나오지 않는다 (where에 isPrivate: false, publishedAt not null)
    //  - 응답에 author가 { id, name }으로 붙는다 (user.findUnique select는 id·name만 — 이메일 등 노출 금지)
    //  - 없는 사용자(findUnique가 null)면 author는 null이고 목록은 비어 있다 (오류 아님)
    //  - 글이 0개(검색 결과 없음)여도 author는 채워진다
    //  - 카테고리 목록(categories): 그 작성자의 PostCategory 중 공개 글이 있는 것만 — 자기 이름의 공개 글이 있거나 하위 중 하나라도 있으면 포함
    //    (비공개 글만 있는 카테고리·글이 없는 카테고리는 제외 → 이름이 새지 않는다). select는 id·name·parentId·depth·createdAt, 정렬 depth→createdAt
    //  - 카테고리별 개수(categoryCounts): post.groupBy({ by: ['category'], where: { userId, publishedAt not null, isPrivate false } }) 결과를 {이름: 개수}로
    //  - 개수는 category·q 필터와 상관없이 그 작성자의 공개 글 전체 기준 (나의 글 categoryCounts와 같은 방식)
    //  - 순환 데이터(parentId가 서로를 가리킴)여도 끝난다 / userId가 없으면 위 둘 다 조회하지 않고 응답에 없다
    //  - userId가 없으면 user 조회를 하지 않고 응답에 author 필드 자체가 없다
    //  - category·q와 함께 써도 서로 덮어쓰지 않는다 (userId는 최상위 키라 OR와 충돌 없음)
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
    describe('카테고리 필터 (categoryId, 하위 카테고리 포함)', () => {
      // 학습(c1) > AI(c2) > RAG(c3), 사이드프로젝트(c4) > AI(c5) — 이름이 같은 AI가 두 곳에 있다
      const TREE = [
        { id: 'c1', parentId: null },
        { id: 'c2', parentId: 'c1' },
        { id: 'c3', parentId: 'c2' },
        { id: 'c4', parentId: null },
        { id: 'c5', parentId: 'c4' },
      ];

      beforeEach(() => {
        mockPrisma.post.findMany.mockResolvedValue([]);
        mockPrisma.post.count.mockResolvedValue(0);
        mockPrisma.postCategory.findUnique.mockResolvedValue({
          userId: 'owner',
        });
        mockPrisma.postCategory.findMany.mockResolvedValue(TREE);
      });

      const whereOf = (n: number) =>
        (
          mockPrisma.post.findMany.mock.calls[n - 1] as [
            { where: Record<string, unknown> },
          ]
        )[0].where;

      it('하위 카테고리가 있으면 그 카테고리와 아래 전부의 글을 포함한다 (3단계까지)', async () => {
        await service.findAll({ categoryId: 'c1' });

        // 고정 글(1번째)·일반 글(2번째) 조회가 같은 필터를 쓴다
        for (const n of [1, 2]) {
          expect(whereOf(n)).toEqual(
            expect.objectContaining({ categoryId: { in: ['c1', 'c2', 'c3'] } }),
          );
        }
      });

      it('중간 카테고리를 고르면 그 아래만 더해진다 (위쪽 부모는 포함 안 됨)', async () => {
        await service.findAll({ categoryId: 'c2' });

        expect(whereOf(2)).toEqual(
          expect.objectContaining({ categoryId: { in: ['c2', 'c3'] } }),
        );
      });

      it('이름이 같은 다른 카테고리(사이드프로젝트 > AI)의 글은 섞이지 않는다', async () => {
        await service.findAll({ categoryId: 'c2' }); // 학습 > AI

        const filter = whereOf(2).categoryId as { in: string[] };
        expect(filter.in).not.toContain('c5');
      });

      it('맨 아래 카테고리(하위 없음)는 그 id 하나로 정확히 거른다 (in이 아님)', async () => {
        await service.findAll({ categoryId: 'c5' });

        expect(whereOf(2)).toEqual(
          expect.objectContaining({ categoryId: 'c5' }),
        );
      });

      it('공개 목록은 그 카테고리의 주인을 먼저 찾고, 그 주인의 트리만 읽는다', async () => {
        await service.findAll({ categoryId: 'c1' });

        expect(mockPrisma.postCategory.findUnique).toHaveBeenCalledWith({
          where: { id: 'c1' },
          select: { userId: true },
        });
        expect(mockPrisma.postCategory.findMany).toHaveBeenCalledWith({
          where: { userId: 'owner' },
          select: { id: true, parentId: true },
        });
      });

      it('없는 카테고리 id면 트리를 읽지 않고 그 id로만 거른다 (아무 글도 안 걸리는 조건, 오류 아님)', async () => {
        mockPrisma.postCategory.findUnique.mockResolvedValue(null);

        await service.findAll({ categoryId: 'nope' });

        expect(whereOf(2)).toEqual(
          expect.objectContaining({ categoryId: 'nope' }),
        );
        expect(mockPrisma.postCategory.findMany).not.toHaveBeenCalled();
      });

      it('categoryId가 없으면 카테고리를 전혀 조회하지 않는다', async () => {
        await service.findAll({});

        expect(mockPrisma.postCategory.findUnique).not.toHaveBeenCalled();
        expect(whereOf(2)).not.toHaveProperty('categoryId');
      });

      it('부모가 서로를 가리키는 순환 데이터여도 끝난다', async () => {
        mockPrisma.postCategory.findMany.mockResolvedValue([
          { id: 'a', parentId: 'b' },
          { id: 'b', parentId: 'a' },
        ]);

        await service.findAll({ categoryId: 'a' });

        expect(whereOf(2)).toEqual(
          expect.objectContaining({ categoryId: { in: ['a', 'b'] } }),
        );
      });
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
              archivedAt: null,
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

      mockPrisma.postCategory.findUnique.mockResolvedValue(null); // 하위 없는 단순한 경우로 둔다

      await service.findAll({ categoryId: 'c-study', q: '리액트' });

      expect(mockPrisma.post.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId: 'c-study',
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
      categoryId: true,
      isPrivate: true,
      pinned: true,
    };

    it('내가 발행한 글(비공개 포함)만 제목·카테고리(id 포함)만 골라 마지막 저장순으로 조회한다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([{ id: 'a' }]);

      const result = await service.findOutline('u1');

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1', publishedAt: { not: null }, archivedAt: null },
        select: SELECT,
        orderBy: LIST_ORDER,
        take: 500,
      });
      expect(result).toEqual([{ id: 'a' }]);
    });

    it('draft(발행 전)는 제외한다 — where에 publishedAt not null', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);

      await service.findOutline('u1');

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ publishedAt: { not: null } }),
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
        { categoryId: 'c-study', _count: { _all: 3 } },
        { categoryId: 'c-job', _count: { _all: 1 } },
        { categoryId: null, _count: { _all: 2 } },
      ]);

      const result = await service.findMine('user-1', {
        page: 1,
        pageSize: 10,
      });

      expect(mockPrisma.post.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: {
            userId: 'user-1',
            NOT: EMPTY_DRAFT,
            archivedAt: null,
            pinned: true,
          },
        }),
      );
      expect(mockPrisma.post.groupBy).toHaveBeenCalledWith({
        by: ['categoryId'],
        where: { userId: 'user-1', NOT: EMPTY_DRAFT, archivedAt: null },
        _count: { _all: true },
      });
      // 카테고리 id → 직속 글 수. 아직 지정 안 된 글(categoryId null)은 'unassigned'
      expect(result.categoryCounts).toEqual({
        'c-study': 3,
        'c-job': 1,
        unassigned: 2,
      });
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
              archivedAt: null,
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
          where: { userId: 'user-1', NOT: EMPTY_DRAFT, archivedAt: null },
        }),
      );
    });

    it('categoryId 필터가 있어도 카테고리별 개수는 필터 없이 전체 기준으로 센다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);
      mockPrisma.post.count.mockResolvedValue(0);
      mockPrisma.post.groupBy.mockResolvedValue([]);
      mockPrisma.postCategory.findMany.mockResolvedValue([]);

      await service.findMine('user-1', { categoryId: 'c-study' });

      expect(mockPrisma.post.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', NOT: EMPTY_DRAFT, archivedAt: null },
        }),
      );
    });
  });

  describe('findMine — categoryId 필터', () => {
    it('내 글 목록은 카테고리 주인을 따로 찾지 않고 내 트리를 바로 읽어 하위까지 포함한다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);
      mockPrisma.post.count.mockResolvedValue(0);
      mockPrisma.post.groupBy.mockResolvedValue([]);
      mockPrisma.postCategory.findMany.mockResolvedValue([
        { id: 'c1', parentId: null },
        { id: 'c2', parentId: 'c1' },
      ]);

      await service.findMine('user-1', { categoryId: 'c1' });

      expect(mockPrisma.postCategory.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.postCategory.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { id: true, parentId: true },
      });
      expect(mockPrisma.post.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            categoryId: { in: ['c1', 'c2'] },
          }),
        }),
      );
    });
  });

  describe('카테고리 경로 (categoryPath = { id, name }[], categoryId 기준)', () => {
    // 학습(c1) > AI(c2), 사이드프로젝트(c4) > AI(c5) — 같은 이름 AI가 두 곳
    const TREE = [
      { id: 'c1', userId: 'u1', name: '학습', parentId: null },
      { id: 'c2', userId: 'u1', name: 'AI', parentId: 'c1' },
      { id: 'c4', userId: 'u1', name: '사이드프로젝트', parentId: null },
      { id: 'c5', userId: 'u1', name: 'AI', parentId: 'c4' },
    ];

    async function pathsOf(
      posts: { id: string; category: string; categoryId: string | null }[],
    ) {
      mockPrisma.post.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(posts.map((p) => ({ ...p, userId: 'u1' })));
      mockPrisma.post.count.mockResolvedValue(0);
      mockPrisma.post.groupBy.mockResolvedValue([]);
      mockPrisma.postCategory.findMany.mockResolvedValue(TREE);
      const result = await service.findMine('u1', {});
      return Object.fromEntries(
        result.items.map((i) => [i.id, i.categoryPath]),
      );
    }

    it('최상위부터 이 글의 카테고리까지 { id, name }으로 담는다', async () => {
      const paths = await pathsOf([
        { id: 'a', category: 'AI', categoryId: 'c2' },
        { id: 'b', category: '학습', categoryId: 'c1' },
      ]);

      expect(paths.a).toEqual([
        { id: 'c1', name: '학습' },
        { id: 'c2', name: 'AI' },
      ]);
      expect(paths.b).toEqual([{ id: 'c1', name: '학습' }]);
    });

    it('같은 이름이 두 곳이어도 글의 categoryId로 정확한 경로를 찾는다', async () => {
      const paths = await pathsOf([
        { id: 'study', category: 'AI', categoryId: 'c2' },
        { id: 'side', category: 'AI', categoryId: 'c5' },
      ]);

      expect(paths.study.map((p) => p.name)).toEqual(['학습', 'AI']);
      expect(paths.side.map((p) => p.name)).toEqual(['사이드프로젝트', 'AI']);
      expect(paths.side[1].id).toBe('c5');
    });

    it('카테고리가 아직 지정되지 않은 글(categoryId null)은 이름 사본 하나, id는 null이다', async () => {
      const paths = await pathsOf([
        { id: 'x', category: 'AI', categoryId: null },
      ]);

      expect(paths.x).toEqual([{ id: null, name: 'AI' }]);
    });

    it('이름 사본도 없으면(빈 draft 등) 빈 경로다', async () => {
      const paths = await pathsOf([
        { id: 'x', category: '', categoryId: null },
      ]);

      expect(paths.x).toEqual([]);
    });

    it('categoryId는 있는데 트리에서 못 찾으면 이름 사본 하나로 대신한다 (예외 없음)', async () => {
      const paths = await pathsOf([
        { id: 'x', category: '옛카테고리', categoryId: 'gone' },
      ]);

      expect(paths.x).toEqual([{ id: 'gone', name: '옛카테고리' }]);
    });

    it('카테고리가 지정된 글이 하나도 없으면 카테고리를 읽지 않는다', async () => {
      mockPrisma.post.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 'x', category: 'AI', categoryId: null, userId: 'u1' },
        ]);
      mockPrisma.post.count.mockResolvedValue(0);
      mockPrisma.post.groupBy.mockResolvedValue([]);

      await service.findMine('u1', {});

      expect(mockPrisma.postCategory.findMany).not.toHaveBeenCalled();
    });
  });

  describe('작성자 목록의 카테고리 요약 (findAll userId)', () => {
    it('글 수는 카테고리 id 기준(지정 안 된 글은 unassigned)이고, 공개 글이 있는 카테고리만 내려간다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);
      mockPrisma.post.count.mockResolvedValue(0);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        name: '작성자',
      });
      mockPrisma.post.groupBy.mockResolvedValue([
        { categoryId: 'c-ai', _count: { _all: 2 } },
        { categoryId: null, _count: { _all: 1 } },
      ]);
      const row = (id: string, name: string, parentId: string | null) => ({
        id,
        name,
        parentId,
        depth: parentId ? 2 : 1,
        createdAt: new Date('2026-01-01'),
      });
      mockPrisma.postCategory.findMany.mockResolvedValue([
        row('c-study', '학습', null),
        row('c-ai', 'AI', 'c-study'),
        row('c-diary', '일기', null), // 공개 글 없음 → 내려가지 않는다
        row('c-side-ai', 'AI', 'c-diary'), // 이름이 같은 AI지만 공개 글이 없다
      ]);

      const result = await service.findAll({ userId: 'u1' });

      expect(mockPrisma.post.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ by: ['categoryId'] }),
      );
      expect(result.categoryCounts).toEqual({ 'c-ai': 2, unassigned: 1 });
      // 학습은 하위 AI에 공개 글이 있어서 보이고, 일기·사이드 쪽 AI는 글이 없어 빠진다
      // categories는 목록 응답에만 붙는 필드라(작성자 필터일 때) 타입이 느슨해서 필요한 모양으로 좁혀 읽는다
      const ids = (result as { categories: { id: string }[] }).categories.map(
        (c) => c.id,
      );
      expect(ids).toEqual(['c-study', 'c-ai']);
    });
  });

  describe('findMyOutline', () => {
    // TODO(테스트): 내 글 목록 API (#7, 구현됨: findMyOutline) — 나중에 작성할 테스트 목록.
    //  mock: mockPrisma.post.findMany
    //  - where는 { userId, NOT: EMPTY_DRAFT } — 내 글만, 빈 임시저장은 제외(발행 전이어도 제목·본문이 있으면 포함)
    //  - select는 id·title·category·categoryId·isPrivate·publishedAt만 (본문 없음)
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

    describe('카테고리 (categoryId로 가리킨다)', () => {
      const OWN_POST = { id: 'p1', userId: 'user-1', publishedAt: null };

      beforeEach(() => {
        mockPrisma.post.findUnique.mockResolvedValue(OWN_POST);
        mockPrisma.post.update.mockResolvedValue({ id: 'p1' });
      });

      it('categoryId를 보내면 내 카테고리인지 확인하고, categoryId와 이름 사본(category)을 함께 저장한다', async () => {
        mockPrisma.postCategory.findUnique.mockResolvedValue({
          id: 'c-ai',
          userId: 'user-1',
          name: 'AI',
        });

        await service.update('user-1', 'p1', { categoryId: 'c-ai' });

        expect(mockPrisma.postCategory.findUnique).toHaveBeenCalledWith({
          where: { id: 'c-ai' },
        });
        expect(mockPrisma.post.update).toHaveBeenCalledWith({
          where: { id: 'p1' },
          data: { categoryId: 'c-ai', category: 'AI' },
          include: expect.any(Object),
        });
      });

      it('없는 카테고리 id면 NotFoundException — 글은 저장하지 않는다', async () => {
        mockPrisma.postCategory.findUnique.mockResolvedValue(null);

        await expect(
          service.update('user-1', 'p1', { categoryId: 'missing' }),
        ).rejects.toThrow(NotFoundException);
        expect(mockPrisma.post.update).not.toHaveBeenCalled();
      });

      it('남의 카테고리 id면 NotFoundException (존재 여부를 숨긴다)', async () => {
        mockPrisma.postCategory.findUnique.mockResolvedValue({
          id: 'c-other',
          userId: 'someone-else',
          name: 'AI',
        });

        await expect(
          service.update('user-1', 'p1', { categoryId: 'c-other' }),
        ).rejects.toThrow(NotFoundException);
        expect(mockPrisma.post.update).not.toHaveBeenCalled();
      });

      it('categoryId와 이름(category)이 같이 오면 categoryId가 우선이고 이름은 무시한다', async () => {
        mockPrisma.postCategory.findUnique.mockResolvedValue({
          id: 'c-ai',
          userId: 'user-1',
          name: 'AI',
        });

        await service.update('user-1', 'p1', {
          categoryId: 'c-ai',
          category: '엉뚱한 이름',
        });

        expect(mockPrisma.post.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { categoryId: 'c-ai', category: 'AI' },
          }),
        );
        expect(mockPrisma.postCategory.findMany).not.toHaveBeenCalled();
      });

      it('카테고리를 안 보내면 카테고리를 조회도 갱신도 하지 않는다 (자동저장 등)', async () => {
        await service.update('user-1', 'p1', { title: '제목만' });

        expect(mockPrisma.postCategory.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.postCategory.findMany).not.toHaveBeenCalled();
        expect(mockPrisma.post.update).toHaveBeenCalledWith({
          where: { id: 'p1' },
          data: { title: '제목만' },
          include: expect.any(Object),
        });
      });

      it('본인 글이 아니면 카테고리를 조회하기 전에 ForbiddenException', async () => {
        await expect(
          service.update('other-user', 'p1', { categoryId: 'c-ai' }),
        ).rejects.toThrow(ForbiddenException);
        expect(mockPrisma.postCategory.findUnique).not.toHaveBeenCalled();
      });

      describe('이전 방식: 이름(category)만 보낼 때', () => {
        it('내 카테고리 중 그 이름이 정확히 하나면 그 id를 이어서 저장한다', async () => {
          mockPrisma.postCategory.findMany.mockResolvedValueOnce([
            { id: 'c-study' },
          ]);

          await service.update('user-1', 'p1', { category: '학습' });

          expect(mockPrisma.postCategory.findMany).toHaveBeenCalledWith({
            where: { userId: 'user-1', name: '학습' },
            select: { id: true },
          });
          expect(mockPrisma.post.update).toHaveBeenCalledWith(
            expect.objectContaining({
              data: { category: '학습', categoryId: 'c-study' },
            }),
          );
        });

        it('같은 이름이 두 곳 이상이면 어느 쪽인지 알 수 없어 id는 비워 둔다', async () => {
          mockPrisma.postCategory.findMany.mockResolvedValueOnce([
            { id: 'c-study-ai' },
            { id: 'c-side-ai' },
          ]);

          await service.update('user-1', 'p1', { category: 'AI' });

          expect(mockPrisma.post.update).toHaveBeenCalledWith(
            expect.objectContaining({
              data: { category: 'AI', categoryId: null },
            }),
          );
        });

        it('내 트리에 없는 이름이면 이름만 저장하고 id는 비워 둔다', async () => {
          mockPrisma.postCategory.findMany.mockResolvedValueOnce([]);

          await service.update('user-1', 'p1', { category: '없는이름' });

          expect(mockPrisma.post.update).toHaveBeenCalledWith(
            expect.objectContaining({
              data: { category: '없는이름', categoryId: null },
            }),
          );
        });
      });
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
        content: '',
        publishedAt: null,
      });
      mockPrisma.post.update.mockResolvedValue({
        id: 'p1',
        title: '',
        content: '',
      });

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
        content: '',
        publishedAt: existingPublishedAt,
      });
      mockPrisma.post.update.mockResolvedValue({
        id: 'p1',
        title: '',
        content: '',
      });

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
        content: '',
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
        content: '',
      });
      mockPrisma.post.delete.mockResolvedValue({ id: 'p1' });
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('AI 서버 다운'));

      const result = await service.remove('user-1', 'p1');

      expect(result).toEqual({ id: 'p1' });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // TODO(직접 작성): 임베딩 연동 (A6-4) — 구현은 blog.service.ts의 update/remove/syncEmbedding.
  //
  // 준비: 이 블록의 beforeEach에서 process.env.EMBEDDINGS_ENABLED='true', INOTE_AI_URL, INTERNAL_SECRET을 설정하고
  //       afterEach에서 원복한다. 위 beforeEach의 fetch 목은 모든 호출을 성공으로 돌려주므로, 임베딩 호출만 따로
  //       고르려면 URL에 '/embeddings/posts/'가 들어간 호출만 걸러서 본다. 꺼져 있을 땐 fetch에 임베딩 호출이 없어야 한다.
  //       "기다리지 않는다"는 임베딩 호출의 응답을 deferred promise로 붙잡아 둔 채 update/remove가 끝나는지로 확인한다.
  describe('임베딩 연동 (A6-4)', () => {
    it.todo(
      'update publish:true → PUT /embeddings/posts/{id}에 {title, content}를 보내고, 요약 요청도 그대로 한다',
    );
    it.todo(
      'update 응답은 임베딩 응답을 기다리지 않는다 (임베딩 fetch가 끝나지 않아도 update가 끝난다)',
    );
    it.todo('update publish 없음(임시저장·핀·비공개 전환) → 임베딩 호출 없음');
    it.todo(
      'update publish + 제목·본문이 모두 빔("", "  ", "<p></p>") → PUT 없이 DELETE(이전 벡터 정리)',
    );
    it.todo('update publish + 제목만 있거나 본문만 있으면 PUT (빈 글만 제외)');
    it.todo('임베딩 호출이 실패해도 update는 성공한다 (fail-open)');
    it.todo('본인 글이 아니면(ForbiddenException) 임베딩 호출 없음');
    it.todo(
      'remove → DB 삭제 뒤 DELETE /embeddings/posts/{id}, 응답은 임베딩을 기다리지 않는다',
    );
    it.todo('remove 권한 없음 → 임베딩 호출 없음');
    it.todo(
      'EMBEDDINGS_ENABLED가 꺼져 있으면 update·remove 모두 임베딩 호출 없음',
    );
  });

  // ─────────────────────────────────────────────────────────────────
  // TODO(직접 작성): 비슷한 글 (B3) — 구현은 blog.service.ts의 findSimilar, 컨트롤러는 GET :id/similar.
  //
  // 준비: 임베딩 연동 블록과 같다 — process.env에 EMBEDDINGS_ENABLED='true', INOTE_AI_URL, INTERNAL_SECRET을 설정하고
  //       afterEach에서 원복. AI 응답은 fetch 목이 { ok: true, json: () => ({ items: [{ postId, score }] }) }를 돌려주게 한다.
  //       mockPrisma.post에 findUnique(이 글의 접근 확인)·findMany(첫 호출 = 후보 id, 둘째 호출 = 글 정보)를 쓴다.
  //       mockPrisma.postCategory.findMany는 카테고리 경로용(기본 [] 이면 [category]).
  //   컨트롤러 헤더를 시험하려면 인증 모듈(better-auth)이 ESM이라 jest.mock으로 '../auth/*.guard'를 대체해야 한다.
  //
  // 지켜야 할 약속(계약)
  //   1) 볼 수 없는 글(남의 draft·비공개, 없는 글)은 404 — 같은 메시지로 존재 여부를 숨긴다
  //   2) AI·임베딩 장애, 벡터 없음, 기준 미달, 꺼져 있음은 오류가 아니라 { items: [] }
  //   3) 후보 밖 id는 AI가 줘도 응답에 없고, 글 정보를 읽을 때 읽기 규칙을 다시 건다(이중 방어)
  //   4) 응답에 이메일·본문이 없다. isPrivate: true는 항상 isMine: true인 글에서만
  describe('비슷한 글 (B3)', () => {
    it.todo(
      '존재하지 않는 글 / 남의 draft / 남의 비공개 글이면 NotFoundException (비로그인 포함)',
    );
    it.todo(
      '작성자가 없는(userId null) 비공개 글을 비로그인이 우연히 통과하지 못한다',
    );
    it.todo(
      '내 draft는 접근할 수 있지만 AI를 부르지 않고 빈 목록, 내 비공개 글은 기준 글로 쓸 수 있다',
    );
    it.todo(
      'EMBEDDINGS_ENABLED가 꺼져 있으면 후보 조회도 AI 호출도 없이 빈 목록 (접근 확인은 먼저)',
    );
    it.todo(
      '후보 where는 readableCandidatesWhere(요청자, 이 글 id) — 비로그인은 userId 조건이 없다',
    );
    it.todo(
      'AI에는 postId·후보 id·limit·minScore를 넘기고, 글 정보 조회에도 같은 읽기 규칙을 AND로 다시 건다',
    );
    it.todo(
      'AI 점수 순서를 유지하고, 그 사이 지워졌거나 볼 수 없게 된 글은 빠진다',
    );
    it.todo(
      '응답 모양: id·title·category·categoryPath·isMine·isPrivate·user({name} 또는 null)·score',
    );
    it.todo(
      'isMine은 요청자와 작성자가 같을 때만 true (비로그인·작성자 없는 글은 false), isPrivate은 내 글일 때만 true',
    );
    it.todo('작성자의 이메일·본문이 응답에 없다');
    it.todo(
      'AI가 후보 밖 id(비공개 글)를 돌려줘도 응답에 없고 글 정보 조회도 하지 않는다',
    );
    it.todo(
      'AI 서버 장애·비정상 응답·시간 초과면 빈 목록이고 글 정보 조회를 하지 않는다',
    );
    it.todo('후보가 하나도 없으면 AI를 부르지 않는다');
    it.todo(
      '컨트롤러: Cache-Control: private, no-store를 걸고 Vary는 덧붙인다(res.vary), 요청자·limit(기본 5)을 서비스에 넘긴다',
    );
  });

  // ─────────────────────────────────────────────────────────────────
  // TODO(직접 작성): 공개 글 id 목록 (글 목록 채팅 1차, 결정 17) — 구현은 blog.service.ts의 listPublicPostIds,
  //       컨트롤러는 GET public-ids(InternalSecretGuard). inote-ai의 "글 찾기"가 검색 후보로 쓴다.
  //
  // 준비: findCandidateIds는 prisma.post.findMany만 쓰므로 mockPrisma.post.findMany가 [{ id }] 목록을 돌려주게 하면 된다.
  //   컨트롤러 가드를 시험하려면 인증 모듈(better-auth)이 ESM이라 jest.mock으로 '../auth/*.guard'를 대체해야 한다.
  //
  // 지켜야 할 약속(계약)
  //   1) 발행됨 AND 공개인 글만 — 임시저장·비공개 글 id가 섞이면 안 된다 (비공개 유출의 입구)
  //   2) 비밀키가 없거나 틀리면 401 — 공개 글 id라도 내부 전용이다
  //   3) 'public-ids'가 ':id' 라우트보다 앞에 있어 id로 해석되지 않는다
  describe('공개 글 id 목록 (글 목록 채팅)', () => {
    it.todo(
      '{ ids: [...] } 모양으로 돌려주고, where는 publicCandidatesWhere()와 같다 (발행됨 AND 비공개 아님)',
    );
    it.todo(
      '최근 저장순으로 읽고 5000개 상한을 넘으면 오래된 글을 잘라 경고한다 (findCandidateIds 재사용)',
    );
    it.todo('글이 없으면 { ids: [] }');
    it.todo('컨트롤러: 올바른 내부 비밀키로만 접근되고 없거나 틀리면 401이다');
    it.todo(
      'GET /blog/posts/public-ids가 GET /blog/posts/:id로 가지 않는다 (라우트 순서)',
    );
  });
});
