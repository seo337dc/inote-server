import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const mockPrisma = {
    postCategory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      createMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // 기본: 같은 위치에 같은 이름의 형제가 없다
    mockPrisma.postCategory.findFirst.mockResolvedValue(null);
    // 기본: 같은 부모 아래 형제가 없다 → 새 카테고리는 position 0
    mockPrisma.postCategory.count.mockResolvedValue(0);

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
          { userId: 'u1', name: '학습', depth: 1, position: 0 },
          { userId: 'u1', name: '이직', depth: 1, position: 1 },
          { userId: 'u1', name: '일기', depth: 1, position: 2 },
          { userId: 'u1', name: '블로그', depth: 1, position: 3 },
          { userId: 'u1', name: '기록', depth: 1, position: 4 },
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
        data: {
          userId: 'u1',
          name: '새 카테고리',
          parentId: null,
          depth: 1,
          position: 0,
        },
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
        data: {
          userId: 'u1',
          name: '하위',
          parentId: 'p1',
          depth: 2,
          position: 0,
        },
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

    describe('이름 중복 (같은 부모 아래 형제끼리만 금지)', () => {
      it('최상위에 같은 이름이 이미 있으면 ConflictException — 만들지 않는다', async () => {
        mockPrisma.postCategory.findFirst.mockResolvedValue({
          id: 'c1',
          name: '학습',
        });

        await expect(service.create('u1', { name: '학습' })).rejects.toThrow(
          ConflictException,
        );
        expect(mockPrisma.postCategory.create).not.toHaveBeenCalled();
      });

      it('최상위 중복 검사는 내 카테고리 중 parentId가 null인 같은 이름을 찾는다', async () => {
        mockPrisma.postCategory.create.mockResolvedValue({ id: 'c1' });

        await service.create('u1', { name: '학습' });

        expect(mockPrisma.postCategory.findFirst).toHaveBeenCalledWith({
          where: { userId: 'u1', parentId: null, name: '학습' },
        });
      });

      it('하위 카테고리 중복 검사는 같은 부모(parentId)의 형제만 본다', async () => {
        mockPrisma.postCategory.findUnique.mockResolvedValue({
          id: 'p1',
          userId: 'u1',
          depth: 1,
        });
        mockPrisma.postCategory.create.mockResolvedValue({ id: 'c2' });

        await service.create('u1', { name: 'AI', parentId: 'p1' });

        expect(mockPrisma.postCategory.findFirst).toHaveBeenCalledWith({
          where: { userId: 'u1', parentId: 'p1', name: 'AI' },
        });
      });

      it('같은 부모 아래 형제와 이름이 같으면 ConflictException', async () => {
        mockPrisma.postCategory.findUnique.mockResolvedValue({
          id: 'p1',
          userId: 'u1',
          depth: 1,
        });
        mockPrisma.postCategory.findFirst.mockResolvedValue({
          id: 'c9',
          name: 'AI',
        });

        await expect(
          service.create('u1', { name: 'AI', parentId: 'p1' }),
        ).rejects.toThrow(ConflictException);
        expect(mockPrisma.postCategory.create).not.toHaveBeenCalled();
      });

      it('다른 부모 아래에 같은 이름이 있어도(형제가 아니면) 만들 수 있다', async () => {
        // 학습 > AI가 이미 있어도, 사이드프로젝트(p2) 아래 AI는 형제가 없다
        mockPrisma.postCategory.findUnique.mockResolvedValue({
          id: 'p2',
          userId: 'u1',
          depth: 1,
        });
        mockPrisma.postCategory.findFirst.mockResolvedValue(null);
        mockPrisma.postCategory.create.mockResolvedValue({ id: 'c3' });

        await service.create('u1', { name: 'AI', parentId: 'p2' });

        expect(mockPrisma.postCategory.create).toHaveBeenCalledWith({
          data: {
            userId: 'u1',
            name: 'AI',
            parentId: 'p2',
            depth: 2,
            position: 0,
          },
        });
      });

      it('상위 카테고리 검증이 중복 검사보다 먼저다 (없는 부모면 NotFound, 중복 검사 안 함)', async () => {
        mockPrisma.postCategory.findUnique.mockResolvedValue(null);

        await expect(
          service.create('u1', { name: 'AI', parentId: 'missing' }),
        ).rejects.toThrow(NotFoundException);
        expect(mockPrisma.postCategory.findFirst).not.toHaveBeenCalled();
      });
    });
  });
});
