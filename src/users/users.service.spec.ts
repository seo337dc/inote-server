import { Test } from '@nestjs/testing';
import { HttpException, Logger } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthActionError, setPasswordForSession } from '../auth/auth-actions';

jest.mock('../auth/auth-actions', () => {
  class AuthActionError extends Error {
    constructor(statusCode: number, body: Record<string, unknown>) {
      super(typeof body.message === 'string' ? body.message : 'Auth action failed');
      this.statusCode = statusCode;
      this.body = body;
    }
    statusCode: number;
    body: Record<string, unknown>;
  }
  return { AuthActionError, setPasswordForSession: jest.fn() };
});

describe('UsersService', () => {
  let service: UsersService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const USER_SELECT = {
    id: true,
    name: true,
    nickname: true,
    email: true,
    emailVerified: true,
    phone: true,
    image: true,
    createdAt: true,
    updatedAt: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('getMe', () => {
    it('userId로 프로필을 조회하고 민감 필드는 select에서 제외한다', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

      await service.getMe('user-1');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: USER_SELECT,
      });
    });
  });

  describe('updateMe', () => {
    it('dto로 프로필을 수정한다', async () => {
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        name: '수정됨',
      });

      const result = await service.updateMe('user-1', { name: '수정됨' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: '수정됨' },
        select: USER_SELECT,
      });
      expect(result).toEqual({ id: 'user-1', name: '수정됨' });
    });

    it('nickname/phone도 수정할 수 있다', async () => {
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        nickname: '닉네임',
        phone: '010-1234-5678',
      });

      await service.updateMe('user-1', {
        nickname: '닉네임',
        phone: '010-1234-5678',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { nickname: '닉네임', phone: '010-1234-5678' },
        select: USER_SELECT,
      });
    });

    it('usesInote도 수정할 수 있다', async () => {
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        usesInote: true,
      });

      await service.updateMe('user-1', { usesInote: true });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { usesInote: true },
        select: USER_SELECT,
      });
    });
  });

  describe('setPassword', () => {
    it('better-auth에 새 비밀번호 설정을 위임한다', async () => {
      (setPasswordForSession as jest.Mock).mockResolvedValue(undefined);

      const result = await service.setPassword(
        { cookie: 'session=abc' },
        { newPassword: 'newpassword123' },
      );

      expect(setPasswordForSession).toHaveBeenCalledWith(
        { cookie: 'session=abc' },
        'newpassword123',
      );
      expect(result).toEqual({ success: true });
    });

    it('이미 비밀번호가 있으면 AuthActionError를 HttpException으로 변환한다', async () => {
      (setPasswordForSession as jest.Mock).mockRejectedValue(
        new AuthActionError(400, {
          message: 'User already has a password set',
          code: 'PASSWORD_ALREADY_SET',
        }),
      );

      await expect(
        service.setPassword({}, { newPassword: 'newpassword123' }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('deleteMe', () => {
    it('inote-ai 데이터 삭제 후 유저를 삭제하고 success:true를 반환한다', async () => {
      mockPrisma.user.delete.mockResolvedValue({ id: 'user-1' });

      const result = await service.deleteMe('user-1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions?user_id=user-1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(result).toEqual({ success: true });
    });

    it('inote-ai 호출이 실패해도 회원 탈퇴는 그대로 진행된다', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'));
      mockPrisma.user.delete.mockResolvedValue({ id: 'user-1' });

      const result = await service.deleteMe('user-1');

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(result).toEqual({ success: true });
    });

    it('inote-ai 응답이 실패(ok: false)여도 회원 탈퇴는 그대로 진행된다', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue({ ok: false, status: 500 } as Response);
      mockPrisma.user.delete.mockResolvedValue({ id: 'user-1' });

      const result = await service.deleteMe('user-1');

      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(result).toEqual({ success: true });
    });
  });
});
