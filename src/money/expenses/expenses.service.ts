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
      data: {
        userId,
        date: new Date(dto.date),
        amount: dto.amount,
        description: dto.description,
        memo: dto.memo,
        category: dto.category,
        isWaste: dto.isWaste,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateExpenseDto) {
    await this.verifyOwner(userId, id);
    return this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.date && { date: new Date(dto.date) }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.memo !== undefined && { memo: dto.memo }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.isWaste !== undefined && { isWaste: dto.isWaste }),
      },
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
