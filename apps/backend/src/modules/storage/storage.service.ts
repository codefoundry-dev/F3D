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
    // These are read WITHOUT local-dev fallbacks on purpose. In staging/prod the
    // S3_ENDPOINT and S3_ACCESS_KEY/S3_SECRET_KEY vars are intentionally unset so
    // the backend talks to real AWS S3 via the EC2 instance IAM role. Defaulting
    // them to MinIO/minioadmin made the client dial localhost:9000 (ECONNREFUSED)
    // and send bogus credentials on the server.
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const region = this.config.get<string>('S3_REGION', 'us-east-1');
    const accessKey = this.config.get<string>('S3_ACCESS_KEY');
    const secretKey = this.config.get<string>('S3_SECRET_KEY');
    const forcePathStyle =
      this.config.get<string>('S3_FORCE_PATH_STYLE', endpoint ? 'true' : 'false') === 'true';
    this.bucket = this.config.get<string>('S3_BUCKET', 'forethread-dev');

    this.client = new S3Client({
      region,
      // Custom endpoint only for MinIO/local dev; AWS uses its regional default.
      ...(endpoint ? { endpoint } : {}),
      // Static keys only for MinIO/local dev; otherwise the default AWS credential
      // provider chain resolves the EC2 instance IAM role.
      ...(accessKey && secretKey
        ? { credentials: { accessKeyId: accessKey, secretAccessKey: secretKey } }
        : {}),
      forcePathStyle,
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

  /**
   * Build a direct URL for a key in the bucket. For MinIO/local dev this is
   * `{endpoint}/{bucket}/{key}`; for AWS S3 it's the virtual-hosted-style URL.
   * NOTE: the staging/prod buckets block public access, so these URLs only load
   * if the object has a public-read policy — otherwise use {@link getSignedUrl}.
   */
  getPublicUrl(key: string): string {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    if (endpoint) {
      return `${endpoint}/${this.bucket}/${key}`;
    }
    const region = this.config.get<string>('S3_REGION', 'us-east-1');
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  getBucket(): string {
    return this.bucket;
  }
}
