import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

const MAX_DEPTH = 3;
const DEFAULT_CATEGORY_NAMES = ['학습', '이직', '일기', '블로그', '기록'];

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const existing = await this.prisma.postCategory.findMany({
      where: { userId },
    });
    if (existing.length > 0) return existing;

    // 첫 조회 시 기본 카테고리 5개를 자동 생성 — 가입 시점 마이그레이션 없이도
    // 모든 유저가 글쓰기 화면에서 기본 카테고리를 바로 볼 수 있게 한다.
    await this.prisma.postCategory.createMany({
      data: DEFAULT_CATEGORY_NAMES.map((name) => ({ userId, name, depth: 1 })),
    });
    return this.prisma.postCategory.findMany({ where: { userId } });
  }

  async create(userId: string, dto: CreateCategoryDto) {
    let depth = 1;

    if (dto.parentId) {
      const parent = await this.prisma.postCategory.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent || parent.userId !== userId) {
        throw new NotFoundException('상위 카테고리를 찾을 수 없습니다.');
      }
      if (parent.depth >= MAX_DEPTH) {
        throw new BadRequestException(
          '카테고리는 최대 3단계까지만 만들 수 있습니다.',
        );
      }
      depth = parent.depth + 1;
    }

    return this.prisma.postCategory.create({
      data: { userId, name: dto.name, parentId: dto.parentId ?? null, depth },
    });
  }
}
