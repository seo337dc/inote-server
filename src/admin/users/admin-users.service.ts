import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';

const USER_LIST_SELECT = {
  id: true,
  name: true,
  nickname: true,
  email: true,
  role: true,
  usesInote: true,
  usesInoteMoney: true,
  createdAt: true,
};

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list({ page = 1, pageSize = 20 }: ListAdminUsersQueryDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        select: USER_LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count(),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
}
