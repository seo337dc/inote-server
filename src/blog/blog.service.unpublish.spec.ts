import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BlogService } from './blog.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../uploads/r2.service';

// 글을 임시저장으로 되돌리기 — 계약: inote 레포 docs/todo/post-unpublish.md
//  - 본인 글만 (남의 글 403, 없는 글 404)
//  - 보관한 글은 409 (먼저 보관 해제)
//  - 발행일·마지막 수정일을 비우고 고정을 푼다. 나머지(카테고리·비공개·썸네일·요약 등)는 건드리지 않는다
//  - 이미 임시저장인 글은 그대로 성공(멱등) — 저장 데이터는 같고 오류 없이 글을 돌려준다
//  - 응답은 PATCH와 같은 글 상세 모양(DETAIL_INCLUDE)
describe('BlogService — unpublish', () => {
  let service: BlogService;

  const mockPrisma = {
    post: { findUnique: jest.fn(), update: jest.fn() },
  };

  const publishedPost = {
    id: 'p1',
    userId: 'u1',
    title: '제목',
    content: '<p>본문</p>',
    publishedAt: new Date('2026-09-01'),
    lastEditedAt: new Date('2026-10-01'),
    archivedAt: null,
    pinned: true,
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    mockPrisma.post.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...publishedPost, ...data }),
    );

    const module = await Test.createTestingModule({
      providers: [
        BlogService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: R2Service, useValue: {} },
      ],
    }).compile();
    service = module.get(BlogService);
  });

  it('발행일과 마지막 수정일을 비우고 고정을 푼다 — 그 세 필드만 바꾼다', async () => {
    mockPrisma.post.findUnique.mockResolvedValue(publishedPost);

    await service.unpublish('u1', 'p1');

    expect(mockPrisma.post.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { publishedAt: null, lastEditedAt: null, pinned: false },
      include: expect.objectContaining({
        user: expect.anything(),
        aiSummary: expect.anything(),
      }),
    });
  });

  it('바뀐 글을 돌려준다 (publishedAt이 null)', async () => {
    mockPrisma.post.findUnique.mockResolvedValue(publishedPost);

    const result = await service.unpublish('u1', 'p1');

    expect(result.id).toBe('p1');
    expect(result.publishedAt).toBeNull();
    expect(result.pinned).toBe(false);
  });

  it('비공개 설정·카테고리·썸네일을 저장 데이터에 넣지 않는다 (그대로 남는다)', async () => {
    mockPrisma.post.findUnique.mockResolvedValue(publishedPost);

    await service.unpublish('u1', 'p1');

    const { data } = mockPrisma.post.update.mock.calls[0][0];
    for (const key of [
      'isPrivate',
      'category',
      'categoryId',
      'thumbnail',
      'archivedAt',
    ]) {
      expect(data).not.toHaveProperty(key);
    }
  });

  it('남의 글이면 403이고 저장하지 않는다', async () => {
    mockPrisma.post.findUnique.mockResolvedValue(publishedPost);

    await expect(service.unpublish('other', 'p1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(mockPrisma.post.update).not.toHaveBeenCalled();
  });

  it('없는 글이면 404다', async () => {
    mockPrisma.post.findUnique.mockResolvedValue(null);

    await expect(service.unpublish('u1', 'nope')).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.post.update).not.toHaveBeenCalled();
  });

  it('보관한 글이면 409이고 저장하지 않는다 (먼저 보관 해제)', async () => {
    mockPrisma.post.findUnique.mockResolvedValue({
      ...publishedPost,
      archivedAt: new Date('2026-10-20'),
    });

    await expect(service.unpublish('u1', 'p1')).rejects.toThrow(
      ConflictException,
    );
    expect(mockPrisma.post.update).not.toHaveBeenCalled();
  });

  it('이미 임시저장인 글도 오류 없이 성공한다 (멱등)', async () => {
    mockPrisma.post.findUnique.mockResolvedValue({
      ...publishedPost,
      publishedAt: null,
      lastEditedAt: null,
      pinned: false,
    });

    const result = await service.unpublish('u1', 'p1');

    expect(result.publishedAt).toBeNull();
  });

  it('남의 임시저장 글도 403이다 (멱등 처리가 소유 확인보다 앞서지 않는다)', async () => {
    mockPrisma.post.findUnique.mockResolvedValue({
      ...publishedPost,
      publishedAt: null,
    });

    await expect(service.unpublish('other', 'p1')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
