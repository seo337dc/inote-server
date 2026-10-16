import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { RenameCategoryDto } from './dto/rename-category.dto';

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

    // 같은 부모 아래(최상위끼리 포함) 형제 중에 같은 이름이 있으면 막는다. 글이 카테고리를 id로 가리키므로
    // 다른 부모 아래의 같은 이름(예: 학습 > AI, 사이드프로젝트 > AI)은 허용한다.
    // DB 유니크 제약으로는 못 막는다 — PostgreSQL은 parentId가 NULL인 최상위끼리를 서로 다른 값으로 보기 때문.
    const sibling = await this.prisma.postCategory.findFirst({
      where: { userId, parentId: dto.parentId ?? null, name: dto.name },
    });
    if (sibling) {
      throw new ConflictException(
        '같은 위치에 같은 이름의 카테고리가 이미 있습니다.',
      );
    }

    return this.prisma.postCategory.create({
      data: { userId, name: dto.name, parentId: dto.parentId ?? null, depth },
    });
  }

  // TODO(작업 #6): 이름 수정 구현 — 지금은 테스트가 "빨간색"으로 시작하도록 자리만 잡아 둔 상태.
  // 테스트(categories.rename.spec.ts)를 하나씩 통과시키며 채운다.
  rename(userId: string, id: string, dto: RenameCategoryDto): Promise<never> {
    void userId;
    void id;
    void dto;
    return Promise.reject(new Error('rename: 아직 구현하지 않았습니다.'));
  }
}
