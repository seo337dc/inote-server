import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { deleteInoteAiData } from '../../users/inote-ai-client';

jest.mock('../../users/inote-ai-client', () => ({
  deleteInoteAiData: jest.fn(),
}));

describe('AdminUsersService', () => {
  let service: AdminUsersService;

  const mockPrisma = {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    post: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  const USER_LIST_SELECT = {
    id: true,
    name: true,
    nickname: true,
    email: true,
    role: true,
    usesInote: true,
    usesInoteMoney: true,
    createdAt: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(AdminUsersService);
  });

  describe('list', () => {
    it('기본값(1페이지, 20개)으로 조회한다', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await service.list({});

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        select: USER_LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({
        items: [{ id: 'user-1' }],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    });

    it('page/pageSize에 따라 skip/take를 계산한다', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(45);

      const result = await service.list({ page: 3, pageSize: 10 });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.totalPages).toBe(5);
    });

    it('결과가 없어도 totalPages는 최소 1이다', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await service.list({});

      expect(result.totalPages).toBe(1);
    });
  });

  describe('getById', () => {
    const USER_DETAIL_SELECT = {
      id: true,
      name: true,
      nickname: true,
      email: true,
      emailVerified: true,
      phone: true,
      image: true,
      role: true,
      usesInote: true,
      usesInoteMoney: true,
      createdAt: true,
      updatedAt: true,
    };

    it('id로 회원 상세 정보를 조회한다', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

      const result = await service.getById('user-1');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: USER_DETAIL_SELECT,
      });
      expect(result).toEqual({ id: 'user-1' });
    });

    it('존재하지 않는 id면 NotFoundException을 던진다', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getById('no-such-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('작성 글까지 포함해서 완전 삭제하고 aiDataDeleted 결과를 함께 반환한다', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      (deleteInoteAiData as jest.Mock).mockResolvedValue(true);

      const result = await service.delete('user-1');

      expect(deleteInoteAiData).toHaveBeenCalledWith(
        'user-1',
        expect.anything(),
      );
      expect(mockPrisma.post.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(result).toEqual({ success: true, aiDataDeleted: true });
    });

    it('inote-ai 삭제가 실패해도 계정 삭제는 그대로 진행하고 실패 사실을 반환한다', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      (deleteInoteAiData as jest.Mock).mockResolvedValue(false);

      const result = await service.delete('user-1');

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(result).toEqual({ success: true, aiDataDeleted: false });
    });

    it('존재하지 않는 id면 NotFoundException을 던지고 아무것도 지우지 않는다', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.delete('no-such-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(deleteInoteAiData).not.toHaveBeenCalled();
      expect(mockPrisma.user.delete).not.toHaveBeenCalled();
    });
  });
});
