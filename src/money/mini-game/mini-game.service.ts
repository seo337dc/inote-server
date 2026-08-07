import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMiniGameResultDto } from './dto/create-mini-game-result.dto';

@Injectable()
export class MiniGameService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.miniGameResult.findMany({
      where: { userId },
      orderBy: { playedAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const result = await this.prisma.miniGameResult.findUnique({
      where: { id },
    });
    if (!result) throw new NotFoundException('결과를 찾을 수 없습니다.');
    if (result.userId !== userId)
      throw new ForbiddenException('권한이 없습니다.');
    return result;
  }

  async create(userId: string, dto: CreateMiniGameResultDto) {
    return this.prisma.miniGameResult.create({
      data: {
        ...dto,
        userId,
        finalStocks: dto.finalStocks as unknown as Prisma.InputJsonValue,
        finalRealEstates:
          dto.finalRealEstates as unknown as Prisma.InputJsonValue,
        liabilitiesSnapshot:
          dto.liabilitiesSnapshot as unknown as Prisma.InputJsonValue,
        gameLogs: dto.gameLogs as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
