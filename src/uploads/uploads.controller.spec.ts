import { Test } from '@nestjs/testing';
import { UploadsController } from './uploads.controller';
import { R2Service } from './r2.service';

// AuthGuard가 better-auth(순수 ESM)를 import해서 ts-jest 단위 테스트에서는 불러올 수 없다 — 가드는 이 테스트의 관심사가 아니라 대체한다
jest.mock('../auth/auth.guard', () => ({ AuthGuard: class {} }));

// POST /uploads/post-image — 글 이미지는 먼저 tmp에 올라간다.
// (크기·형식 검증은 ParseFilePipe가 컨트롤러 밖에서 하므로 여기서는 검증을 통과한 파일만 넘긴다.
//  5MB 초과·형식 불가는 E2E 또는 파이프 단독 테스트로 본다)
//
// 계약: 201 { url } — 키는 tmp/post/<userId>/<uuid>.<확장자>, 확장자는 파일명이 아니라 검증된 MIME에서 정한다
describe('UploadsController.uploadPostImage', () => {
  let controller: UploadsController;
  const mockR2 = { upload: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [{ provide: R2Service, useValue: mockR2 }],
    }).compile();
    controller = module.get(UploadsController);
  });

  const fileOf = (originalname: string, mimetype: string) =>
    ({
      originalname,
      mimetype,
      buffer: Buffer.from('x'),
    }) as Express.Multer.File;

  it('키는 tmp/post/<userId>/<uuid>.<확장자> 형태로 R2에 올린다', async () => {
    mockR2.upload.mockResolvedValue('https://cdn.example.com/k');
    const file = fileOf('a.png', 'image/png');

    await controller.uploadPostImage({ id: 'u1' }, file);

    expect(mockR2.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^tmp\/post\/u1\/[0-9a-f-]{36}\.png$/),
      file.buffer,
      'image/png',
    );
  });

  it('확장자는 MIME에서 정한다: jpeg→jpg, png→png, webp→webp, gif→gif', async () => {
    mockR2.upload.mockResolvedValue('https://cdn.example.com/k');
    const cases: [string, string][] = [
      ['image/jpeg', 'jpg'],
      ['image/png', 'png'],
      ['image/webp', 'webp'],
      ['image/gif', 'gif'],
    ];

    for (const [mime, ext] of cases) {
      await controller.uploadPostImage({ id: 'u1' }, fileOf('x', mime));
      const key = mockR2.upload.mock.calls.at(-1)?.[0] as string;
      expect(key.endsWith(`.${ext}`)).toBe(true);
    }
  });

  it('파일명이 evil.php여도 MIME이 image/png면 .png로 올라간다', async () => {
    mockR2.upload.mockResolvedValue('https://cdn.example.com/k');

    await controller.uploadPostImage(
      { id: 'u1' },
      fileOf('evil.php', 'image/png'),
    );

    const key = mockR2.upload.mock.calls[0][0] as string;
    expect(key).toMatch(/\.png$/);
    expect(key).not.toContain('php');
  });

  it('R2가 돌려준 공개 URL을 { url }로 응답한다', async () => {
    mockR2.upload.mockResolvedValue(
      'https://cdn.example.com/tmp/post/u1/x.png',
    );

    const result = await controller.uploadPostImage(
      { id: 'u1' },
      fileOf('a.png', 'image/png'),
    );

    expect(result).toEqual({
      url: 'https://cdn.example.com/tmp/post/u1/x.png',
    });
  });

  it('R2 업로드가 실패하면 예외를 그대로 던진다', async () => {
    mockR2.upload.mockRejectedValue(new Error('r2 down'));

    await expect(
      controller.uploadPostImage({ id: 'u1' }, fileOf('a.png', 'image/png')),
    ).rejects.toThrow('r2 down');
  });
});
