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
      expect(result.items).toEqual([{ id: 'a' }]);
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

  describe('findOne', () => {
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
