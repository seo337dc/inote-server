import { Test } from '@nestjs/testing';
import { ForbiddenException, Logger } from '@nestjs/common';
import { BlogService } from './blog.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../uploads/r2.service';

// BlogService.update — 저장(publish: true)할 때 본문의 tmp 이미지를 영구 위치로 옮기는 동작.
// 기존 blog.service.spec.ts와 따로 둔 이유: R2 mock이 필요한 시나리오만 모아 setup을 단순하게 하려고.
//
// 계약 (docs/EDITOR_IMAGE_UPLOAD.md 5절)
//  - publish: true 일 때만 승격한다. 임시저장(publish 없음)은 content를 그대로 저장
//  - 내 tmp 주소만: tmp/post/<요청자 userId>/<uuid>.<ext> → post/<userId>/<postId>/<uuid>.<ext>
//  - 복사 실패는 저장을 막지 않는다(fail-open): 그 이미지는 tmp 주소 그대로 두고 경고 로그
//  - 복사에 성공한 것만 tmp 원본 삭제 — 그리고 DB 저장이 성공한 뒤에 (저장이 실패하면 원본을 지우면 안 된다)
//
// 사용할 R2Service 메서드 (구현은 테스트가 채워진 뒤에 한다)
//   copy(fromKey: string, toKey: string): Promise<void>
//   delete(key: string): Promise<void>
describe('BlogService.update — 이미지 승격', () => {
  let service: BlogService;
  let warn: jest.SpyInstance;

  const mockPrisma = {
    post: { findUnique: jest.fn(), update: jest.fn() },
    postCategory: { findMany: jest.fn(), findUnique: jest.fn() },
    postSummary: { upsert: jest.fn() },
  };
  const mockR2 = { copy: jest.fn(), delete: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    process.env.CF_R2_PUBLIC_URL = 'https://cdn.example.com';
    // 요약 호출(fetch)은 이 테스트의 관심사가 아니라 성공으로 막아 둔다
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ summary: ['요약'] }),
    } as Response);

    const module = await Test.createTestingModule({
      providers: [
        BlogService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: R2Service, useValue: mockR2 },
      ],
    }).compile();
    service = module.get(BlogService);
  });

  const PUBLIC = 'https://cdn.example.com';
  const UUID_A = '11111111-1111-4111-8111-111111111111';
  const UUID_B = '22222222-2222-4222-8222-222222222222';
  const tmp = (uuid: string, userId = 'u1') =>
    `${PUBLIC}/tmp/post/${userId}/${uuid}.png`;
  const perm = (uuid: string) => `${PUBLIC}/post/u1/p1/${uuid}.png`;
  const img = (src: string) => `<img src="${src}" style="width: 60%">`;

  // 내 글(u1/p1)이 DB에 있고, update는 저장하라고 받은 data를 그대로 돌려준다
  function arrangeOwnPost(existingContent = '') {
    mockPrisma.post.findUnique.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      title: '제목',
      content: existingContent,
      publishedAt: null,
    });
    mockPrisma.post.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'p1', title: '제목', content: '', ...data }),
    );
    mockR2.copy.mockResolvedValue(undefined);
    mockR2.delete.mockResolvedValue(undefined);
  }
  const savedContent = () =>
    (
      mockPrisma.post.update.mock.calls[0][0] as {
        data: { content: string };
      }
    ).data.content;

  it('publish: true면 내 tmp 이미지를 copy(tmp키 → post/<userId>/<postId>/…)하고 content의 src를 바꿔 저장한다', async () => {
    arrangeOwnPost();

    await service.update('u1', 'p1', {
      content: `<p>글</p>${img(tmp(UUID_A))}`,
      publish: true,
    });

    expect(mockR2.copy).toHaveBeenCalledWith(
      `tmp/post/u1/${UUID_A}.png`,
      `post/u1/p1/${UUID_A}.png`,
    );
    expect(savedContent()).toBe(`<p>글</p>${img(perm(UUID_A))}`);
    expect(mockR2.delete).toHaveBeenCalledWith(`tmp/post/u1/${UUID_A}.png`);
  });

  it('publish가 없으면(자동저장) copy·delete를 부르지 않고 content를 그대로 저장한다', async () => {
    arrangeOwnPost();
    const content = img(tmp(UUID_A));

    await service.update('u1', 'p1', { content });

    expect(mockR2.copy).not.toHaveBeenCalled();
    expect(mockR2.delete).not.toHaveBeenCalled();
    expect(savedContent()).toBe(content);
  });

  it('남의 tmp·외부 URL·이미 post/ 주소는 copy하지 않고 content에서도 그대로 둔다', async () => {
    arrangeOwnPost();
    const content =
      img(tmp(UUID_A, 'u2')) +
      img('https://other.com/a.png') +
      img(perm(UUID_B));

    await service.update('u1', 'p1', { content, publish: true });

    expect(mockR2.copy).not.toHaveBeenCalled();
    expect(mockR2.delete).not.toHaveBeenCalled();
    expect(savedContent()).toBe(content);
  });

  it('같은 이미지가 여러 번 있어도 copy는 한 번, 모든 src가 바뀐다', async () => {
    arrangeOwnPost();

    await service.update('u1', 'p1', {
      content: img(tmp(UUID_A)) + img(tmp(UUID_A)),
      publish: true,
    });

    expect(mockR2.copy).toHaveBeenCalledTimes(1);
    expect(savedContent()).toBe(img(perm(UUID_A)) + img(perm(UUID_A)));
  });

  it('copy가 실패한 이미지는 tmp 주소 그대로 저장하고(저장은 성공), warn 로그를 남기고, 그 원본은 delete하지 않는다', async () => {
    arrangeOwnPost();
    mockR2.copy.mockRejectedValue(new Error('r2 down'));
    const content = img(tmp(UUID_A));

    await expect(
      service.update('u1', 'p1', { content, publish: true }),
    ).resolves.toBeDefined();

    expect(savedContent()).toBe(content);
    expect(mockR2.delete).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it('여러 장 중 일부만 copy 실패하면 성공한 것만 바뀌고 삭제된다', async () => {
    arrangeOwnPost();
    mockR2.copy.mockImplementation((from: string) =>
      from.includes(UUID_B)
        ? Promise.reject(new Error('fail'))
        : Promise.resolve(),
    );

    await service.update('u1', 'p1', {
      content: img(tmp(UUID_A)) + img(tmp(UUID_B)),
      publish: true,
    });

    expect(savedContent()).toBe(img(perm(UUID_A)) + img(tmp(UUID_B)));
    expect(mockR2.delete).toHaveBeenCalledTimes(1);
    expect(mockR2.delete).toHaveBeenCalledWith(`tmp/post/u1/${UUID_A}.png`);
  });

  it('DB 저장(prisma.post.update)이 실패하면 tmp 원본을 delete하지 않는다', async () => {
    arrangeOwnPost();
    mockPrisma.post.update.mockRejectedValue(new Error('db down'));

    await expect(
      service.update('u1', 'p1', {
        content: img(tmp(UUID_A)),
        publish: true,
      }),
    ).rejects.toThrow('db down');

    expect(mockR2.delete).not.toHaveBeenCalled();
  });

  it('delete가 실패해도 저장은 성공하고 warn 로그만 남는다', async () => {
    arrangeOwnPost();
    mockR2.delete.mockRejectedValue(new Error('r2 down'));

    await expect(
      service.update('u1', 'p1', {
        content: img(tmp(UUID_A)),
        publish: true,
      }),
    ).resolves.toBeDefined();

    expect(warn).toHaveBeenCalled();
  });

  it('publish: true인데 dto에 content가 없으면 DB에 있는 기존 content를 기준으로 승격한다', async () => {
    arrangeOwnPost(img(tmp(UUID_A)));

    await service.update('u1', 'p1', { publish: true });

    expect(mockR2.copy).toHaveBeenCalledTimes(1);
    expect(savedContent()).toBe(img(perm(UUID_A)));
  });

  it('본인 글이 아니면 ForbiddenException이고 R2를 건드리지 않는다', async () => {
    arrangeOwnPost();

    await expect(
      service.update('u2', 'p1', {
        content: img(tmp(UUID_A, 'u2')),
        publish: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mockR2.copy).not.toHaveBeenCalled();
    expect(mockR2.delete).not.toHaveBeenCalled();
  });
});
