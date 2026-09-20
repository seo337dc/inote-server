import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MiniGameService } from './mini-game.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('MiniGameService', () => {
  let service: MiniGameService;

  const mockPrisma = {
    miniGameResult: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        MiniGameService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(MiniGameService);
  });

  describe('findAll', () => {
    it('본인 결과만 최신 플레이순으로 조회한다', async () => {
      mockPrisma.miniGameResult.findMany.mockResolvedValue([]);

      await service.findAll('user-1');

      expect(mockPrisma.miniGameResult.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { playedAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('존재하지 않으면 NotFoundException', async () => {
      mockPrisma.miniGameResult.findUnique.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'g1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('본인 결과가 아니면 ForbiddenException', async () => {
      mockPrisma.miniGameResult.findUnique.mockResolvedValue({
        id: 'g1',
        userId: 'owner',
      });

      await expect(service.findOne('other-user', 'g1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('본인 결과면 정상 조회된다', async () => {
      mockPrisma.miniGameResult.findUnique.mockResolvedValue({
        id: 'g1',
        userId: 'user-1',
      });

      const result = await service.findOne('user-1', 'g1');
      expect(result).toEqual({ id: 'g1', userId: 'user-1' });
    });
  });

  describe('create', () => {
    it('JSON 필드(finalStocks 등)를 포함해 결과를 저장한다', async () => {
      mockPrisma.miniGameResult.create.mockResolvedValue({ id: 'g1' });

      const dto = {
        profession: '의사',
        result: 'WON',
        turnCount: 42,
        finalCash: 100000,
        finalPassiveIncome: 5000,
        finalMonthlyExpenses: 3000,
        finalMonthlyCashflow: 2000,
        bankLoan: 0,
        totalLiabilities: 0,
        stocksCount: 2,
        realEstatesCount: 1,
        childrenCount: 0,
        finalStocks: [{ name: '삼성전자' }],
        finalRealEstates: [{ name: '아파트' }],
        liabilitiesSnapshot: [],
        gameLogs: ['턴 1 시작'],
      };

      await service.create('user-1', dto as never);

      expect(mockPrisma.miniGameResult.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          userId: 'user-1',
        },
      });
    });
  });
});
