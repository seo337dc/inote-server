import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMemoDto } from './dto/create-memo.dto';
import { FindMemosQuery } from './dto/find-memos.query';
import { UpdateMemoDto } from './dto/update-memo.dto';
import type { MemoTargetType } from './memo-target';

// 응답에는 작성자(userId) 같은 내부 필드를 싣지 않는다
const MEMO_SELECT = {
  id: true,
  targetType: true,
  targetId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class MemosService {
  constructor(private readonly prisma: PrismaService) {}

  /** 대상에 붙은 내 메모 — 생성순. 남의 메모는 where의 userId 조건으로 걸러진다. */
  findAll(userId: string, query: FindMemosQuery) {
    return this.prisma.memo.findMany({
      where: {
        userId,
        targetType: query.targetType,
        targetId: query.targetId,
      },
      orderBy: { createdAt: 'asc' },
      select: MEMO_SELECT,
    });
  }

  async create(userId: string, dto: CreateMemoDto) {
    await this.assertOwnTarget(userId, dto.targetType, dto.targetId);
    return this.prisma.memo.create({
      data: {
        userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        content: dto.content,
      },
      select: MEMO_SELECT,
    });
  }

  /** 없는 메모와 남의 메모를 구분하지 않고 같은 404를 돌려준다 (메모의 존재를 알려주지 않는다). */
  async update(userId: string, id: string, dto: UpdateMemoDto) {
    const memo = await this.prisma.memo.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!memo || memo.userId !== userId) {
      throw new NotFoundException('메모를 찾을 수 없습니다.');
    }
    return this.prisma.memo.update({
      where: { id },
      data: { content: dto.content },
      select: MEMO_SELECT,
    });
  }

  // 메모는 내가 쓴 글·독서 기록에만 붙일 수 있다. 임시저장(draft) 글에도 붙일 수 있다 (글을 쓰는 중에 쓰는 기능).
  // 작성자가 없는 글(탈퇴·옛 글, userId null)은 누구의 것도 아니므로 거부된다.
  private async assertOwnTarget(
    userId: string,
    targetType: MemoTargetType,
    targetId: string,
  ) {
    const target =
      targetType === 'post'
        ? await this.prisma.post.findUnique({
            where: { id: targetId },
            select: { userId: true },
          })
        : await this.prisma.readingLog.findUnique({
            where: { id: targetId },
            select: { userId: true },
          });
    if (!target) {
      throw new NotFoundException(
        targetType === 'post'
          ? '글을 찾을 수 없습니다.'
          : '독서 기록을 찾을 수 없습니다.',
      );
    }
    if (target.userId !== userId) {
      throw new ForbiddenException(
        '본인이 작성한 글에만 메모를 쓸 수 있습니다.',
      );
    }
  }
}
