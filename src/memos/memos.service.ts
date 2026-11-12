import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMemoDto } from './dto/create-memo.dto';
import { FindMemosQuery } from './dto/find-memos.query';
import { UpdateMemoDto } from './dto/update-memo.dto';
import {
  GENERAL_TARGET_ID,
  MEMO_MAX_COUNT,
  type MemoTargetType,
} from './memo-target';

// 응답에는 작성자(userId) 같은 내부 필드를 싣지 않는다
const MEMO_SELECT = {
  id: true,
  targetType: true,
  targetId: true,
  title: true,
  content: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class MemosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 내 메모 목록 — 항상 최근 수정순. 남의 메모는 where의 userId 조건으로 걸러진다.
   * - 인자 없음: 내 메모 전체 / targetType만: 그 종류 전체 / targetType+targetId: 그 대상의 메모
   * - general은 대상이 없어 targetId를 빈 문자열로 고정해 묻는다(보내온 targetId는 무시)
   * 메모장(탭)이 "만든 순서"가 필요하면 FE가 createdAt으로 다시 정렬한다.
   * 각 메모에는 글·독서 기록의 제목을 targetTitle로 붙인다(일반 메모·대상이 사라진 메모는 null).
   */
  async findAll(userId: string, query: FindMemosQuery) {
    const memos = await this.prisma.memo.findMany({
      where: {
        userId,
        ...this.targetWhere(query),
      },
      orderBy: { updatedAt: 'desc' },
      select: MEMO_SELECT,
    });
    const titles = await this.targetTitles(userId, memos);
    return memos.map((memo) => ({
      ...memo,
      targetTitle: titles.get(`${memo.targetType}:${memo.targetId}`) ?? null,
    }));
  }

  // 조회 대상 조건 — 안 준 값은 키 자체를 넣지 않는다(전체·종류별 조회). general은 targetId를 고정값으로 묻는다
  private targetWhere(query: FindMemosQuery) {
    if (query.targetType === 'general') {
      return { targetType: 'general', targetId: GENERAL_TARGET_ID };
    }
    return {
      ...(query.targetType !== undefined && { targetType: query.targetType }),
      ...(query.targetId !== undefined && { targetId: query.targetId }),
    };
  }

  // 글·독서 기록의 제목을 종류별로 한 번씩 읽는다 (내 글·내 독서 기록만). 키는 "종류:대상id"
  private async targetTitles(
    userId: string,
    memos: { targetType: string; targetId: string }[],
  ) {
    const idsOf = (type: MemoTargetType) => [
      ...new Set(
        memos.filter((m) => m.targetType === type).map((m) => m.targetId),
      ),
    ];
    const postIds = idsOf('post');
    const readingIds = idsOf('reading');
    const select = { id: true, title: true } as const;
    const [posts, readings] = await Promise.all([
      postIds.length > 0
        ? this.prisma.post.findMany({
            where: { id: { in: postIds }, userId },
            select,
          })
        : [],
      readingIds.length > 0
        ? this.prisma.readingLog.findMany({
            where: { id: { in: readingIds }, userId },
            select,
          })
        : [],
    ]);
    const titles = new Map<string, string>();
    for (const p of posts) titles.set(`post:${p.id}`, p.title);
    for (const r of readings) titles.set(`reading:${r.id}`, r.title);
    return titles;
  }

  /**
   * 메모 만들기. 대상 검증(403·404)이 먼저이고, 그다음 대상당 10장 상한(409)을 확인한다(일반 메모는 대상 검증 없이 전체 10장).
   * 장 수 확인과 만들기는 한 트랜잭션에 묶는다. 다만 기본 격리 수준(Read Committed)이라 같은 대상에 동시에 두 요청이
   * 들어오면 둘 다 9장으로 읽고 11장이 될 수 있다 — 개인 앱의 UX 상한이라 허용한다(보장이 필요하면 docs/todo/memos-followups.md).
   */
  async create(userId: string, dto: CreateMemoDto) {
    // 일반 메모는 대상이 없다 — 소유 검증을 건너뛰고 targetId는 고정값. 상한 10장은 내 일반 메모 전체 기준
    const targetId =
      dto.targetType === 'general' ? GENERAL_TARGET_ID : (dto.targetId ?? '');
    if (dto.targetType !== 'general') {
      await this.assertOwnTarget(userId, dto.targetType, targetId);
    }
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.memo.count({
        where: { userId, targetType: dto.targetType, targetId },
      });
      if (count >= MEMO_MAX_COUNT) {
        throw new ConflictException(
          `메모는 최대 ${MEMO_MAX_COUNT}장까지 만들 수 있습니다.`,
        );
      }
      // title·content를 안 주면 undefined → Prisma가 DB 기본값('')을 쓴다
      return tx.memo.create({
        data: {
          userId,
          targetType: dto.targetType,
          targetId,
          title: dto.title,
          content: dto.content,
        },
        select: MEMO_SELECT,
      });
    });
  }

  /** title·content 중 보낸 것만 고친다. 둘 다 없으면 400 (DB를 읽기 전에 거절). */
  async update(userId: string, id: string, dto: UpdateMemoDto) {
    if (dto.title === undefined && dto.content === undefined) {
      throw new BadRequestException('수정할 내용이 없습니다.');
    }
    await this.assertOwnMemo(userId, id);
    // undefined인 필드는 Prisma가 건드리지 않는다 ('' 빈 문자열은 값이므로 그대로 저장된다)
    return this.prisma.memo.update({
      where: { id },
      data: { title: dto.title, content: dto.content },
      select: MEMO_SELECT,
    });
  }

  /** 본인 메모만 지운다 (없거나 남의 메모는 404). 값을 돌려주지 않는다 — 컨트롤러가 204로 응답한다. */
  async remove(userId: string, id: string): Promise<void> {
    await this.assertOwnMemo(userId, id);
    await this.prisma.memo.delete({ where: { id } });
  }

  /** 없는 메모와 남의 메모를 구분하지 않고 같은 404를 돌려준다 (메모의 존재를 알려주지 않는다). */
  private async assertOwnMemo(userId: string, id: string) {
    const memo = await this.prisma.memo.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!memo || memo.userId !== userId) {
      throw new NotFoundException('메모를 찾을 수 없습니다.');
    }
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
