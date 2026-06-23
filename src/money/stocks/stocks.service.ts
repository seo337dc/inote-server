import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';

@Injectable()
export class StocksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.stock.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, dto: CreateStockDto) {
    return this.prisma.stock.create({ data: { ...dto, userId } });
  }

  async update(userId: string, id: string, dto: UpdateStockDto) {
    await this.verifyOwner(userId, id);
    return this.prisma.stock.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.verifyOwner(userId, id);
    return this.prisma.stock.delete({ where: { id } });
  }

  private async verifyOwner(userId: string, id: string) {
    const stock = await this.prisma.stock.findUnique({ where: { id } });
    if (!stock) throw new NotFoundException('종목을 찾을 수 없습니다.');
    if (stock.userId !== userId) throw new ForbiddenException('권한이 없습니다.');
  }
}
