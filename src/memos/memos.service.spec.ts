import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MemosService } from './memos.service';
import { PrismaService } from '../prisma/prisma.service';

// 응답에 싣는 필드 — userId(작성자) 같은 내부 필드는 뺀다. 서비스의 MEMO_SELECT와 일부러 따로 적어서,
// 누군가 select를 바꾸면(예: userId를 추가) 이 테스트가 깨지도록 한다.
const EXPECTED_SELECT = {
  id: true,
  targetType: true,
  targetId: true,
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
    },
    // 메모를 붙일 대상(글/독서 기록)의 작성자를 확인할 때 읽는다
    post: { findUnique: jest.fn() },
    readingLog: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

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
  });

  // ─────────────────────────────────────────────────────────────────
  // findAll — 대상에 붙은 "내" 메모만, 생성순으로
  //
  // 남의 메모가 안 섞이는 보장은 서비스가 결과를 거르는 것이 아니라 where에 userId를 넣어 DB에 묻는 것이다.
  // 그래서 DB 결과가 아니라 findMany가 어떤 인자로 호출됐는지를 확인한다.
  // ─────────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('userId + targetType + targetId로 조회하고 생성순(createdAt asc)으로 정렬한다', async () => {
      mockPrisma.memo.findMany.mockResolvedValue([]);

      await service.findAll('u1', { targetType: 'post', targetId: 'p1' });

      expect(mockPrisma.memo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', targetType: 'post', targetId: 'p1' },
          orderBy: { createdAt: 'asc' },
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

    it('DB가 돌려준 목록을 그대로 돌려준다 (순서 포함)', async () => {
      const memos = [{ id: 'm1' }, { id: 'm2' }];
      mockPrisma.memo.findMany.mockResolvedValue(memos);

      const result = await service.findAll('u1', {
        targetType: 'post',
        targetId: 'p1',
      });

      expect(result).toEqual(memos);
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
  });
});
