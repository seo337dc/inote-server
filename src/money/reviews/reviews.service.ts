import { Injectable } from '@nestjs/common';
import { ReviewType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertReviewDto } from './dto/upsert-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(userId: string, type: ReviewType, year: number, period: number) {
    return this.prisma.review.findUnique({
      where: { userId_type_year_period: { userId, type, year, period } },
    });
  }

  async upsert(userId: string, dto: UpsertReviewDto) {
    return this.prisma.review.upsert({
      where: { userId_type_year_period: { userId, type: dto.type, year: dto.year, period: dto.period } },
      create: { userId, type: dto.type, year: dto.year, period: dto.period, rating: dto.rating, text: dto.text },
      update: { rating: dto.rating, text: dto.text },
    });
  }
}
