import { HttpException, Injectable, Logger } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'http';
import { AuthActionError, setPasswordForSession } from '../auth/auth-actions';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { deleteInoteAiData } from './inote-ai-client';

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

  // 소셜 로그인만으로 가입해서 credential 계정이 없는 유저용 — 비밀번호를 새로 생성함.
  // 이미 credential 계정에 비밀번호가 있으면 better-auth가 PASSWORD_ALREADY_SET으로 막음
  // (변경은 이 API 범위 밖, changePassword는 별도로 다룰 예정).
  async setPassword(headers: IncomingHttpHeaders, dto: SetPasswordDto) {
    try {
      await setPasswordForSession(headers, dto.newPassword);
      return { success: true };
    } catch (e) {
      if (e instanceof AuthActionError) {
        throw new HttpException(e.body, e.statusCode);
      }
      throw e;
    }
  }

  // 회원 탈퇴. Post.userId는 스키마상 SetNull이라 작성한 글은 작성자만 익명으로 남고 그대로
  // 유지됨(의도된 동작). session/account 등은 스키마 Cascade로 같이 삭제됨.
  // inote-ai는 별도 DB라 여기서 직접 지워달라고 호출 — 실패해도 탈퇴 자체는 막지 않음
  // (내 계정을 지우려는데 다른 서비스 장애로 막히면 안 됨).
  async deleteMe(userId: string) {
    await deleteInoteAiData(userId, this.logger);
    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }
}
