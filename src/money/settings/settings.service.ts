import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertSettingsDto } from './dto/upsert-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    return this.prisma.userSetting.findUnique({ where: { userId } });
  }

  async upsert(userId: string, dto: UpsertSettingsDto) {
    const { savings, fixedExpenses, ...rest } = dto;

    const data = {
      ...rest,
      ...(savings !== undefined && { savings: savings as unknown as Prisma.InputJsonValue }),
      ...(fixedExpenses !== undefined && { fixedExpenses: fixedExpenses as unknown as Prisma.InputJsonValue }),
    };

    return this.prisma.userSetting.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async createHistory(userId: string, month: string, title?: string) {
    const current = await this.prisma.userSetting.findUnique({ where: { userId } });
    if (!current) throw new NotFoundException('저장된 자산 설정이 없습니다');

    return this.prisma.settingHistory.create({
      data: {
        userId,
        month,
        title: title ?? null,
        salary: current.salary,
        salaryDate: current.salaryDate,
        dailyLimit: current.dailyLimit,
        monthlySavingGoal: current.monthlySavingGoal,
        assetUpdateDate: current.assetUpdateDate,
        savings: current.savings as Prisma.InputJsonValue,
        fixedExpenses: current.fixedExpenses as Prisma.InputJsonValue,
      },
    });
  }

  async getHistory(userId: string) {
    return this.prisma.settingHistory.findMany({
      where: { userId },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async getHistoryById(userId: string, id: string) {
    const item = await this.prisma.settingHistory.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('히스토리를 찾을 수 없습니다');
    if (item.userId !== userId) throw new ForbiddenException();
    return item;
  }

  async updateHistoryTitle(userId: string, id: string, title: string) {
    const item = await this.prisma.settingHistory.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('히스토리를 찾을 수 없습니다');
    if (item.userId !== userId) throw new ForbiddenException();
    return this.prisma.settingHistory.update({ where: { id }, data: { title } });
  }
}
