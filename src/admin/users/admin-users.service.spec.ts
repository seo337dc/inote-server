import { Test } from '@nestjs/testing';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;

  const mockPrisma = {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
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
});
