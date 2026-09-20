import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MandalartService } from './mandalart.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MandalartService', () => {
  let service: MandalartService;

  const mockPrisma = {
    mandalartItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        MandalartService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(MandalartService);
  });

  describe('findAll', () => {
    it('축(theme) → 순서(position) 순으로 전체 조회한다 (누구나, 비회원 포함)', async () => {
      mockPrisma.mandalartItem.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(mockPrisma.mandalartItem.findMany).toHaveBeenCalledWith({
        orderBy: [{ theme: 'asc' }, { position: 'asc' }],
      });
    });
  });

  describe('findOne', () => {
    it('존재하지 않으면 NotFoundException', async () => {
      mockPrisma.mandalartItem.findUnique.mockResolvedValue(null);

      await expect(service.findOne('m1')).rejects.toThrow(NotFoundException);
    });

    it('존재하면 조회된다', async () => {
      mockPrisma.mandalartItem.findUnique.mockResolvedValue({ id: 'm1' });

      const result = await service.findOne('m1');
      expect(result).toEqual({ id: 'm1' });
    });
  });

  describe('create', () => {
    it('role이 ADMIN이 아니면 ForbiddenException', async () => {
      await expect(
        service.create('USER', {
          theme: 't9',
          themeName: '기능 고도화',
          title: '새 항목',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.mandalartItem.create).not.toHaveBeenCalled();
    });

    it('role이 없어도(비로그인) ForbiddenException', async () => {
      await expect(
        service.create(undefined, {
          theme: 't9',
          themeName: '기능 고도화',
          title: '새 항목',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('position을 안 주면 해당 축의 마지막 순번 뒤에 추가한다', async () => {
      mockPrisma.mandalartItem.count.mockResolvedValue(2);
      mockPrisma.mandalartItem.create.mockResolvedValue({
        id: 'm1',
        position: 2,
      });

      await service.create('ADMIN', {
        theme: 't9',
        themeName: '기능 고도화',
        title: '새 항목',
      });

      expect(mockPrisma.mandalartItem.count).toHaveBeenCalledWith({
        where: { theme: 't9' },
      });
      expect(mockPrisma.mandalartItem.create).toHaveBeenCalledWith({
        data: {
          theme: 't9',
          themeName: '기능 고도화',
          title: '새 항목',
          position: 2,
        },
      });
    });

    it('position을 주면 그대로 사용한다', async () => {
      mockPrisma.mandalartItem.create.mockResolvedValue({
        id: 'm1',
        position: 5,
      });

      await service.create('ADMIN', {
        theme: 't9',
        themeName: '기능 고도화',
        title: '새 항목',
        position: 5,
      });

      expect(mockPrisma.mandalartItem.count).not.toHaveBeenCalled();
      expect(mockPrisma.mandalartItem.create).toHaveBeenCalledWith({
        data: {
          theme: 't9',
          themeName: '기능 고도화',
          title: '새 항목',
          position: 5,
        },
      });
    });
  });

  describe('update', () => {
    it('role이 ADMIN이 아니면 ForbiddenException (조회 전에 먼저 막힌다)', async () => {
      await expect(service.update('USER', 'm1', {})).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.mandalartItem.findUnique).not.toHaveBeenCalled();
    });

    it('role이 없어도(비로그인) ForbiddenException', async () => {
      await expect(service.update(undefined, 'm1', {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('ADMIN인데 항목이 없으면 NotFoundException', async () => {
      mockPrisma.mandalartItem.findUnique.mockResolvedValue(null);

      await expect(service.update('ADMIN', 'm1', {})).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.mandalartItem.update).not.toHaveBeenCalled();
    });

    it('ADMIN이고 항목이 있으면 정상적으로 수정된다', async () => {
      mockPrisma.mandalartItem.findUnique.mockResolvedValue({ id: 'm1' });
      mockPrisma.mandalartItem.update.mockResolvedValue({
        id: 'm1',
        done: true,
      });

      const result = await service.update('ADMIN', 'm1', { done: true });

      expect(mockPrisma.mandalartItem.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { done: true },
      });
      expect(result).toEqual({ id: 'm1', done: true });
    });
  });
});
