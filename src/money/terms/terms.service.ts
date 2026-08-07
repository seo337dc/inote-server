import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FinanceCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTermDto } from './dto/create-term.dto';
import { UpdateTermDto } from './dto/update-term.dto';

@Injectable()
export class TermsService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(
    userId: string,
    term: Prisma.TermGetPayload<{
      include: { _count: { select: { likes: true } }; likes: true };
    }>,
  ) {
    const { _count, likes, ...rest } = term;
    return {
      ...rest,
      likeCount: _count.likes,
      likedByMe: likes.some((l) => l.userId === userId),
      isOwner: term.userId === userId,
    };
  }

  async findAll(
    userId: string,
    query: { category?: FinanceCategory; q?: string },
  ) {
    const where: Prisma.TermWhereInput = {
      OR: [{ isShared: true }, { userId }],
      ...(query.category ? { category: query.category } : {}),
      ...(query.q ? { term: { contains: query.q, mode: 'insensitive' } } : {}),
    };

    const terms = await this.prisma.term.findMany({
      where,
      include: {
        _count: { select: { likes: true } },
        likes: { where: { userId } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return terms.map((t) => this.toResponse(userId, t));
  }

  async findOne(userId: string, id: string) {
    const term = await this.prisma.term.findUnique({
      where: { id },
      include: {
        _count: { select: { likes: true } },
        likes: { where: { userId } },
      },
    });
    if (!term) throw new NotFoundException('용어를 찾을 수 없습니다.');
    if (!term.isShared && term.userId !== userId) {
      throw new ForbiddenException('권한이 없습니다.');
    }
    return this.toResponse(userId, term);
  }

  async create(userId: string, dto: CreateTermDto) {
    return this.prisma.term.create({ data: { ...dto, userId } });
  }

  async update(userId: string, id: string, dto: UpdateTermDto) {
    await this.verifyOwner(userId, id);
    return this.prisma.term.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.verifyOwner(userId, id);
    return this.prisma.term.delete({ where: { id } });
  }

  async toggleLike(userId: string, id: string) {
    const term = await this.prisma.term.findUnique({ where: { id } });
    if (!term) throw new NotFoundException('용어를 찾을 수 없습니다.');
    if (!term.isShared && term.userId !== userId) {
      throw new ForbiddenException('권한이 없습니다.');
    }

    const existing = await this.prisma.termLike.findUnique({
      where: { userId_termId: { userId, termId: id } },
    });

    if (existing) {
      await this.prisma.termLike.delete({ where: { id: existing.id } });
      return { liked: false };
    }
    await this.prisma.termLike.create({ data: { userId, termId: id } });
    return { liked: true };
  }

  private async verifyOwner(userId: string, id: string) {
    const term = await this.prisma.term.findUnique({ where: { id } });
    if (!term) throw new NotFoundException('용어를 찾을 수 없습니다.');
    if (term.userId !== userId)
      throw new ForbiddenException('권한이 없습니다.');
  }
}
