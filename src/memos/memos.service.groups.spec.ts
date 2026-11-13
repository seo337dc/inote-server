import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MemosService } from './memos.service';
import { PrismaService } from '../prisma/prisma.service';
import { decodeGroupCursor, encodeGroupCursor } from './memo-cursor';

// 메모 관리 화면용 그룹 목록 — 계약: inote 레포 docs/todo/memo.md '4차' (GET /memos/groups)
//  - 글·독서는 대상 하나가 한 그룹, 일반 메모는 한 장이 한 그룹 (key = 메모 id)
//  - 그룹의 updatedAt 내림차순, 같으면 key 내림차순, 키셋 페이지네이션 (limit+1건으로 다음 페이지 유무 판단)
//  - 그룹 키 목록은 $queryRaw 한 번, 그 그룹들의 메모는 findMany 한 번 (N+1 아님), 제목은 종류별 한 번
// SQL의 정렬·커서 조건 자체는 DB가 있어야 확인되므로 개발 DB 통합 확인(HTTP)에서 본다 — 여기서는 어떤 값으로 부르고 어떻게 조립하는지를 본다.
describe('MemosService — findGroups', () => {
  let service: MemosService;

  const mockPrisma = {
    $queryRaw: jest.fn(),
    memo: { findMany: jest.fn() },
    post: { findMany: jest.fn() },
    readingLog: { findMany: jest.fn() },
  };

  const T = (d: number) =>
    new Date(`2026-11-${String(d).padStart(2, '0')}T00:00:00.000Z`);
  const row = (
    key: string,
    targetType: string,
    targetId: string,
    updatedAt: Date,
  ) => ({ key, targetType, targetId, updatedAt });
  const memo = (
    id: string,
    targetType: string,
    targetId: string,
    updatedAt: Date,
  ) => ({
    id,
    targetType,
    targetId,
    title: '',
    content: id,
    createdAt: T(1),
    updatedAt,
  });
  // $queryRaw에 넘어간 Sql 객체의 바인딩 값들
  const rawValues = (): unknown[] =>
    (mockPrisma.$queryRaw.mock.calls[0][0] as Prisma.Sql).values;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.memo.findMany.mockResolvedValue([]);
    mockPrisma.post.findMany.mockResolvedValue([]);
    mockPrisma.readingLog.findMany.mockResolvedValue([]);
    const module = await Test.createTestingModule({
      providers: [
        MemosService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(MemosService);
  });

  it('메모가 없으면 빈 목록이고 메모·제목은 읽지 않는다', async () => {
    const result = await service.findGroups('u1', {});

    expect(result).toEqual({ items: [], nextCursor: null });
    expect(mockPrisma.memo.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.post.findMany).not.toHaveBeenCalled();
  });

  it('그룹 키는 $queryRaw 한 번으로 조회하고, 기본은 20개 + 1(다음 페이지 유무 확인)이다', async () => {
    await service.findGroups('u1', {});

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(rawValues()).toContain('u1');
    expect(rawValues()).toContain(21);
  });

  it('limit을 주면 limit + 1건을 조회한다', async () => {
    await service.findGroups('u1', { limit: 5 });

    expect(rawValues()).toContain(6);
  });

  it('targetType을 주면 그 종류만 묻고, 안 주면 종류 조건 값이 없다', async () => {
    await service.findGroups('u1', { targetType: 'post' });
    expect(rawValues()).toContain('post');

    mockPrisma.$queryRaw.mockClear();
    await service.findGroups('u1', {});
    expect(rawValues()).not.toContain('post');
    expect(rawValues()).not.toContain('reading');
  });

  it('cursor가 오면 그 (updatedAt, key)를 조건 값으로 넘긴다', async () => {
    const cursor = encodeGroupCursor({ updatedAt: T(5), key: 'post:p1' });

    await service.findGroups('u1', { cursor });

    expect(rawValues()).toContain('post:p1');
    expect(
      rawValues().some(
        (v) => v instanceof Date && v.getTime() === T(5).getTime(),
      ),
    ).toBe(true);
  });

  it('잘못된 cursor는 BadRequestException이고 DB를 읽지 않는다', async () => {
    await expect(
      service.findGroups('u1', { cursor: 'garbage' }),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('그룹 순서는 조회한 행 순서 그대로이고, 응답에 key·targetType·targetId·updatedAt·memos가 있다', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      row('g2', 'general', '', T(12)),
      row('post:p1', 'post', 'p1', T(10)),
    ]);
    mockPrisma.memo.findMany.mockResolvedValue([
      memo('g2', 'general', '', T(12)),
      memo('a', 'post', 'p1', T(10)),
    ]);

    const { items } = await service.findGroups('u1', {});

    expect(items.map((g) => g.key)).toEqual(['g2', 'post:p1']);
    expect(items[1]).toMatchObject({
      key: 'post:p1',
      targetType: 'post',
      targetId: 'p1',
      updatedAt: T(10),
    });
  });

  it('글·독서 그룹은 그 대상의 메모 전부를, 일반 그룹은 그 메모 한 장만 담는다 (DB가 최근 수정순으로 준 순서 그대로)', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      row('post:p1', 'post', 'p1', T(9)),
      row('g1', 'general', '', T(8)),
    ]);
    // findMany는 updatedAt 내림차순으로 정렬해서 준다(아래 orderBy 테스트)
    mockPrisma.memo.findMany.mockResolvedValue([
      memo('new', 'post', 'p1', T(9)),
      memo('g1', 'general', '', T(8)),
      memo('old', 'post', 'p1', T(3)),
      memo('g-other', 'general', '', T(2)), // 이 페이지의 그룹이 아닌 일반 메모는 섞이지 않는다
    ]);

    const { items } = await service.findGroups('u1', {});

    expect(items[0].memos.map((m) => m.id)).toEqual(['new', 'old']);
    expect(items[1].memos.map((m) => m.id)).toEqual(['g1']);
  });

  it('메모는 최근 수정순(updatedAt desc)으로 조회한다 — 그룹 안 메모 순서가 이 정렬을 따른다', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      row('post:p1', 'post', 'p1', T(9)),
    ]);

    await service.findGroups('u1', {});

    expect(mockPrisma.memo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: expect.arrayContaining([{ updatedAt: 'desc' }]),
      }),
    );
  });

  it('메모는 이 페이지 그룹들의 것만 내 것(userId)으로 한 번에 조회한다 (N+1 아님)', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      row('post:p1', 'post', 'p1', T(9)),
      row('reading:r1', 'reading', 'r1', T(8)),
      row('g1', 'general', '', T(7)),
    ]);

    await service.findGroups('u1', {});

    expect(mockPrisma.memo.findMany).toHaveBeenCalledTimes(1);
    const { where } = mockPrisma.memo.findMany.mock.calls[0][0] as {
      where: { userId: string; OR: unknown[] };
    };
    expect(where.userId).toBe('u1');
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { targetType: 'post', targetId: { in: ['p1'] } },
        { targetType: 'reading', targetId: { in: ['r1'] } },
        { targetType: 'general', id: { in: ['g1'] } },
      ]),
    );
  });

  it('글·독서 그룹에는 대상 제목(targetTitle)이 붙고, 일반 그룹과 사라진 대상은 null이다', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      row('post:p1', 'post', 'p1', T(9)),
      row('reading:r1', 'reading', 'r1', T(8)),
      row('post:gone', 'post', 'gone', T(7)),
      row('g1', 'general', '', T(6)),
    ]);
    mockPrisma.memo.findMany.mockResolvedValue([
      memo('a', 'post', 'p1', T(9)),
      memo('b', 'reading', 'r1', T(8)),
      memo('c', 'post', 'gone', T(7)),
      memo('g1', 'general', '', T(6)),
    ]);
    mockPrisma.post.findMany.mockResolvedValue([
      { id: 'p1', title: '글 제목' },
    ]);
    mockPrisma.readingLog.findMany.mockResolvedValue([
      { id: 'r1', title: '책 제목' },
    ]);

    const { items } = await service.findGroups('u1', {});

    expect(items.map((g) => g.targetTitle)).toEqual([
      '글 제목',
      '책 제목',
      null,
      null,
    ]);
  });

  it('조회한 그룹이 limit개를 넘으면(limit+1건) limit개만 돌려주고 마지막 그룹으로 nextCursor를 만든다', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      row('g3', 'general', '', T(12)),
      row('g2', 'general', '', T(11)),
      row('g1', 'general', '', T(10)), // limit+1번째 — 다음 페이지 유무 확인용, 응답에는 넣지 않는다
    ]);
    mockPrisma.memo.findMany.mockResolvedValue([
      memo('g3', 'general', '', T(12)),
      memo('g2', 'general', '', T(11)),
    ]);

    const { items, nextCursor } = await service.findGroups('u1', { limit: 2 });

    expect(items.map((g) => g.key)).toEqual(['g3', 'g2']);
    expect(nextCursor).not.toBeNull();
    expect(decodeGroupCursor(nextCursor!)).toEqual({
      updatedAt: T(11),
      key: 'g2',
    });
  });

  it('정확히 limit개면 다음 페이지가 없다 (nextCursor null)', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      row('g2', 'general', '', T(12)),
      row('g1', 'general', '', T(11)),
    ]);
    mockPrisma.memo.findMany.mockResolvedValue([
      memo('g2', 'general', '', T(12)),
      memo('g1', 'general', '', T(11)),
    ]);

    const { nextCursor } = await service.findGroups('u1', { limit: 2 });

    expect(nextCursor).toBeNull();
  });

  it('limit+1번째 그룹의 메모는 읽지 않는다', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      row('g2', 'general', '', T(12)),
      row('g1', 'general', '', T(11)),
    ]);

    await service.findGroups('u1', { limit: 1 });

    const { where } = mockPrisma.memo.findMany.mock.calls[0][0] as {
      where: { OR: unknown[] };
    };
    expect(where.OR).toEqual([{ targetType: 'general', id: { in: ['g2'] } }]);
  });
});
