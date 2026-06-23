import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    return this.prisma.expense.findMany({
      where: { userId, date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
    });
  }

  async create(userId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: { ...dto, date: new Date(dto.date), userId },
    });
  }

  async update(userId: string, id: string, dto: UpdateExpenseDto) {
    await this.verifyOwner(userId, id);
    return this.prisma.expense.update({
      where: { id },
      data: { ...dto, ...(dto.date && { date: new Date(dto.date) }) },
    });
  }

  async remove(userId: string, id: string) {
    await this.verifyOwner(userId, id);
    return this.prisma.expense.delete({ where: { id } });
  }

  private async verifyOwner(userId: string, id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('내역을 찾을 수 없습니다.');
    if (expense.userId !== userId) throw new ForbiddenException('권한이 없습니다.');
  }
}
