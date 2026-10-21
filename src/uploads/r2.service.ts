import { Injectable } from '@nestjs/common';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

// Cloudflare R2는 S3 호환 API라 AWS SDK의 S3Client를 그대로 씀 — endpoint만 R2로 바꿔줌.
//
// R2_KEY_PREFIX(예: "dev")가 있으면 모든 키 앞에 붙인다 — 개발용 BE가 운영과 같은 버킷을 쓰면서도 `dev/` 아래에서만
// 읽고 쓰게 하려는 것(scripts/dev-db.sh start가 주입). 없으면(운영) 키 그대로다.
// 호출하는 쪽은 접두어를 모르는 키(`tmp/post/…`)만 다루고, 공개 주소가 필요하면 publicBaseUrl()을 쓴다.
@Injectable()
export class R2Service {
  private readonly client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CF_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.CF_SECRET_ACCESS_KEY ?? '',
    },
  });

  // 접두어는 "dev" 한 겹으로 정리한다 (앞뒤 슬래시 제거). 없으면 빈 문자열.
  private prefix(): string {
    return (process.env.R2_KEY_PREFIX ?? '').replace(/^\/+|\/+$/g, '');
  }

  private fullKey(key: string): string {
    const prefix = this.prefix();
    return prefix ? `${prefix}/${key}` : key;
  }

  // 키 앞에 붙여 공개 URL을 만드는 기준 주소 — `<공개URL>[/<접두어>]`
  publicBaseUrl(): string {
    const prefix = this.prefix();
    const base = process.env.CF_R2_PUBLIC_URL ?? '';
    return prefix ? `${base}/${prefix}` : base;
  }

  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: process.env.CF_R2_BUCKET,
        Key: this.fullKey(key),
        Body: body,
        ContentType: contentType,
      }),
    );
    return `${this.publicBaseUrl()}/${key}`;
  }

  // S3 API에는 "이동"이 없어서 tmp → 영구 승격은 복사 + (성공 뒤) 삭제로 한다.
  // 키는 서버가 만든 값(uuid·허용 확장자)만 들어오므로 CopySource를 따로 인코딩하지 않는다.
  async copy(fromKey: string, toKey: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: process.env.CF_R2_BUCKET,
        CopySource: `${process.env.CF_R2_BUCKET}/${this.fullKey(fromKey)}`,
        Key: this.fullKey(toKey),
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: process.env.CF_R2_BUCKET,
        Key: this.fullKey(key),
      }),
    );
  }

  // 접두어(폴더) 아래 객체를 전부 지운다 — 글을 지울 때 post/<userId>/<postId>/ 를 한 번에.
  // 실수로 버킷 전체를 지우지 않도록 비었거나 "/"로 끝나지 않는 접두어는 거절한다.
  async deletePrefix(keyPrefix: string): Promise<void> {
    if (!keyPrefix || !keyPrefix.endsWith('/')) {
      throw new Error(
        `deletePrefix needs a folder prefix ending with "/": "${keyPrefix}"`,
      );
    }
    const Prefix = this.fullKey(keyPrefix);
    let ContinuationToken: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: process.env.CF_R2_BUCKET,
          Prefix,
          ContinuationToken,
        }),
      );
      const objects = (page.Contents ?? []).flatMap((o) =>
        o.Key ? [{ Key: o.Key }] : [],
      );
      if (objects.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: process.env.CF_R2_BUCKET,
            Delete: { Objects: objects },
          }),
        );
      }
      ContinuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
    } while (ContinuationToken);
  }
}
