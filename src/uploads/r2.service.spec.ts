import { R2Service } from './r2.service';

// AWS SDK를 가짜로 바꿔 어떤 명령이 어떤 인자로 나가는지만 본다 (R2에는 연결하지 않는다).
// 명령 객체는 { name, input }으로 기록한다.
const send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  const command = (name: string) =>
    class {
      readonly name = name;
      constructor(readonly input: Record<string, unknown>) {}
    };
  return {
    S3Client: class {
      send = send;
    },
    PutObjectCommand: command('Put'),
    CopyObjectCommand: command('Copy'),
    DeleteObjectCommand: command('Delete'),
    DeleteObjectsCommand: command('DeleteMany'),
    ListObjectsV2Command: command('List'),
  };
});

type Sent = { name: string; input: Record<string, unknown> };
const sentCommands = () => send.mock.calls.map((c) => c[0] as Sent);

describe('R2Service', () => {
  let service: R2Service;

  beforeEach(() => {
    jest.clearAllMocks();
    send.mockResolvedValue({});
    process.env.CF_R2_BUCKET = 'bucket';
    process.env.CF_R2_PUBLIC_URL = 'https://cdn.example.com';
    delete process.env.R2_KEY_PREFIX;
    service = new R2Service();
  });

  afterAll(() => {
    delete process.env.R2_KEY_PREFIX;
  });

  describe('R2_KEY_PREFIX가 없을 때 (운영)', () => {
    it('publicBaseUrl은 공개 URL 그대로다', () => {
      expect(service.publicBaseUrl()).toBe('https://cdn.example.com');
    });

    it('upload는 키 그대로 올리고 <공개URL>/<키>를 돌려준다', async () => {
      const url = await service.upload(
        'tmp/post/u1/a.png',
        Buffer.from('x'),
        'image/png',
      );

      expect(sentCommands()[0].input).toMatchObject({
        Bucket: 'bucket',
        Key: 'tmp/post/u1/a.png',
      });
      expect(url).toBe('https://cdn.example.com/tmp/post/u1/a.png');
    });
  });

  describe('R2_KEY_PREFIX=dev 일 때 (로컬)', () => {
    beforeEach(() => {
      process.env.R2_KEY_PREFIX = 'dev';
    });

    it('publicBaseUrl에 접두어가 붙는다', () => {
      expect(service.publicBaseUrl()).toBe('https://cdn.example.com/dev');
    });

    it('upload는 dev/ 아래에 올리고 URL에도 dev/가 들어간다', async () => {
      const url = await service.upload(
        'tmp/post/u1/a.png',
        Buffer.from('x'),
        'image/png',
      );

      expect(sentCommands()[0].input).toMatchObject({
        Key: 'dev/tmp/post/u1/a.png',
      });
      expect(url).toBe('https://cdn.example.com/dev/tmp/post/u1/a.png');
    });

    it('copy는 원본·대상 키 모두 dev/ 아래로 가리킨다', async () => {
      await service.copy('tmp/post/u1/a.png', 'post/u1/p1/a.png');

      expect(sentCommands()[0].input).toMatchObject({
        CopySource: 'bucket/dev/tmp/post/u1/a.png',
        Key: 'dev/post/u1/p1/a.png',
      });
    });

    it('delete는 dev/ 아래 키를 지운다', async () => {
      await service.delete('tmp/post/u1/a.png');

      expect(sentCommands()[0].input).toMatchObject({
        Key: 'dev/tmp/post/u1/a.png',
      });
    });

    it('앞뒤 슬래시가 있어도 한 겹으로 정리한다 ("/dev/" → dev)', async () => {
      process.env.R2_KEY_PREFIX = '/dev/';

      expect(service.publicBaseUrl()).toBe('https://cdn.example.com/dev');
      await service.delete('a.png');
      expect(sentCommands()[0].input).toMatchObject({ Key: 'dev/a.png' });
    });
  });

  describe('deletePrefix', () => {
    it('접두어 아래 객체를 나열해 한 번에 지운다 (접두어 설정이 있으면 그 아래에서만)', async () => {
      process.env.R2_KEY_PREFIX = 'dev';
      send
        .mockResolvedValueOnce({
          Contents: [
            { Key: 'dev/post/u1/p1/a.png' },
            { Key: 'dev/post/u1/p1/b.png' },
          ],
          IsTruncated: false,
        })
        .mockResolvedValueOnce({});

      await service.deletePrefix('post/u1/p1/');

      const [list, del] = sentCommands();
      expect(list.name).toBe('List');
      expect(list.input).toMatchObject({ Prefix: 'dev/post/u1/p1/' });
      expect(del.name).toBe('DeleteMany');
      expect(del.input).toMatchObject({
        Delete: {
          Objects: [
            { Key: 'dev/post/u1/p1/a.png' },
            { Key: 'dev/post/u1/p1/b.png' },
          ],
        },
      });
    });

    it('목록이 여러 페이지면 끝까지 따라가며 지운다', async () => {
      send
        .mockResolvedValueOnce({
          Contents: [{ Key: 'post/u1/p1/a.png' }],
          IsTruncated: true,
          NextContinuationToken: 'T',
        })
        .mockResolvedValueOnce({}) // 첫 페이지 삭제
        .mockResolvedValueOnce({
          Contents: [{ Key: 'post/u1/p1/b.png' }],
          IsTruncated: false,
        })
        .mockResolvedValueOnce({}); // 둘째 페이지 삭제

      await service.deletePrefix('post/u1/p1/');

      const lists = sentCommands().filter((c) => c.name === 'List');
      expect(lists).toHaveLength(2);
      expect(lists[1].input).toMatchObject({ ContinuationToken: 'T' });
      expect(
        sentCommands().filter((c) => c.name === 'DeleteMany'),
      ).toHaveLength(2);
    });

    it('나열된 것이 없으면 삭제 요청을 보내지 않는다', async () => {
      send.mockResolvedValueOnce({ Contents: undefined, IsTruncated: false });

      await service.deletePrefix('post/u1/p1/');

      expect(sentCommands().map((c) => c.name)).toEqual(['List']);
    });

    it('접두어가 비었거나 "/"로 끝나지 않으면 아무것도 하지 않고 던진다 (버킷 통째 삭제 방지)', async () => {
      await expect(service.deletePrefix('')).rejects.toThrow();
      await expect(service.deletePrefix('post/u1')).rejects.toThrow();
      expect(send).not.toHaveBeenCalled();
    });
  });
});
