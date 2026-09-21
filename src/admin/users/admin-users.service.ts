import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { deleteInoteAiData } from '../../users/inote-ai-client';
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

const USER_DETAIL_SELECT = {
  id: true,
  name: true,
  nickname: true,
  email: true,
  emailVerified: true,
  phone: true,
  image: true,
  role: true,
  usesInote: true,
  usesInoteMoney: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

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

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_DETAIL_SELECT,
    });

    if (!user) {
      throw new NotFoundException('존재하지 않는 회원입니다.');
    }

    return user;
  }

  // 관리자 삭제 — 본인 탈퇴(UsersService.deleteMe)와 달리 Post도 완전히 지움
  // (본인 탈퇴는 "내 글은 남기고 싶다"가 자연스럽지만, 관리자가 계정을 지우는 상황은
  // 대개 문제 계정 정리라 글까지 같이 정리하는 게 맞다고 판단). Post.userId의 스키마
  // 기본 동작(SetNull)에 기대지 않고 user.delete 전에 명시적으로 먼저 지움 —
  // 둘 다 한 트랜잭션으로 묶어서 posts만 지워지고 user는 안 지워지는 상태를 방지.
  // inote-ai는 별도 DB라 트랜잭션 밖에서 처리 — 실패해도 계정 삭제 자체는 막지 않고,
  // 성공 여부를 응답에 담아서 관리자 화면에서 알림으로 보여줌.
  async delete(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('존재하지 않는 회원입니다.');
    }

    const aiDataDeleted = await deleteInoteAiData(id, this.logger);

    await this.prisma.$transaction([
      this.prisma.post.deleteMany({ where: { userId: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);

    return { success: true, aiDataDeleted };
  }
}
