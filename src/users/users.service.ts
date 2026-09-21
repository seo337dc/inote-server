import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        emailVerified: true,
        phone: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        emailVerified: true,
        phone: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // 회원 탈퇴. Post.userId는 스키마상 SetNull이라 작성한 글은 작성자만 익명으로 남고 그대로
  // 유지됨(의도된 동작). session/account 등은 스키마 Cascade로 같이 삭제됨.
  // inote-ai는 별도 DB라 여기서 직접 지워달라고 호출 — 실패해도 탈퇴 자체는 막지 않음
  // (내 계정을 지우려는데 다른 서비스 장애로 막히면 안 됨).
  async deleteMe(userId: string) {
    await this.deleteAiData(userId);
    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }

  private async deleteAiData(userId: string) {
    try {
      const res = await fetch(
        `${process.env.INOTE_AI_URL}/sessions?user_id=${encodeURIComponent(userId)}`,
        {
          method: 'DELETE',
          headers: { 'x-internal-secret': process.env.INTERNAL_SECRET ?? '' },
        },
      );
      if (!res.ok) throw new Error(`inote-ai responded ${res.status}`);
    } catch (e) {
      this.logger.warn(
        `failed to delete inote-ai data for user ${userId}: ${e}`,
      );
    }
  }
}
