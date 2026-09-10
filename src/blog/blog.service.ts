import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

const AUTHOR_SELECT = { user: { select: { name: true, email: true } } };

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      include: AUTHOR_SELECT,
    });
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: AUTHOR_SELECT,
    });
    if (!post) throw new NotFoundException('글을 찾을 수 없습니다.');
    return post;
  }

  create(userId: string, dto: CreatePostDto) {
    return this.prisma.post.create({ data: { ...dto, userId } });
  }

  async update(userId: string, id: string, dto: UpdatePostDto) {
    const post = await this.findOne(id);
    if (post.userId !== userId) {
      throw new ForbiddenException('본인이 작성한 글만 수정할 수 있습니다.');
    }
    return this.prisma.post.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    const post = await this.findOne(id);
    if (post.userId !== userId) {
      throw new ForbiddenException('본인이 작성한 글만 삭제할 수 있습니다.');
    }
    return this.prisma.post.delete({ where: { id } });
  }
}
