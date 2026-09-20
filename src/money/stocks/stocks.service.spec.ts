import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StocksService } from './stocks.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('StocksService', () => {
  let service: StocksService;

  const mockPrisma = {
    stockHolding: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        StocksService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(StocksService);
  });

  describe('findAll', () => {
    it('본인 보유 종목만 등록순으로 조회한다', async () => {
      mockPrisma.stockHolding.findMany.mockResolvedValue([]);

      await service.findAll('user-1');

      expect(mockPrisma.stockHolding.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('create', () => {
    it('요청자의 userId로 종목을 생성한다', async () => {
      mockPrisma.stockHolding.create.mockResolvedValue({ id: 's1' });

      await service.create('user-1', {
        market: 'KR',
        name: '삼성전자',
        inputMode: 'QUANTITY',
        quantity: 10,
        averagePrice: 75000,
      } as never);

      expect(mockPrisma.stockHolding.create).toHaveBeenCalledWith({
        data: {
          market: 'KR',
          name: '삼성전자',
          inputMode: 'QUANTITY',
          quantity: 10,
          averagePrice: 75000,
          userId: 'user-1',
        },
      });
    });
  });

  describe('update', () => {
    it('존재하지 않으면 NotFoundException', async () => {
      mockPrisma.stockHolding.findUnique.mockResolvedValue(null);

      await expect(service.update('user-1', 's1', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('본인 소유가 아니면 ForbiddenException', async () => {
      mockPrisma.stockHolding.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'owner',
      });

      await expect(service.update('other-user', 's1', {})).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.stockHolding.update).not.toHaveBeenCalled();
    });

    it('본인 소유면 정상적으로 수정된다', async () => {
      mockPrisma.stockHolding.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'user-1',
      });
      mockPrisma.stockHolding.update.mockResolvedValue({
        id: 's1',
        quantity: 20,
      });

      await service.update('user-1', 's1', { quantity: 20 });

      expect(mockPrisma.stockHolding.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { quantity: 20 },
      });
    });
  });

  describe('remove', () => {
    it('존재하지 않으면 NotFoundException', async () => {
      mockPrisma.stockHolding.findUnique.mockResolvedValue(null);

      await expect(service.remove('user-1', 's1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('본인 소유가 아니면 ForbiddenException', async () => {
      mockPrisma.stockHolding.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'owner',
      });

      await expect(service.remove('other-user', 's1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.stockHolding.delete).not.toHaveBeenCalled();
    });

    it('본인 소유면 삭제된다', async () => {
      mockPrisma.stockHolding.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'user-1',
      });
      mockPrisma.stockHolding.delete.mockResolvedValue({ id: 's1' });

      await service.remove('user-1', 's1');

      expect(mockPrisma.stockHolding.delete).toHaveBeenCalledWith({
        where: { id: 's1' },
      });
    });
  });
});
