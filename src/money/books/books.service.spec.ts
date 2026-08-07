import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BooksService } from './books.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('BooksService', () => {
  let service: BooksService;

  const mockPrisma = {
    book: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    bookLike: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(BooksService);
  });

  describe('findAll', () => {
    it('공유되었거나 본인이 등록한 도서만 조회한다', async () => {
      mockPrisma.book.findMany.mockResolvedValue([]);

      await service.findAll('user-1', {});

      expect(mockPrisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ isShared: true }, { userId: 'user-1' }],
          }),
        }),
      );
    });

    it('제목(title) 검색 조건이 where에 포함된다', async () => {
      mockPrisma.book.findMany.mockResolvedValue([]);

      await service.findAll('user-1', { q: '부의 추월차선' });

      expect(mockPrisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            title: { contains: '부의 추월차선', mode: 'insensitive' },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('존재하지 않으면 NotFoundException', async () => {
      mockPrisma.book.findUnique.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('비공유 + 본인 아님이면 ForbiddenException', async () => {
      mockPrisma.book.findUnique.mockResolvedValue({
        id: 'b1',
        userId: 'owner',
        isShared: false,
        _count: { likes: 0 },
        likes: [],
      });

      await expect(service.findOne('other-user', 'b1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('create', () => {
    it('요청자의 userId로 생성한다', async () => {
      mockPrisma.book.create.mockResolvedValue({ id: 'b1' });

      await service.create('user-1', {
        title: '부의 추월차선',
        author: 'MJ 드마코',
        comment: '자산과 소득의 차이',
        category: 'ECONOMY',
      });

      expect(mockPrisma.book.create).toHaveBeenCalledWith({
        data: {
          title: '부의 추월차선',
          author: 'MJ 드마코',
          comment: '자산과 소득의 차이',
          category: 'ECONOMY',
          userId: 'user-1',
        },
      });
    });
  });

  describe('update / remove — 권한 체크', () => {
    it('본인 등록이 아니면 삭제 시 ForbiddenException', async () => {
      mockPrisma.book.findUnique.mockResolvedValue({
        id: 'b1',
        userId: 'owner',
      });

      await expect(service.remove('other-user', 'b1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.book.delete).not.toHaveBeenCalled();
    });

    it('본인 등록이면 정상적으로 삭제된다', async () => {
      mockPrisma.book.findUnique.mockResolvedValue({
        id: 'b1',
        userId: 'user-1',
      });
      mockPrisma.book.delete.mockResolvedValue({ id: 'b1' });

      const result = await service.remove('user-1', 'b1');

      expect(mockPrisma.book.delete).toHaveBeenCalledWith({
        where: { id: 'b1' },
      });
      expect(result).toEqual({ id: 'b1' });
    });
  });

  describe('toggleLike', () => {
    it('좋아요가 없으면 새로 생성하고 liked: true를 반환한다', async () => {
      mockPrisma.book.findUnique.mockResolvedValue({
        id: 'b1',
        userId: 'owner',
        isShared: true,
      });
      mockPrisma.bookLike.findUnique.mockResolvedValue(null);

      const result = await service.toggleLike('user-1', 'b1');

      expect(mockPrisma.bookLike.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', bookId: 'b1' },
      });
      expect(result).toEqual({ liked: true });
    });

    it('이미 좋아요를 눌렀으면 삭제하고 liked: false를 반환한다', async () => {
      mockPrisma.book.findUnique.mockResolvedValue({
        id: 'b1',
        userId: 'owner',
        isShared: true,
      });
      mockPrisma.bookLike.findUnique.mockResolvedValue({ id: 'like-1' });

      const result = await service.toggleLike('user-1', 'b1');

      expect(mockPrisma.bookLike.delete).toHaveBeenCalledWith({
        where: { id: 'like-1' },
      });
      expect(result).toEqual({ liked: false });
    });
  });
});
