import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const mockPrisma = {
    postCategory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      createMany: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(CategoriesService);
  });

  describe('findAll', () => {
    it('이미 카테고리가 있으면 그대로 반환한다', async () => {
      mockPrisma.postCategory.findMany.mockResolvedValue([{ id: 'c1' }]);

      const result = await service.findAll('u1');

      expect(result).toEqual([{ id: 'c1' }]);
      expect(mockPrisma.postCategory.createMany).not.toHaveBeenCalled();
    });

    it('카테고리가 하나도 없으면 기본 5개를 생성한 뒤 반환한다', async () => {
      mockPrisma.postCategory.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }]);
      mockPrisma.postCategory.createMany.mockResolvedValue({ count: 5 });

      const result = await service.findAll('u1');

      expect(mockPrisma.postCategory.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'u1', name: '학습', depth: 1 },
          { userId: 'u1', name: '이직', depth: 1 },
          { userId: 'u1', name: '일기', depth: 1 },
          { userId: 'u1', name: '블로그', depth: 1 },
          { userId: 'u1', name: '기록', depth: 1 },
        ],
      });
      expect(result).toEqual([{ id: 'c1' }, { id: 'c2' }]);
    });
  });

  describe('create', () => {
    it('parentId 없이 만들면 depth 1로 생성한다', async () => {
      mockPrisma.postCategory.create.mockResolvedValue({ id: 'c1' });

      await service.create('u1', { name: '새 카테고리' });

      expect(mockPrisma.postCategory.create).toHaveBeenCalledWith({
        data: { userId: 'u1', name: '새 카테고리', parentId: null, depth: 1 },
      });
    });

    it('상위 카테고리 depth + 1로 생성한다', async () => {
      mockPrisma.postCategory.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        depth: 1,
      });
      mockPrisma.postCategory.create.mockResolvedValue({ id: 'c1' });

      await service.create('u1', { name: '하위', parentId: 'p1' });

      expect(mockPrisma.postCategory.create).toHaveBeenCalledWith({
        data: { userId: 'u1', name: '하위', parentId: 'p1', depth: 2 },
      });
    });

    it('상위 카테고리가 없으면 NotFoundException', async () => {
      mockPrisma.postCategory.findUnique.mockResolvedValue(null);

      await expect(
        service.create('u1', { name: '하위', parentId: 'missing' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('상위 카테고리가 본인 것이 아니면 NotFoundException', async () => {
      mockPrisma.postCategory.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'other',
        depth: 1,
      });

      await expect(
        service.create('u1', { name: '하위', parentId: 'p1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('상위 카테고리가 이미 3단계면 BadRequestException', async () => {
      mockPrisma.postCategory.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        depth: 3,
      });

      await expect(
        service.create('u1', { name: '4단계', parentId: 'p1' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.postCategory.create).not.toHaveBeenCalled();
    });
  });
});
