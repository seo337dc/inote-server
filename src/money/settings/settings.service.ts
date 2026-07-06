import { Injectable } from '@nestjs/common';
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
}
