import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ReadingLogsService } from './reading-logs.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReadingLogsService', () => {
  let service: ReadingLogsService;

  const mockPrisma = {
    readingLog: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    readingLogSummary: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          genre: '동화',
          synopsis: '줄거리',
          authorBio: '작가 소개',
        }),
    } as Response);

    const module = await Test.createTestingModule({
      providers: [
        ReadingLogsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(ReadingLogsService);
  });

  describe('findAll', () => {
    it('발행된 기록만 최신순으로 조회한다', async () => {
      mockPrisma.readingLog.findMany.mockResolvedValue([]);

      await service.findAll();

      expect(mockPrisma.readingLog.findMany).toHaveBeenCalledWith({
        where: { publishedAt: { not: null } },
        orderBy: { createdAt: 'desc' },
        include: { aiSummary: true },
      });
    });
  });

  describe('findMyDrafts', () => {
    it('그 유저의 draft만 최근 수정순으로 조회한다', async () => {
      mockPrisma.readingLog.findMany.mockResolvedValue([]);

      await service.findMyDrafts('u1');

      expect(mockPrisma.readingLog.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1', publishedAt: null },
        orderBy: { updatedAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('존재하지 않으면 NotFoundException', async () => {
      mockPrisma.readingLog.findUnique.mockResolvedValue(null);

      await expect(service.findOne('r1')).rejects.toThrow(NotFoundException);
    });

    it('발행된 기록은 누구나(비로그인 포함) 조회 가능', async () => {
      mockPrisma.readingLog.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'owner',
        publishedAt: new Date(),
      });

      const result = await service.findOne('r1', undefined);
      expect(result.id).toBe('r1');
    });

    it('draft는 작성자 본인이 아니면 NotFoundException (존재 자체를 숨김)', async () => {
      mockPrisma.readingLog.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'owner',
        publishedAt: null,
      });

      await expect(service.findOne('r1', 'other')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('draft는 작성자 본인이면 조회 가능', async () => {
      mockPrisma.readingLog.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'owner',
        publishedAt: null,
      });

      const result = await service.findOne('r1', 'owner');
      expect(result.id).toBe('r1');
    });
  });

  describe('createDraft', () => {
    it('제목 빈 값으로 draft를 생성한다', async () => {
      mockPrisma.readingLog.create.mockResolvedValue({ id: 'r1' });

      await service.createDraft('u1');

      expect(mockPrisma.readingLog.create).toHaveBeenCalledWith({
        data: { title: '', userId: 'u1' },
      });
    });
  });

  describe('update', () => {
    it('본인 글이 아니면 ForbiddenException', async () => {
      mockPrisma.readingLog.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'owner',
        publishedAt: null,
      });

      await expect(service.update('other', 'r1', {})).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.readingLog.update).not.toHaveBeenCalled();
    });

    it('publish 없이 수정하면 publishedAt을 안 건드린다', async () => {
      mockPrisma.readingLog.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        publishedAt: null,
      });
      mockPrisma.readingLog.update.mockResolvedValue({ id: 'r1' });

      await service.update('u1', 'r1', { title: '어린 왕자' });

      expect(mockPrisma.readingLog.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { title: '어린 왕자' },
        include: { aiSummary: true },
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('publish: true면 publishedAt을 지금 시각으로 채우고 책 정보를 생성한다 (처음 발행)', async () => {
      mockPrisma.readingLog.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        publishedAt: null,
      });
      mockPrisma.readingLog.update.mockResolvedValue({
        id: 'r1',
        title: '어린 왕자',
        author: '생텍쥐페리',
      });
      mockPrisma.readingLogSummary.upsert.mockResolvedValue({});

      await service.update('u1', 'r1', { title: '어린 왕자', publish: true });

      const call = mockPrisma.readingLog.update.mock.calls[0][0];
      expect(call.data.title).toBe('어린 왕자');
      expect(call.data.publishedAt).toBeInstanceOf(Date);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/book-info'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(mockPrisma.readingLogSummary.upsert).toHaveBeenCalledWith({
        where: { readingLogId: 'r1' },
        create: {
          readingLogId: 'r1',
          genre: '동화',
          synopsis: '줄거리',
          authorBio: '작가 소개',
        },
        update: { genre: '동화', synopsis: '줄거리', authorBio: '작가 소개' },
      });
    });

    it('이미 발행된 기록을 publish: true로 다시 저장해도 기존 publishedAt을 유지한다', async () => {
      const existing = new Date('2026-01-01');
      mockPrisma.readingLog.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        title: '어린 왕자',
        publishedAt: existing,
      });
      mockPrisma.readingLog.update.mockResolvedValue({
        id: 'r1',
        title: '어린 왕자',
        author: null,
      });
      mockPrisma.readingLogSummary.upsert.mockResolvedValue({});

      await service.update('u1', 'r1', { publish: true });

      expect(mockPrisma.readingLog.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { publishedAt: existing },
        include: { aiSummary: true },
      });
    });

    it('책 정보 생성 API 호출이 실패해도 update 자체는 성공한다 (fail-open)', async () => {
      mockPrisma.readingLog.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        publishedAt: null,
      });
      mockPrisma.readingLog.update.mockResolvedValue({
        id: 'r1',
        title: '어린 왕자',
        author: null,
      });
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('AI 서버 다운'));

      const result = await service.update('u1', 'r1', {
        title: '어린 왕자',
        publish: true,
      });

      expect(result).toEqual({
        id: 'r1',
        title: '어린 왕자',
        author: null,
      });
      expect(mockPrisma.readingLogSummary.upsert).not.toHaveBeenCalled();
    });

    it('title이 이번 요청에도 없고 기존 저장값도 빈 채로 publish: true면 BadRequestException', async () => {
      mockPrisma.readingLog.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        title: '',
        publishedAt: null,
      });

      await expect(
        service.update('u1', 'r1', { publish: true }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.readingLog.update).not.toHaveBeenCalled();
    });

    it('이번 요청에 title이 없어도, 기존에 이미 저장된 title이 있으면 publish 통과 (부분 수정 지원)', async () => {
      mockPrisma.readingLog.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        title: '어린 왕자',
        publishedAt: null,
      });
      mockPrisma.readingLog.update.mockResolvedValue({ id: 'r1' });

      await service.update('u1', 'r1', { publish: true });

      expect(mockPrisma.readingLog.update).toHaveBeenCalled();
    });

    it('startedAt/finishedAt은 문자열을 Date로 변환해서 저장한다', async () => {
      mockPrisma.readingLog.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        publishedAt: null,
      });
      mockPrisma.readingLog.update.mockResolvedValue({ id: 'r1' });

      await service.update('u1', 'r1', {
        startedAt: '2026-09-01',
        finishedAt: '2026-09-20',
      });

      const call = mockPrisma.readingLog.update.mock.calls[0][0];
      expect(call.data.startedAt).toBeInstanceOf(Date);
      expect(call.data.finishedAt).toBeInstanceOf(Date);
    });
  });

  describe('remove', () => {
    it('본인 글이 아니면 ForbiddenException', async () => {
      mockPrisma.readingLog.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'owner',
        publishedAt: null,
      });

      await expect(service.remove('other', 'r1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrisma.readingLog.delete).not.toHaveBeenCalled();
    });

    it('본인 글이면 삭제한다', async () => {
      mockPrisma.readingLog.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        publishedAt: null,
      });
      mockPrisma.readingLog.delete.mockResolvedValue({ id: 'r1' });

      const result = await service.remove('u1', 'r1');

      expect(mockPrisma.readingLog.delete).toHaveBeenCalledWith({
        where: { id: 'r1' },
      });
      expect(result).toEqual({ id: 'r1' });
    });
  });
});
