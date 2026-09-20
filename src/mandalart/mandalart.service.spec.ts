import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MandalartService } from './mandalart.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MandalartService', () => {
  let service: MandalartService;
  const originalOwnerId = process.env.MANDALART_OWNER_USER_ID;

  const mockPrisma = {
    mandalartItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.MANDALART_OWNER_USER_ID = 'owner-1';

    const module = await Test.createTestingModule({
      providers: [
        MandalartService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(MandalartService);
  });

  afterAll(() => {
    process.env.MANDALART_OWNER_USER_ID = originalOwnerId;
  });

  describe('findAll', () => {
    it('축(theme) → 순서(position) 순으로 전체 조회한다 (누구나)', async () => {
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

  describe('update', () => {
    it('MANDALART_OWNER_USER_ID가 아니면 ForbiddenException (조회 전에 먼저 막힌다)', async () => {
      await expect(service.update('other-user', 'm1', {})).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.mandalartItem.findUnique).not.toHaveBeenCalled();
    });

    it('소유자인데 항목이 없으면 NotFoundException', async () => {
      mockPrisma.mandalartItem.findUnique.mockResolvedValue(null);

      await expect(service.update('owner-1', 'm1', {})).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.mandalartItem.update).not.toHaveBeenCalled();
    });

    it('소유자이고 항목이 있으면 정상적으로 수정된다', async () => {
      mockPrisma.mandalartItem.findUnique.mockResolvedValue({ id: 'm1' });
      mockPrisma.mandalartItem.update.mockResolvedValue({
        id: 'm1',
        done: true,
      });

      const result = await service.update('owner-1', 'm1', { done: true });

      expect(mockPrisma.mandalartItem.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { done: true },
      });
      expect(result).toEqual({ id: 'm1', done: true });
    });
  });
});
