import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MemosService } from './memos.service';
import { PrismaService } from '../prisma/prisma.service';

// 응답에 싣는 필드 — userId(작성자) 같은 내부 필드는 뺀다. 서비스의 MEMO_SELECT와 일부러 따로 적어서,
// 누군가 select를 바꾸면(예: userId를 추가) 이 테스트가 깨지도록 한다.
const EXPECTED_SELECT = {
  id: true,
  targetType: true,
  targetId: true,
  title: true,
  content: true,
  createdAt: true,
  updatedAt: true,
};

describe('MemosService', () => {
  let service: MemosService;

  // 서비스가 쓰는 Prisma 메서드만 jest.fn()으로 만든다. 테스트마다 mockResolvedValue로 "DB가 이렇게 답한다"를 정한다.
  const mockPrisma = {
    memo: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(), // 대상당 메모 장 수 (상한 확인)
      delete: jest.fn(),
    },
    // 장 수 확인 + 만들기를 한 트랜잭션으로 묶는다. 기본은 같은 mock을 tx로 넘긴다(아래 beforeEach).
    $transaction: jest.fn(),
    // 메모를 붙일 대상(글/독서 기록)의 작성자를 확인할 때 읽는다
    // findAll이 글·독서 기록의 제목(targetTitle)을 읽을 때는 findMany를 쓴다
    post: { findUnique: jest.fn(), findMany: jest.fn() },
    readingLog: { findUnique: jest.fn(), findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // 장 수 기본값 0 — 설정하지 않으면 undefined가 되어 "10장 미만"으로 우연히 통과하는 테스트가 생긴다
    mockPrisma.memo.count.mockResolvedValue(0);
    mockPrisma.post.findMany.mockResolvedValue([]);
    mockPrisma.readingLog.findMany.mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof mockPrisma) => unknown) => fn(mockPrisma),
    );

    const module = await Test.createTestingModule({
      providers: [
        MemosService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(MemosService);
  });

  // ─────────────────────────────────────────────────────────────────
  // create — 메모는 "내가 쓴 글·독서 기록"에만 붙일 수 있다
  //
  // 모든 테스트가 같은 순서로 읽힌다: Arrange(DB가 이렇게 답한다) → Act(서비스 호출) → Assert(결과·호출 인자).
  // 서비스는 대상을 select: { userId: true }로만 읽으므로 mock은 { userId: '...' } 모양이면 된다.
  // draft(임시저장) 글인지는 서비스가 보지 않는다 — draft여도 같은 모양이라 "본인 글" 케이스가 곧 draft 케이스다.
  // ─────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('본인 글이면 userId와 함께 메모를 만든다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'u1' });
      mockPrisma.memo.create.mockResolvedValue({
        id: 'm1',
        content: '첫 메모',
      });

      const result = await service.create('u1', {
        targetType: 'post',
        targetId: 'p1',
        content: '첫 메모',
      });

      expect(mockPrisma.memo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId: 'u1',
            targetType: 'post',
            targetId: 'p1',
            content: '첫 메모',
          },
        }),
      );
      expect(result).toEqual({ id: 'm1', content: '첫 메모' });
    });

    it('대상 글은 id로, 작성자(userId)만 읽어서 확인한다', async () => {
      // 글 본문 같은 큰 필드를 읽지 않는다는 것까지 고정한다 (메모를 쓸 때마다 호출되는 경로)
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'u1' });
      mockPrisma.memo.create.mockResolvedValue({ id: 'm1' });

      await service.create('u1', {
        targetType: 'post',
        targetId: 'p1',
        content: 'x',
      });

      expect(mockPrisma.post.findUnique).toHaveBeenCalledWith({
        where: { id: 'p1' },
        select: { userId: true },
      });
    });

    it('남의 글이면 ForbiddenException이고 메모를 만들지 않는다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'owner' });

      await expect(
        service.create('other', {
          targetType: 'post',
          targetId: 'p1',
          content: 'x',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.memo.create).not.toHaveBeenCalled();
    });

    it('작성자가 없는 글(userId null)이면 ForbiddenException이다', async () => {
      // 탈퇴한 작성자의 글·옛 글은 userId가 null이다. null은 어떤 사용자 id와도 같지 않으므로 거부된다.
      mockPrisma.post.findUnique.mockResolvedValue({ userId: null });

      await expect(
        service.create('u1', {
          targetType: 'post',
          targetId: 'p1',
          content: 'x',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.memo.create).not.toHaveBeenCalled();
    });

    it('없는 글이면 NotFoundException이고 메모를 만들지 않는다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null);

      await expect(
        service.create('u1', {
          targetType: 'post',
          targetId: 'nope',
          content: 'x',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.memo.create).not.toHaveBeenCalled();
    });

    it('빈 문자열 content로도 만들 수 있다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'u1' });
      mockPrisma.memo.create.mockResolvedValue({ id: 'm1', content: '' });

      await service.create('u1', {
        targetType: 'post',
        targetId: 'p1',
        content: '',
      });

      expect(mockPrisma.memo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ content: '' }),
        }),
      );
    });

    it('응답에 userId를 싣지 않도록 select를 지정해서 만든다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'u1' });
      mockPrisma.memo.create.mockResolvedValue({ id: 'm1' });

      await service.create('u1', {
        targetType: 'post',
        targetId: 'p1',
        content: 'x',
      });

      expect(mockPrisma.memo.create).toHaveBeenCalledWith(
        expect.objectContaining({ select: EXPECTED_SELECT }),
      );
    });

    // 독서 기록 — targetType이 'reading'이면 post가 아니라 readingLog를 조회해야 한다
    it('독서 기록: 본인 기록이면 메모를 만든다 (post는 조회하지 않는다)', async () => {
      mockPrisma.readingLog.findUnique.mockResolvedValue({ userId: 'u1' });
      mockPrisma.memo.create.mockResolvedValue({ id: 'm1' });

      await service.create('u1', {
        targetType: 'reading',
        targetId: 'r1',
        content: '독서 메모',
      });

      expect(mockPrisma.readingLog.findUnique).toHaveBeenCalledWith({
        where: { id: 'r1' },
        select: { userId: true },
      });
      expect(mockPrisma.post.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.memo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            userId: 'u1',
            targetType: 'reading',
            targetId: 'r1',
            content: '독서 메모',
          },
        }),
      );
    });

    it('독서 기록: 남의 기록이면 ForbiddenException이다', async () => {
      mockPrisma.readingLog.findUnique.mockResolvedValue({ userId: 'owner' });

      await expect(
        service.create('other', {
          targetType: 'reading',
          targetId: 'r1',
          content: 'x',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.memo.create).not.toHaveBeenCalled();
    });

    it('독서 기록: 없는 기록이면 NotFoundException이다', async () => {
      mockPrisma.readingLog.findUnique.mockResolvedValue(null);

      await expect(
        service.create('u1', {
          targetType: 'reading',
          targetId: 'nope',
          content: 'x',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.memo.create).not.toHaveBeenCalled();
    });

    // ─ create: 제목, 장 수 상한(대상당 10장, 넘으면 409) ─────────────────
    // 공통 Arrange: mockPrisma.post.findUnique.mockResolvedValue({ userId: 'u1' }) (본인 글)
    describe('일반 메모 general (3차)', () => {
      beforeEach(() => {
        mockPrisma.memo.create.mockResolvedValue({ id: 'g1' });
      });

      it('글·독서 기록 소유 검증을 하지 않고 만든다 (대상이 없다)', async () => {
        await service.create('u1', {
          targetType: 'general',
          content: '장보기',
        });

        expect(mockPrisma.post.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.readingLog.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.memo.create).toHaveBeenCalledTimes(1);
      });

      it('targetId는 빈 문자열로 저장한다', async () => {
        await service.create('u1', { targetType: 'general', title: '장보기' });

        expect(mockPrisma.memo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              userId: 'u1',
              targetType: 'general',
              targetId: '',
              title: '장보기',
            }),
          }),
        );
      });

      it('클라이언트가 targetId를 보내도 무시하고 빈 문자열로 저장한다', async () => {
        await service.create('u1', {
          targetType: 'general',
          targetId: 'someone-elses-post',
        });

        const { data } = mockPrisma.memo.create.mock.calls[0][0] as {
          data: { targetId: string };
        };
        expect(data.targetId).toBe('');
      });

      it('장 수는 내 일반 메모 전체를 센다 (userId + general + 빈 targetId)', async () => {
        await service.create('u1', { targetType: 'general' });

        expect(mockPrisma.memo.count).toHaveBeenCalledWith({
          where: { userId: 'u1', targetType: 'general', targetId: '' },
        });
      });

      it('일반 메모가 이미 10장이면 ConflictException이고 만들지 않는다', async () => {
        mockPrisma.memo.count.mockResolvedValue(10);

        await expect(
          service.create('u1', { targetType: 'general' }),
        ).rejects.toThrow(ConflictException);
        expect(mockPrisma.memo.create).not.toHaveBeenCalled();
      });

      it('9장이면 10번째 일반 메모를 만든다 (경계)', async () => {
        mockPrisma.memo.count.mockResolvedValue(9);

        await service.create('u1', { targetType: 'general' });

        expect(mockPrisma.memo.create).toHaveBeenCalledTimes(1);
      });
    });

    describe('title과 장 수 상한 (2차)', () => {
      // FE는 +를 누를 때 { targetType, targetId }만 보낸다 — title·content 없이도 만들어져야 한다.
      const TARGET = { targetType: 'post', targetId: 'p1' } as const;

      beforeEach(() => {
        mockPrisma.post.findUnique.mockResolvedValue({ userId: 'u1' }); // 본인 글
        mockPrisma.memo.create.mockResolvedValue({ id: 'm1' });
      });

      // data에 title이 들어간다. 안 주면(undefined) data.title도 없어야 DB 기본값('')이 쓰인다
      it('title을 주면 data에 title을 담아 만든다', async () => {
        await service.create('u1', {
          ...TARGET,
          title: '할 일',
          content: '본문',
        });

        expect(mockPrisma.memo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: {
              userId: 'u1',
              targetType: 'post',
              targetId: 'p1',
              title: '할 일',
              content: '본문',
            },
          }),
        );
      });

      it('title과 content를 모두 생략해도 만든다 (data에 undefined로 넘겨 DB 기본값을 쓴다)', async () => {
        const result = await service.create('u1', { ...TARGET });

        // expect.anything()은 undefined·null이 아닌 값만 맞는다 → not이므로 "값이 없다"를 확인한다
        expect(mockPrisma.memo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.not.objectContaining({
              title: expect.anything() as unknown,
              content: expect.anything() as unknown,
            }) as unknown,
          }),
        );
        expect(result).toEqual({ id: 'm1' });
      });

      // Arrange: mockPrisma.memo.count.mockResolvedValue(9) → 만들어진다 / (10) → 거절
      it('이미 9장이면 10번째 메모를 만든다 (경계: 10장까지는 허용)', async () => {
        mockPrisma.memo.count.mockResolvedValue(9);

        const result = await service.create('u1', { ...TARGET });

        expect(mockPrisma.memo.create).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ id: 'm1' });
      });

      it('이미 10장이면 ConflictException이고 메모를 만들지 않는다 (create 호출 없음)', async () => {
        mockPrisma.memo.count.mockResolvedValue(10);

        await expect(service.create('u1', { ...TARGET })).rejects.toThrow(
          ConflictException,
        );
        expect(mockPrisma.memo.create).not.toHaveBeenCalled();
      });

      // count의 where가 { userId, targetType, targetId }인지 — 다른 글의 메모나 남의 메모를 세면 안 된다
      it('장 수는 이 사용자·이 대상의 메모만 센다', async () => {
        await service.create('u1', { ...TARGET });

        expect(mockPrisma.memo.count).toHaveBeenCalledWith({
          where: { userId: 'u1', targetType: 'post', targetId: 'p1' },
        });
      });

      // 대상 검증(403/404)이 상한 확인(409)보다 먼저다 — 남의 글에 메모를 시도하면 Forbidden이지 Conflict가 아니다
      it('남의 글이면 장 수가 가득 차 있어도 ForbiddenException이다 (대상 검증이 먼저)', async () => {
        mockPrisma.post.findUnique.mockResolvedValue({
          userId: 'someone-else',
        });
        mockPrisma.memo.count.mockResolvedValue(10);

        await expect(service.create('u1', { ...TARGET })).rejects.toThrow(
          ForbiddenException,
        );
        expect(mockPrisma.memo.count).not.toHaveBeenCalled();
      });

      // 동시에 두 번 눌러 11장이 되는 일을 줄이려는 장치: count와 create가 같은 tx를 쓴다
      it('장 수 확인과 만들기는 같은 트랜잭션(tx) 안에서 한다', async () => {
        const tx = {
          memo: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockResolvedValue({ id: 'm1' }),
          },
        };
        mockPrisma.$transaction.mockImplementation(
          (fn: (t: typeof tx) => unknown) => fn(tx),
        );

        await service.create('u1', { ...TARGET });

        expect(tx.memo.count).toHaveBeenCalledTimes(1);
        expect(tx.memo.create).toHaveBeenCalledTimes(1);
        // 트랜잭션 밖의 client로는 세지도 만들지도 않는다
        expect(mockPrisma.memo.count).not.toHaveBeenCalled();
        expect(mockPrisma.memo.create).not.toHaveBeenCalled();
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // findAll — 대상에 붙은 "내" 메모만, 최근 수정순으로 (3차: 대상 없이 전체·종류별 조회도 된다)
  //
  // 남의 메모가 안 섞이는 보장은 서비스가 결과를 거르는 것이 아니라 where에 userId를 넣어 DB에 묻는 것이다.
  // 그래서 DB 결과가 아니라 findMany가 어떤 인자로 호출됐는지를 확인한다.
  // ─────────────────────────────────────────────────────────────────
  describe('findAll', () => {
    // 3차: 정렬은 항상 최근 수정순이다. 메모장(탭)이 "만든 순서"가 필요하면 FE가 createdAt으로 다시 정렬한다.
    it('userId + targetType + targetId로 조회하고 최근 수정순(updatedAt desc)으로 정렬한다', async () => {
      mockPrisma.memo.findMany.mockResolvedValue([]);

      await service.findAll('u1', { targetType: 'post', targetId: 'p1' });

      expect(mockPrisma.memo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', targetType: 'post', targetId: 'p1' },
          orderBy: { updatedAt: 'desc' },
        }),
      );
    });

    it('응답에 userId를 싣지 않도록 select를 지정한다', async () => {
      mockPrisma.memo.findMany.mockResolvedValue([]);

      await service.findAll('u1', { targetType: 'post', targetId: 'p1' });

      const args = mockPrisma.memo.findMany.mock.calls[0][0] as {
        select: Record<string, boolean>;
      };
      expect(args.select).toEqual(EXPECTED_SELECT);
      expect(args.select).not.toHaveProperty('userId');
    });

    it('독서 기록 대상도 같은 방식으로 조회한다', async () => {
      mockPrisma.memo.findMany.mockResolvedValue([]);

      await service.findAll('u1', { targetType: 'reading', targetId: 'r1' });

      expect(mockPrisma.memo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', targetType: 'reading', targetId: 'r1' },
        }),
      );
    });

    it('메모가 없으면 빈 배열을 돌려준다', async () => {
      mockPrisma.memo.findMany.mockResolvedValue([]);

      const result = await service.findAll('u1', {
        targetType: 'post',
        targetId: 'p1',
      });

      expect(result).toEqual([]);
    });

    it('DB가 돌려준 목록을 순서 그대로 돌려준다 (각 메모에 targetTitle만 더해진다)', async () => {
      const memos = [{ id: 'm1' }, { id: 'm2' }];
      mockPrisma.memo.findMany.mockResolvedValue(memos);

      const result = await service.findAll('u1', {
        targetType: 'post',
        targetId: 'p1',
      });

      expect(result).toEqual([
        { id: 'm1', targetTitle: null },
        { id: 'm2', targetTitle: null },
      ]);
    });
  });

  // 3차 — 일반 메모(general)·전체 조회·targetTitle. 계약: inote 레포 docs/todo/memo.md '3차'
  describe('findAll (3차: 전체·종류별·일반·targetTitle)', () => {
    beforeEach(() => {
      mockPrisma.memo.findMany.mockResolvedValue([]);
    });

    it('인자가 없으면 내 메모 전체다 — where는 userId뿐이고 최근 수정순', async () => {
      await service.findAll('u1', {});

      expect(mockPrisma.memo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1' },
          orderBy: { updatedAt: 'desc' },
        }),
      );
    });

    it('targetType만 주면 그 종류의 메모 전체다 (targetId 조건 없음)', async () => {
      await service.findAll('u1', { targetType: 'post' });

      const { where } = mockPrisma.memo.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(where).toEqual({ userId: 'u1', targetType: 'post' });
      expect(where).not.toHaveProperty('targetId');
    });

    it('general은 targetId를 빈 문자열로 조회한다 (일반 메모는 대상 id가 없다)', async () => {
      await service.findAll('u1', { targetType: 'general' });

      expect(mockPrisma.memo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', targetType: 'general', targetId: '' },
        }),
      );
    });

    it('general에 targetId를 보내도 무시하고 빈 문자열로 조회한다', async () => {
      await service.findAll('u1', { targetType: 'general', targetId: 'p1' });

      expect(mockPrisma.memo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', targetType: 'general', targetId: '' },
        }),
      );
    });

    it('글·독서 메모에는 대상의 제목을 targetTitle로 붙인다', async () => {
      mockPrisma.memo.findMany.mockResolvedValue([
        { id: 'm1', targetType: 'post', targetId: 'p1' },
        { id: 'm2', targetType: 'reading', targetId: 'r1' },
      ]);
      mockPrisma.post.findMany.mockResolvedValue([
        { id: 'p1', title: '글 제목' },
      ]);
      mockPrisma.readingLog.findMany.mockResolvedValue([
        { id: 'r1', title: '책 제목' },
      ]);

      const result = await service.findAll('u1', {});

      expect(result).toEqual([
        expect.objectContaining({ id: 'm1', targetTitle: '글 제목' }),
        expect.objectContaining({ id: 'm2', targetTitle: '책 제목' }),
      ]);
    });

    it('일반 메모와 대상이 사라진 메모의 targetTitle은 null이다', async () => {
      mockPrisma.memo.findMany.mockResolvedValue([
        { id: 'm1', targetType: 'general', targetId: '' },
        { id: 'm2', targetType: 'post', targetId: 'gone' },
      ]);

      const result = await service.findAll('u1', {});

      expect(result).toEqual([
        expect.objectContaining({ id: 'm1', targetTitle: null }),
        expect.objectContaining({ id: 'm2', targetTitle: null }),
      ]);
    });

    it('제목은 종류별로 한 번씩 id 목록(중복 제거)으로 읽고, 내 글·내 독서 기록만 읽는다', async () => {
      mockPrisma.memo.findMany.mockResolvedValue([
        { id: 'm1', targetType: 'post', targetId: 'p1' },
        { id: 'm2', targetType: 'post', targetId: 'p1' },
        { id: 'm3', targetType: 'post', targetId: 'p2' },
        { id: 'm4', targetType: 'reading', targetId: 'r1' },
      ]);

      await service.findAll('u1', {});

      expect(mockPrisma.post.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.post.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['p1', 'p2'] }, userId: 'u1' },
        select: { id: true, title: true },
      });
      expect(mockPrisma.readingLog.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.readingLog.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['r1'] }, userId: 'u1' },
        select: { id: true, title: true },
      });
    });

    it('목록에 없는 종류(또는 일반 메모만 있을 때)는 제목을 읽지 않는다', async () => {
      mockPrisma.memo.findMany.mockResolvedValue([
        { id: 'm1', targetType: 'general', targetId: '' },
      ]);

      await service.findAll('u1', {});

      expect(mockPrisma.post.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.readingLog.findMany).not.toHaveBeenCalled();
    });

    it('메모 순서는 DB가 준 그대로 유지한다 (제목을 붙여도 순서가 바뀌지 않는다)', async () => {
      mockPrisma.memo.findMany.mockResolvedValue([
        { id: 'b', targetType: 'general', targetId: '' },
        { id: 'a', targetType: 'post', targetId: 'p1' },
      ]);

      const result = await service.findAll('u1', {});

      expect(result.map((m) => m.id)).toEqual(['b', 'a']);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // update — 본인 메모만. 없는 메모와 남의 메모는 같은 404로 응답한다 (메모의 존재를 알려주지 않는다)
  // ─────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('본인 메모의 content를 수정한다', async () => {
      mockPrisma.memo.findUnique.mockResolvedValue({ userId: 'u1' });
      mockPrisma.memo.update.mockResolvedValue({ id: 'm1', content: '수정' });

      const result = await service.update('u1', 'm1', { content: '수정' });

      expect(mockPrisma.memo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'm1' },
          data: { content: '수정' },
          select: EXPECTED_SELECT,
        }),
      );
      expect(result).toEqual({ id: 'm1', content: '수정' });
    });

    it('빈 문자열로 수정할 수 있다 (내용을 지우는 경우, 삭제가 아니다)', async () => {
      mockPrisma.memo.findUnique.mockResolvedValue({ userId: 'u1' });
      mockPrisma.memo.update.mockResolvedValue({ id: 'm1', content: '' });

      await service.update('u1', 'm1', { content: '' });

      expect(mockPrisma.memo.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { content: '' } }),
      );
    });

    it('없는 메모면 NotFoundException이고 update를 호출하지 않는다', async () => {
      mockPrisma.memo.findUnique.mockResolvedValue(null);

      await expect(
        service.update('u1', 'nope', { content: '수정' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.memo.update).not.toHaveBeenCalled();
    });

    it('남의 메모면 NotFoundException이고 update를 호출하지 않는다 (없는 메모와 같은 예외)', async () => {
      mockPrisma.memo.findUnique.mockResolvedValue({ userId: 'owner' });

      await expect(
        service.update('other', 'm1', { content: '해킹' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrisma.memo.update).not.toHaveBeenCalled();
    });

    it('남의 메모와 없는 메모는 같은 메시지로 응답한다 (존재 여부가 드러나지 않는다)', async () => {
      mockPrisma.memo.findUnique.mockResolvedValueOnce(null);
      const missing = await service
        .update('u1', 'nope', { content: 'x' })
        .catch((e: Error) => e.message);

      mockPrisma.memo.findUnique.mockResolvedValueOnce({ userId: 'owner' });
      const others = await service
        .update('other', 'm1', { content: 'x' })
        .catch((e: Error) => e.message);

      expect(others).toBe(missing);
    });

    // ─ update: title 수정, 둘 중 하나는 있어야 한다 ─────────────────────
    // 공통 Arrange: mockPrisma.memo.findUnique.mockResolvedValue({ userId: 'u1' }) (본인 메모)
    describe('title과 content (2차)', () => {
      beforeEach(() => {
        mockPrisma.memo.findUnique.mockResolvedValue({ userId: 'u1' }); // 본인 메모
        mockPrisma.memo.update.mockResolvedValue({ id: 'm1' });
      });

      it('title만 보내면 title만 수정한다 (content는 건드리지 않는다)', async () => {
        await service.update('u1', 'm1', { title: '새 제목' });

        // content를 보내지 않으므로 data에 content가 없어야 한다 (undefined면 Prisma가 건드리지 않는다)
        expect(mockPrisma.memo.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'm1' },
            data: { title: '새 제목' },
          }),
        );
        expect(mockPrisma.memo.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.not.objectContaining({
              content: expect.anything() as unknown,
            }) as unknown,
          }),
        );
      });

      it('title과 content를 같이 보내면 둘 다 수정한다', async () => {
        await service.update('u1', 'm1', { title: '제목', content: '본문' });

        expect(mockPrisma.memo.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { title: '제목', content: '본문' },
          }),
        );
      });

      // 제목을 지우는 것 = 빈 문자열. "보내지 않음(undefined)"과 구분되어야 한다 (|| 나 ?? 로 처리하면 틀린다)
      it('title을 빈 문자열로 수정할 수 있다 (제목 지우기)', async () => {
        await service.update('u1', 'm1', { title: '' });

        expect(mockPrisma.memo.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: { title: '' } }),
        );
      });

      // 둘 다 undefined면 바꿀 게 없다 → 400. DB를 읽기 전에 거절한다 (findUnique·update 호출 없음)
      it('title도 content도 없으면 BadRequestException이고 DB를 읽지 않는다', async () => {
        await expect(service.update('u1', 'm1', {})).rejects.toThrow(
          BadRequestException,
        );
        expect(mockPrisma.memo.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.memo.update).not.toHaveBeenCalled();
      });
    });
  });
  // ═════════════════════════════════════════════════════════════════
  // 2차: 메모 여러 장 (1:N) — 계약: inote 레포 docs/todo/memo.md "2차"
  // create·update의 2차 케이스는 위 describe 안의 '(2차)' 묶음에 있고, 새 기능인 remove는 아래에 있다.
  // ═════════════════════════════════════════════════════════════════

  // ─ remove: 신규 DELETE /memos/:id ────────────────────────────────
  describe('remove', () => {
    beforeEach(() => {
      mockPrisma.memo.delete.mockResolvedValue({ id: 'm1' });
    });

    it('본인 메모를 id로 삭제한다', async () => {
      mockPrisma.memo.findUnique.mockResolvedValue({ userId: 'u1' });

      await service.remove('u1', 'm1');

      expect(mockPrisma.memo.delete).toHaveBeenCalledWith({
        where: { id: 'm1' },
      });
    });

    it('없는 메모면 NotFoundException이고 delete를 호출하지 않는다', async () => {
      mockPrisma.memo.findUnique.mockResolvedValue(null);

      await expect(service.remove('u1', 'nope')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.memo.delete).not.toHaveBeenCalled();
    });

    it('남의 메모면 NotFoundException이고 delete를 호출하지 않는다 (없는 메모와 같은 예외)', async () => {
      mockPrisma.memo.findUnique.mockResolvedValue({ userId: 'someone-else' });

      await expect(service.remove('u1', 'm1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.memo.delete).not.toHaveBeenCalled();
    });

    // update와 같은 메시지 — 존재 여부가 드러나지 않는다 ('메모를 찾을 수 없습니다.')
    it('남의 메모와 없는 메모는 같은 메시지로 응답한다', async () => {
      mockPrisma.memo.findUnique.mockResolvedValueOnce(null);
      const missing = await service.remove('u1', 'nope').catch((e: Error) => e);
      mockPrisma.memo.findUnique.mockResolvedValueOnce({
        userId: 'someone-else',
      });
      const foreign = await service.remove('u1', 'm1').catch((e: Error) => e);

      expect(missing).toBeInstanceOf(NotFoundException);
      expect((foreign as Error).message).toBe((missing as Error).message);
    });

    // 계약: 204 No Content. 서비스는 값을 돌려주지 않는다
    it('삭제하면 아무것도 돌려주지 않는다 (undefined)', async () => {
      mockPrisma.memo.findUnique.mockResolvedValue({ userId: 'u1' });

      await expect(service.remove('u1', 'm1')).resolves.toBeUndefined();
    });
  });
});
