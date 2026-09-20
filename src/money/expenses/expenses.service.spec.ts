import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ExpensesService', () => {
  let service: ExpensesService;

  const mockPrisma = {
    expense: {
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
        ExpensesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(ExpensesService);
  });

  describe('findAll', () => {
    it('해당 연/월 범위(1일 00:00 ~ 다음달 1일 00:00)로 조회한다', async () => {
      mockPrisma.expense.findMany.mockResolvedValue([]);

      await service.findAll('user-1', 2026, 9);

      expect(mockPrisma.expense.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          date: { gte: new Date(2026, 8, 1), lt: new Date(2026, 9, 1) },
        },
        orderBy: { date: 'asc' },
      });
    });
  });

  describe('create', () => {
    it('요청자의 userId로 지출 내역을 생성한다', async () => {
      mockPrisma.expense.create.mockResolvedValue({ id: 'e1' });

      await service.create('user-1', {
        date: '2026-09-20',
        amount: 5000,
        description: '점심',
        category: 'FOOD',
        isWaste: false,
      });

      expect(mockPrisma.expense.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          date: new Date('2026-09-20'),
          amount: 5000,
          description: '점심',
          memo: undefined,
          category: 'FOOD',
          isWaste: false,
        },
      });
    });
  });

  describe('update', () => {
    it('존재하지 않으면 NotFoundException', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(null);

      await expect(service.update('user-1', 'e1', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('본인 소유가 아니면 ForbiddenException', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({
        id: 'e1',
        userId: 'owner',
      });

      await expect(service.update('other-user', 'e1', {})).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.expense.update).not.toHaveBeenCalled();
    });

    it('전달된 필드만 부분 수정한다', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({
        id: 'e1',
        userId: 'user-1',
      });
      mockPrisma.expense.update.mockResolvedValue({ id: 'e1', amount: 8000 });

      await service.update('user-1', 'e1', { amount: 8000 });

      expect(mockPrisma.expense.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { amount: 8000 },
      });
    });

    it('isWaste: false처럼 falsy 값도 정상적으로 반영한다', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({
        id: 'e1',
        userId: 'user-1',
      });
      mockPrisma.expense.update.mockResolvedValue({ id: 'e1' });

      await service.update('user-1', 'e1', { isWaste: false });

      expect(mockPrisma.expense.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { isWaste: false },
      });
    });
  });

  describe('remove', () => {
    it('존재하지 않으면 NotFoundException', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue(null);

      await expect(service.remove('user-1', 'e1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('본인 소유가 아니면 ForbiddenException', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({
        id: 'e1',
        userId: 'owner',
      });

      await expect(service.remove('other-user', 'e1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.expense.delete).not.toHaveBeenCalled();
    });

    it('본인 소유면 삭제된다', async () => {
      mockPrisma.expense.findUnique.mockResolvedValue({
        id: 'e1',
        userId: 'user-1',
      });
      mockPrisma.expense.delete.mockResolvedValue({ id: 'e1' });

      await service.remove('user-1', 'e1');

      expect(mockPrisma.expense.delete).toHaveBeenCalledWith({
        where: { id: 'e1' },
      });
    });
  });
});
