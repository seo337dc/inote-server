import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FinanceCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(
    userId: string,
    book: Prisma.BookGetPayload<{
      include: { _count: { select: { likes: true } }; likes: true };
    }>,
  ) {
    const { _count, likes, ...rest } = book;
    return {
      ...rest,
      likeCount: _count.likes,
      likedByMe: likes.some((l) => l.userId === userId),
      isOwner: book.userId === userId,
    };
  }

  async findAll(
    userId: string,
    query: { category?: FinanceCategory; q?: string },
  ) {
    const where: Prisma.BookWhereInput = {
      OR: [{ isShared: true }, { userId }],
      ...(query.category ? { category: query.category } : {}),
      ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
    };

    const books = await this.prisma.book.findMany({
      where,
      include: {
        _count: { select: { likes: true } },
        likes: { where: { userId } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return books.map((b) => this.toResponse(userId, b));
  }

  async findOne(userId: string, id: string) {
    const book = await this.prisma.book.findUnique({
      where: { id },
      include: {
        _count: { select: { likes: true } },
        likes: { where: { userId } },
      },
    });
    if (!book) throw new NotFoundException('도서를 찾을 수 없습니다.');
    if (!book.isShared && book.userId !== userId) {
      throw new ForbiddenException('권한이 없습니다.');
    }
    return this.toResponse(userId, book);
  }

  async create(userId: string, dto: CreateBookDto) {
    return this.prisma.book.create({ data: { ...dto, userId } });
  }

  async update(userId: string, id: string, dto: UpdateBookDto) {
    await this.verifyOwner(userId, id);
    return this.prisma.book.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.verifyOwner(userId, id);
    return this.prisma.book.delete({ where: { id } });
  }

  async toggleLike(userId: string, id: string) {
    const book = await this.prisma.book.findUnique({ where: { id } });
    if (!book) throw new NotFoundException('도서를 찾을 수 없습니다.');
    if (!book.isShared && book.userId !== userId) {
      throw new ForbiddenException('권한이 없습니다.');
    }

    const existing = await this.prisma.bookLike.findUnique({
      where: { userId_bookId: { userId, bookId: id } },
    });

    if (existing) {
      await this.prisma.bookLike.delete({ where: { id: existing.id } });
      return { liked: false };
    }
    await this.prisma.bookLike.create({ data: { userId, bookId: id } });
    return { liked: true };
  }

  private async verifyOwner(userId: string, id: string) {
    const book = await this.prisma.book.findUnique({ where: { id } });
    if (!book) throw new NotFoundException('도서를 찾을 수 없습니다.');
    if (book.userId !== userId)
      throw new ForbiddenException('권한이 없습니다.');
  }
}
