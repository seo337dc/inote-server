import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;

  const mockPrisma = {
    userSetting: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    settingHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(SettingsService);
  });

  describe('get', () => {
    it('userId로 자산 설정을 조회한다', async () => {
      mockPrisma.userSetting.findUnique.mockResolvedValue({ userId: 'user-1' });

      await service.get('user-1');

      expect(mockPrisma.userSetting.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  describe('upsert', () => {
    it('savings/fixedExpenses가 없으면 data에 포함하지 않는다', async () => {
      mockPrisma.userSetting.upsert.mockResolvedValue({});

      await service.upsert('user-1', { salary: 3000000 });

      expect(mockPrisma.userSetting.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        create: { userId: 'user-1', salary: 3000000 },
        update: { salary: 3000000 },
      });
    });

    it('savings/fixedExpenses가 있으면 data에 포함한다', async () => {
      mockPrisma.userSetting.upsert.mockResolvedValue({});
      const savings = [{ id: 's1', name: '적금', amount: 100000 }];

      await service.upsert('user-1', { salary: 3000000, savings });

      expect(mockPrisma.userSetting.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        create: { userId: 'user-1', salary: 3000000, savings },
        update: { salary: 3000000, savings },
      });
    });
  });

  describe('createHistory', () => {
    it('저장된 설정이 없으면 NotFoundException', async () => {
      mockPrisma.userSetting.findUnique.mockResolvedValue(null);

      await expect(service.createHistory('user-1', '2026-09')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.settingHistory.create).not.toHaveBeenCalled();
    });

    it('현재 설정을 스냅샷으로 저장한다 (title/memo 없으면 null)', async () => {
      mockPrisma.userSetting.findUnique.mockResolvedValue({
        salary: 3000000,
        salaryDate: 25,
        dailyLimit: 20000,
        monthlySavingGoal: 500000,
        assetUpdateDate: 1,
        savings: [],
        fixedExpenses: [],
        memo: null,
      });
      mockPrisma.settingHistory.create.mockResolvedValue({ id: 'h1' });

      await service.createHistory('user-1', '2026-09');

      expect(mockPrisma.settingHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          month: '2026-09',
          title: null,
          salary: 3000000,
          memo: null,
        }),
      });
    });

    it('title이 주어지면 그대로 저장한다', async () => {
      mockPrisma.userSetting.findUnique.mockResolvedValue({
        salary: 0,
        salaryDate: 25,
        dailyLimit: 0,
        monthlySavingGoal: 0,
        assetUpdateDate: 1,
        savings: [],
        fixedExpenses: [],
        memo: '메모',
      });
      mockPrisma.settingHistory.create.mockResolvedValue({ id: 'h1' });

      await service.createHistory('user-1', '2026-09', '9월 스냅샷');

      expect(mockPrisma.settingHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ title: '9월 스냅샷', memo: '메모' }),
      });
    });
  });

  describe('getHistory', () => {
    it('최신순으로 히스토리 목록을 조회한다', async () => {
      mockPrisma.settingHistory.findMany.mockResolvedValue([]);

      await service.getHistory('user-1');

      expect(mockPrisma.settingHistory.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { recordedAt: 'desc' },
      });
    });
  });

  describe('getHistoryById / updateHistoryTitle / deleteHistory — 소유권 체크', () => {
    it('존재하지 않으면 NotFoundException (조회)', async () => {
      mockPrisma.settingHistory.findUnique.mockResolvedValue(null);

      await expect(service.getHistoryById('user-1', 'h1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('본인 소유가 아니면 ForbiddenException (조회)', async () => {
      mockPrisma.settingHistory.findUnique.mockResolvedValue({
        id: 'h1',
        userId: 'owner',
      });

      await expect(service.getHistoryById('other-user', 'h1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('본인 소유면 정상 조회된다', async () => {
      mockPrisma.settingHistory.findUnique.mockResolvedValue({
        id: 'h1',
        userId: 'user-1',
      });

      const result = await service.getHistoryById('user-1', 'h1');
      expect(result).toEqual({ id: 'h1', userId: 'user-1' });
    });

    it('본인 소유가 아니면 제목 수정 시 ForbiddenException', async () => {
      mockPrisma.settingHistory.findUnique.mockResolvedValue({
        id: 'h1',
        userId: 'owner',
      });

      await expect(
        service.updateHistoryTitle('other-user', 'h1', '변경'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.settingHistory.update).not.toHaveBeenCalled();
    });

    it('본인 소유면 제목이 수정된다', async () => {
      mockPrisma.settingHistory.findUnique.mockResolvedValue({
        id: 'h1',
        userId: 'user-1',
      });
      mockPrisma.settingHistory.update.mockResolvedValue({
        id: 'h1',
        title: '변경',
      });

      const result = await service.updateHistoryTitle('user-1', 'h1', '변경');

      expect(mockPrisma.settingHistory.update).toHaveBeenCalledWith({
        where: { id: 'h1' },
        data: { title: '변경' },
      });
      expect(result).toEqual({ id: 'h1', title: '변경' });
    });

    it('본인 소유가 아니면 삭제 시 ForbiddenException', async () => {
      mockPrisma.settingHistory.findUnique.mockResolvedValue({
        id: 'h1',
        userId: 'owner',
      });

      await expect(service.deleteHistory('other-user', 'h1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.settingHistory.delete).not.toHaveBeenCalled();
    });

    it('본인 소유면 삭제된다', async () => {
      mockPrisma.settingHistory.findUnique.mockResolvedValue({
        id: 'h1',
        userId: 'user-1',
      });
      mockPrisma.settingHistory.delete.mockResolvedValue({ id: 'h1' });

      await service.deleteHistory('user-1', 'h1');

      expect(mockPrisma.settingHistory.delete).toHaveBeenCalledWith({
        where: { id: 'h1' },
      });
    });
  });
});
