import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService implements OnModuleInit {
  private client!: S3Client;
  private bucket!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const endpoint = this.config.get<string>('S3_ENDPOINT', 'http://localhost:9000');
    const region = this.config.get<string>('S3_REGION', 'us-east-1');
    const accessKey = this.config.get<string>('S3_ACCESS_KEY', 'minioadmin');
    const secretKey = this.config.get<string>('S3_SECRET_KEY', 'minioadmin');
    this.bucket = this.config.get<string>('S3_BUCKET', 'forethread-dev');

    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true, // Required for MinIO
    });
  }

  async upload(
    key: string,
    body: Buffer,
    mimeType: string,
  ): Promise<{ bucket: string; key: string }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
      }),
    );

    return { bucket: this.bucket, key };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async getObject(key: string): Promise<{ body: Buffer | null; contentType?: string }> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const response = await this.client.send(command);
    const bytes = await response.Body?.transformToByteArray();
    return {
      body: bytes ? Buffer.from(bytes) : null,
      contentType: response.ContentType,
    };
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async uploadBuffer(params: {
    buffer: Buffer;
    filename: string;
    contentType: string;
    folder?: string;
  }): Promise<{ bucket: string; key: string }> {
    const key = params.folder ? `${params.folder}/${params.filename}` : params.filename;

    return this.upload(key, params.buffer, params.contentType);
  }

  /** Build public URL for a key in the bucket (bucket must have public-read policy). */
  getPublicUrl(key: string): string {
    const endpoint = this.config.get<string>('S3_ENDPOINT', 'http://localhost:9000');
    return `${endpoint}/${this.bucket}/${key}`;
  }

  getBucket(): string {
    return this.bucket;
  }
}
