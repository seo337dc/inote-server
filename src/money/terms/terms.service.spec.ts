import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TermsService } from './terms.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TermsService', () => {
  let service: TermsService;

  const mockPrisma = {
    term: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    termLike: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        TermsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(TermsService);
  });

  describe('findAll', () => {
    it('공유되었거나 본인이 등록한 용어만 조회한다', async () => {
      mockPrisma.term.findMany.mockResolvedValue([]);

      await service.findAll('user-1', {});

      expect(mockPrisma.term.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ isShared: true }, { userId: 'user-1' }],
          }),
        }),
      );
    });

    it('category/q 필터가 있으면 where 조건에 포함된다', async () => {
      mockPrisma.term.findMany.mockResolvedValue([]);

      await service.findAll('user-1', { category: 'STOCK', q: 'PER' });

      expect(mockPrisma.term.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'STOCK',
            term: { contains: 'PER', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('likeCount / likedByMe / isOwner를 계산해서 반환한다', async () => {
      mockPrisma.term.findMany.mockResolvedValue([
        {
          id: 't1',
          userId: 'user-1',
          term: 'PER',
          _count: { likes: 3 },
          likes: [{ userId: 'user-1' }],
        },
      ]);

      const result = await service.findAll('user-1', {});

      expect(result[0]).toMatchObject({
        id: 't1',
        likeCount: 3,
        likedByMe: true,
        isOwner: true,
      });
    });
  });

  describe('findOne', () => {
    it('존재하지 않으면 NotFoundException', async () => {
      mockPrisma.term.findUnique.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('비공유 + 본인 아님이면 ForbiddenException', async () => {
      mockPrisma.term.findUnique.mockResolvedValue({
        id: 't1',
        userId: 'owner',
        isShared: false,
        _count: { likes: 0 },
        likes: [],
      });

      await expect(service.findOne('other-user', 't1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('공유된 항목은 본인이 아니어도 조회 가능하다', async () => {
      mockPrisma.term.findUnique.mockResolvedValue({
        id: 't1',
        userId: 'owner',
        isShared: true,
        _count: { likes: 0 },
        likes: [],
      });

      const result = await service.findOne('other-user', 't1');
      expect(result.isOwner).toBe(false);
    });
  });

  describe('create', () => {
    it('요청자의 userId로 생성한다', async () => {
      mockPrisma.term.create.mockResolvedValue({ id: 't1' });

      await service.create('user-1', {
        term: 'PER',
        description: '주가수익비율',
        category: 'STOCK',
      });

      expect(mockPrisma.term.create).toHaveBeenCalledWith({
        data: {
          term: 'PER',
          description: '주가수익비율',
          category: 'STOCK',
          userId: 'user-1',
        },
      });
    });
  });

  describe('update / remove — 권한 체크', () => {
    it('본인 등록이 아니면 수정 시 ForbiddenException', async () => {
      mockPrisma.term.findUnique.mockResolvedValue({
        id: 't1',
        userId: 'owner',
      });

      await expect(
        service.update('other-user', 't1', { term: '수정' }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.term.update).not.toHaveBeenCalled();
    });

    it('본인 등록이면 정상적으로 수정된다', async () => {
      mockPrisma.term.findUnique.mockResolvedValue({
        id: 't1',
        userId: 'user-1',
      });
      mockPrisma.term.update.mockResolvedValue({ id: 't1', term: '수정됨' });

      const result = await service.update('user-1', 't1', { term: '수정됨' });

      expect(mockPrisma.term.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { term: '수정됨' },
      });
      expect(result).toEqual({ id: 't1', term: '수정됨' });
    });

    it('본인 등록이 아니면 삭제 시 ForbiddenException', async () => {
      mockPrisma.term.findUnique.mockResolvedValue({
        id: 't1',
        userId: 'owner',
      });

      await expect(service.remove('other-user', 't1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.term.delete).not.toHaveBeenCalled();
    });
  });

  describe('toggleLike', () => {
    it('좋아요가 없으면 새로 생성하고 liked: true를 반환한다', async () => {
      mockPrisma.term.findUnique.mockResolvedValue({
        id: 't1',
        userId: 'owner',
        isShared: true,
      });
      mockPrisma.termLike.findUnique.mockResolvedValue(null);

      const result = await service.toggleLike('user-1', 't1');

      expect(mockPrisma.termLike.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', termId: 't1' },
      });
      expect(result).toEqual({ liked: true });
    });

    it('이미 좋아요를 눌렀으면 삭제하고 liked: false를 반환한다', async () => {
      mockPrisma.term.findUnique.mockResolvedValue({
        id: 't1',
        userId: 'owner',
        isShared: true,
      });
      mockPrisma.termLike.findUnique.mockResolvedValue({ id: 'like-1' });

      const result = await service.toggleLike('user-1', 't1');

      expect(mockPrisma.termLike.delete).toHaveBeenCalledWith({
        where: { id: 'like-1' },
      });
      expect(result).toEqual({ liked: false });
    });

    it('비공유 + 본인 아님이면 좋아요 시 ForbiddenException', async () => {
      mockPrisma.term.findUnique.mockResolvedValue({
        id: 't1',
        userId: 'owner',
        isShared: false,
      });

      await expect(service.toggleLike('other-user', 't1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
