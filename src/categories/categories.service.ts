import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateCategoryDto } from './dto/create-category.dto';
import { MoveCategoryDto } from './dto/move-category.dto';
import { RenameCategoryDto } from './dto/rename-category.dto';

const MAX_DEPTH = 3;
const DEFAULT_CATEGORY_NAMES = ['학습', '이직', '일기', '블로그', '기록'];

// 카테고리 목록 정렬: 같은 부모 안에서는 position 순, 같으면 만든 순서 (FE의 compareSiblings와 같은 기준)
const CATEGORY_ORDER: Prisma.PostCategoryOrderByWithRelationInput[] = [
  { position: 'asc' },
  { createdAt: 'asc' },
];

type CategoryRow = {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  position: number;
  createdAt: Date;
};

// 같은 부모 아래(parentId가 null이면 최상위) 자식들을 position → createdAt 순으로
function childrenOf<T extends CategoryRow>(
  list: T[],
  parentId: string | null,
): T[] {
  return list
    .filter((c) => c.parentId === parentId)
    .sort(
      (a, b) =>
        a.position - b.position ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
}

// id 자신과 그 아래 모든 하위 카테고리 (순환 데이터여도 끝나도록 방문 기록을 둔다)
function subtreeOf<T extends CategoryRow>(list: T[], id: string): T[] {
  const byParent = new Map<string, T[]>();
  for (const c of list) {
    if (c.parentId)
      byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c]);
  }
  const root = list.find((c) => c.id === id);
  if (!root) return [];
  const result: T[] = [root];
  const visited = new Set<string>([id]);
  for (let i = 0; i < result.length; i++) {
    for (const child of byParent.get(result[i].id) ?? []) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      result.push(child);
    }
  }
  return result;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const existing = await this.prisma.postCategory.findMany({
      where: { userId },
      orderBy: CATEGORY_ORDER,
    });
    if (existing.length > 0) return existing;

    // 첫 조회 시 기본 카테고리 5개를 자동 생성 — 가입 시점 마이그레이션 없이도
    // 모든 유저가 글쓰기 화면에서 기본 카테고리를 바로 볼 수 있게 한다.
    await this.prisma.postCategory.createMany({
      data: DEFAULT_CATEGORY_NAMES.map((name, position) => ({
        userId,
        name,
        depth: 1,
        position,
      })),
    });
    return this.prisma.postCategory.findMany({
      where: { userId },
      orderBy: CATEGORY_ORDER,
    });
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

    // 새 카테고리는 같은 부모 아래 맨 끝에 놓는다 (형제 수 = 마지막 position + 1)
    const position = await this.prisma.postCategory.count({
      where: { userId, parentId: dto.parentId ?? null },
    });

    return this.prisma.postCategory.create({
      data: {
        userId,
        name: dto.name,
        parentId: dto.parentId ?? null,
        depth,
        position,
      },
    });
  }

  // 이름 수정. 글은 카테고리를 id(Post.categoryId)로 가리키므로, 같은 이름이 다른 부모 아래 있어도 된다 —
  // 막는 건 "같은 부모 아래 형제와 이름이 같은 것"뿐이다 (create와 같은 규칙).
  // Post.category는 표시용 이름 사본이라, 이 카테고리에 속한 내 글의 사본만 새 이름으로 같이 바꾼다
  // (이름만 같은 다른 카테고리의 글은 건드리지 않는다).
  async rename(userId: string, id: string, dto: RenameCategoryDto) {
    const category = await this.prisma.postCategory.findUnique({
      where: { id },
    });
    // 남의 카테고리도 404 — 존재 여부를 알려 주지 않는다
    if (!category || category.userId !== userId) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    }

    // 바뀐 게 없으면 아무것도 쓰지 않고 그대로 돌려준다
    if (dto.name === category.name) return category;

    const sibling = await this.prisma.postCategory.findFirst({
      where: {
        userId,
        parentId: category.parentId,
        name: dto.name,
        NOT: { id },
      },
    });
    if (sibling) {
      throw new ConflictException(
        '같은 위치에 같은 이름의 카테고리가 이미 있습니다.',
      );
    }

    // 카테고리 이름과 글의 이름 사본을 한 트랜잭션으로 — 둘 중 하나만 바뀐 채로 남지 않게
    const [updated] = await this.prisma.$transaction([
      this.prisma.postCategory.update({
        where: { id },
        data: { name: dto.name },
      }),
      this.prisma.post.updateMany({
        where: { userId, categoryId: id },
        data: { category: dto.name },
      }),
    ]);
    return updated;
  }

  // 카테고리 위치 이동 — "dto.parentId 밑의 dto.index번째"로 옮긴다. 같은 부모 안에서 순서만 바꾸는 것도,
  // 다른 카테고리 안(또는 최상위)으로 옮기는 것도 같은 요청이다. 규칙은 FE의 moveCategory(낙관적 이동)와 같다:
  //  - index는 "옮기는 카테고리를 뺀 새 부모의 자식 목록"에서의 위치이고, 범위를 넘으면 맨 뒤·음수면 맨 앞으로 맞춘다
  //  - 다른 부모로 옮기면 원래 부모에 남은 형제의 position도 0부터 다시 메운다
  //  - 하위가 딸린 카테고리를 옮기면 하위의 depth도 같은 만큼 바뀐다
  // 내 카테고리 전체를 한 번에 읽어 메모리에서 계산하고, 값이 바뀐 행만 한 트랜잭션으로 갱신한다.
  async move(userId: string, id: string, dto: MoveCategoryDto) {
    const list = await this.prisma.postCategory.findMany({ where: { userId } });

    // 남의 카테고리는 내 목록에 없으므로 존재 여부를 알려 주지 않고 404
    const moving = list.find((c) => c.id === id);
    if (!moving) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다.');
    }
    const newParent =
      dto.parentId === null ? null : list.find((c) => c.id === dto.parentId);
    if (newParent === undefined) {
      throw new NotFoundException('상위 카테고리를 찾을 수 없습니다.');
    }

    const subtree = subtreeOf(list, id);
    if (newParent && subtree.some((c) => c.id === newParent.id)) {
      throw new BadRequestException(
        '자기 자신이나 자기 하위 카테고리 밑으로는 옮길 수 없습니다.',
      );
    }

    // 옮긴 뒤 하위까지 포함한 가장 깊은 단계가 3을 넘으면 안 된다
    const newDepth = (newParent?.depth ?? 0) + 1;
    const depthDelta = newDepth - moving.depth;
    const deepest = Math.max(...subtree.map((c) => c.depth)) + depthDelta;
    if (deepest > MAX_DEPTH) {
      throw new BadRequestException(
        '카테고리는 최대 3단계까지만 만들 수 있습니다.',
      );
    }

    const newParentId = newParent?.id ?? null;
    const parentChanged = moving.parentId !== newParentId;
    const siblings = childrenOf(list, newParentId).filter((c) => c.id !== id);

    // 다른 부모로 옮길 때만 이름 충돌을 본다 (create·rename과 같은 규칙: 같은 부모 아래 같은 이름은 불가).
    // 같은 부모 안에서 순서만 바꾸는 것은 이름이 그대로라 충돌할 수 없다
    if (parentChanged && siblings.some((c) => c.name === moving.name)) {
      throw new ConflictException(
        '같은 위치에 같은 이름의 카테고리가 이미 있습니다.',
      );
    }

    const index = Math.min(Math.max(dto.index, 0), siblings.length);
    const newOrder = [
      ...siblings.slice(0, index),
      moving,
      ...siblings.slice(index),
    ];
    const nextPosition = new Map<string, number>();
    newOrder.forEach((c, i) => nextPosition.set(c.id, i));
    if (parentChanged) {
      childrenOf(list, moving.parentId)
        .filter((c) => c.id !== id)
        .forEach((c, i) => nextPosition.set(c.id, i));
    }

    // 값이 실제로 바뀐 행만 갱신한다
    const movedIds = new Set(subtree.map((c) => c.id));
    const updates: Prisma.PrismaPromise<unknown>[] = [];
    for (const c of list) {
      const data: Prisma.PostCategoryUncheckedUpdateInput = {};
      const position = nextPosition.get(c.id);
      if (c.id === id && parentChanged) {
        // 다른 부모로 옮기는 행은 새 자리를 통째로 적는다 (값이 우연히 같아도 parentId·depth·position을 모두)
        data.parentId = newParentId;
        data.depth = newDepth;
        data.position = position;
      } else {
        if (movedIds.has(c.id) && depthDelta !== 0) {
          data.depth = c.depth + depthDelta;
        }
        if (position !== undefined && position !== c.position) {
          data.position = position;
        }
      }
      if (Object.keys(data).length > 0) {
        updates.push(
          this.prisma.postCategory.update({ where: { id: c.id }, data }),
        );
      }
    }
    // 중간에 실패해 일부만 바뀐 트리가 남지 않게 한 트랜잭션으로 (제자리로 옮기면 쓸 것이 없다)
    if (updates.length > 0) {
      await this.prisma.$transaction(updates);
    }

    return this.prisma.postCategory.findMany({
      where: { userId },
      orderBy: CATEGORY_ORDER,
    });
  }
}
