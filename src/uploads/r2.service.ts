import { Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

// Cloudflare R2는 S3 호환 API라 AWS SDK의 S3Client를 그대로 씀 — endpoint만 R2로 바꿔줌.
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

  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: process.env.CF_R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return `${process.env.CF_R2_PUBLIC_URL}/${key}`;
  }
}
