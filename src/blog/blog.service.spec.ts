import { Test } from '@nestjs/testing';
import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { BlogService } from './blog.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BlogService', () => {
  let service: BlogService;

  const mockPrisma = {
    post: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    postSummary: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ summary: ['요약1'] }),
    } as Response);

    const module = await Test.createTestingModule({
      providers: [
        BlogService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(BlogService);
  });

  describe('findAll', () => {
    it('발행된 글만 최신순으로 조회한다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith({
        where: { publishedAt: { not: null } },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      });
    });
  });

  describe('findMine', () => {
    it('발행 여부 상관없이 내가 쓴 글 전체를 최신순으로 조회한다', async () => {
      mockPrisma.post.findMany.mockResolvedValue([]);

      await service.findMine('user-1');

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      });
    });
  });

  describe('findOne', () => {
    it('존재하지 않으면 NotFoundException', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null);

      await expect(service.findOne('p1')).rejects.toThrow(NotFoundException);
    });

    it('발행된 글은 누구나 조회 가능하다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'owner',
        publishedAt: new Date('2026-09-01'),
      });

      const result = await service.findOne('p1', 'other-user');
      expect(result.id).toBe('p1');
    });

    it('draft는 작성자 본인이 아니면 NotFoundException (404로 존재 자체를 숨김)', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'owner',
        publishedAt: null,
      });

      await expect(service.findOne('p1', 'other-user')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('draft는 작성자 본인이면 조회 가능하다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'owner',
        publishedAt: null,
      });

      const result = await service.findOne('p1', 'owner');
      expect(result.id).toBe('p1');
    });
  });

  describe('getOwnerId', () => {
    it('글이 있으면 userId를 반환한다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'owner' });

      expect(await service.getOwnerId('p1')).toBe('owner');
    });

    it('글이 없으면 null을 반환한다 (예외를 던지지 않음)', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null);

      expect(await service.getOwnerId('missing')).toBeNull();
    });
  });

  describe('createDraft', () => {
    it('빈 값으로 draft 글을 생성한다', async () => {
      mockPrisma.post.create.mockResolvedValue({ id: 'p1' });

      await service.createDraft('user-1');

      expect(mockPrisma.post.create).toHaveBeenCalledWith({
        data: { title: '', content: '', category: '', userId: 'user-1' },
      });
    });
  });

  describe('update', () => {
    it('본인 글이 아니면 ForbiddenException', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'owner',
      });

      await expect(
        service.update('other-user', 'p1', { title: '수정' }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.post.update).not.toHaveBeenCalled();
    });

    it('publish: false면 내용만 갱신하고 publishedAt/요약은 건드리지 않는다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        publishedAt: null,
      });
      mockPrisma.post.update.mockResolvedValue({ id: 'p1', title: '임시저장' });

      await service.update('user-1', 'p1', { title: '임시저장' });

      expect(mockPrisma.post.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { title: '임시저장' },
        include: expect.any(Object),
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('publish: true + 처음 발행이면 publishedAt을 새로 설정하고 요약을 요청한다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        publishedAt: null,
      });
      mockPrisma.post.update.mockResolvedValue({
        id: 'p1',
        title: '제목',
        content: '본문',
      });
      mockPrisma.postSummary.upsert.mockResolvedValue({});

      await service.update('user-1', 'p1', {
        title: '제목',
        content: '본문',
        publish: true,
      });

      expect(mockPrisma.post.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { title: '제목', content: '본문', publishedAt: expect.any(Date) },
        include: expect.any(Object),
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/summarize'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(mockPrisma.postSummary.upsert).toHaveBeenCalledWith({
        where: { postId: 'p1' },
        create: { postId: 'p1', summary: ['요약1'] },
        update: { summary: ['요약1'] },
      });
    });

    it('이미 발행된 글이면 기존 publishedAt을 그대로 유지한다', async () => {
      const existingPublishedAt = new Date('2026-01-01');
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        publishedAt: existingPublishedAt,
      });
      mockPrisma.post.update.mockResolvedValue({
        id: 'p1',
        title: '제목',
        content: '본문',
      });

      await service.update('user-1', 'p1', {
        title: '제목',
        content: '본문',
        publish: true,
      });

      expect(mockPrisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ publishedAt: existingPublishedAt }),
        }),
      );
    });

    it('내용이 비어 있으면 발행이어도 요약을 요청하지 않는다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        publishedAt: null,
      });
      mockPrisma.post.update.mockResolvedValue({
        id: 'p1',
        title: '',
        content: '<p></p>',
      });

      await service.update('user-1', 'p1', {
        title: '',
        content: '<p></p>',
        publish: true,
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('요약 API 호출이 실패해도 update 자체는 성공한다 (fail-open)', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        publishedAt: null,
      });
      mockPrisma.post.update.mockResolvedValue({
        id: 'p1',
        title: '제목',
        content: '본문',
      });
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('AI 서버 다운'));

      const result = await service.update('user-1', 'p1', {
        title: '제목',
        content: '본문',
        publish: true,
      });

      expect(result).toEqual({ id: 'p1', title: '제목', content: '본문' });
    });
  });

  describe('remove', () => {
    it('본인 글이 아니면 ForbiddenException', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'owner',
      });

      await expect(service.remove('other-user', 'p1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.post.delete).not.toHaveBeenCalled();
    });

    it('본인 글이면 삭제하고 inote-ai 세션 삭제도 요청한다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
      });
      mockPrisma.post.delete.mockResolvedValue({ id: 'p1' });

      await service.remove('user-1', 'p1');

      expect(mockPrisma.post.delete).toHaveBeenCalledWith({
        where: { id: 'p1' },
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions/p1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('inote-ai 세션 삭제가 실패해도 글 삭제 결과는 그대로 반환한다', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
      });
      mockPrisma.post.delete.mockResolvedValue({ id: 'p1' });
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('AI 서버 다운'));

      const result = await service.remove('user-1', 'p1');

      expect(result).toEqual({ id: 'p1' });
    });
  });
});
