import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';

@Injectable()
export class TodosService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.todo.findMany({
      where: { userId },
      orderBy: [{ done: 'asc' }, { createdAt: 'desc' }],
    });
  }

  create(userId: string, dto: CreateTodoDto) {
    return this.prisma.todo.create({
      data: {
        userId,
        title: dto.title,
        ...(dto.dueDate !== undefined
          ? { dueDate: new Date(dto.dueDate) }
          : {}),
      },
    });
  }

  private async findRaw(id: string) {
    const todo = await this.prisma.todo.findUnique({ where: { id } });
    if (!todo) throw new NotFoundException('할 일을 찾을 수 없습니다.');
    return todo;
  }

  async update(userId: string, id: string, dto: UpdateTodoDto) {
    const todo = await this.findRaw(id);
    if (todo.userId !== userId) {
      throw new ForbiddenException('본인이 작성한 할 일만 수정할 수 있습니다.');
    }
    const { dueDate, ...fields } = dto;
    return this.prisma.todo.update({
      where: { id },
      data: {
        ...fields,
        ...(dueDate !== undefined ? { dueDate: new Date(dueDate) } : {}),
      },
    });
  }

  async remove(userId: string, id: string) {
    const todo = await this.findRaw(id);
    if (todo.userId !== userId) {
      throw new ForbiddenException('본인이 작성한 할 일만 삭제할 수 있습니다.');
    }
    return this.prisma.todo.delete({ where: { id } });
  }
}
