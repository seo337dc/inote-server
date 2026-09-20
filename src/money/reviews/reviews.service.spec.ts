import { Test } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReviewsService', () => {
  let service: ReviewsService;

  const mockPrisma = {
    review: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(ReviewsService);
  });

  describe('findOne', () => {
    it('userId_type_year_period 복합키로 조회한다', async () => {
      mockPrisma.review.findUnique.mockResolvedValue(null);

      await service.findOne('user-1', 'WEEKLY', 2026, 38);

      expect(mockPrisma.review.findUnique).toHaveBeenCalledWith({
        where: {
          userId_type_year_period: {
            userId: 'user-1',
            type: 'WEEKLY',
            year: 2026,
            period: 38,
          },
        },
      });
    });
  });

  describe('upsert', () => {
    it('없으면 새로 생성한다', async () => {
      mockPrisma.review.upsert.mockResolvedValue({ id: 'r1' });

      await service.upsert('user-1', {
        type: 'MONTHLY',
        year: 2026,
        period: 9,
        rating: 4,
        text: '이번 달 잘 보냈다',
      } as never);

      expect(mockPrisma.review.upsert).toHaveBeenCalledWith({
        where: {
          userId_type_year_period: {
            userId: 'user-1',
            type: 'MONTHLY',
            year: 2026,
            period: 9,
          },
        },
        create: {
          userId: 'user-1',
          type: 'MONTHLY',
          year: 2026,
          period: 9,
          rating: 4,
          text: '이번 달 잘 보냈다',
        },
        update: { rating: 4, text: '이번 달 잘 보냈다' },
      });
    });

    it('이미 있으면 rating/text만 업데이트한다 (update 절 확인)', async () => {
      mockPrisma.review.upsert.mockResolvedValue({ id: 'r1', rating: 5 });

      const result = await service.upsert('user-1', {
        type: 'WEEKLY',
        year: 2026,
        period: 38,
        rating: 5,
        text: '수정된 회고',
      } as never);

      expect(mockPrisma.review.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { rating: 5, text: '수정된 회고' },
        }),
      );
      expect(result).toEqual({ id: 'r1', rating: 5 });
    });
  });
});
