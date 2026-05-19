/* eslint-disable @typescript-eslint/no-unsafe-assignment */
const mockSend = jest.fn().mockResolvedValue({});
const mockGetSignedUrl = jest.fn().mockResolvedValue('https://signed.url/key');

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'Put' })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'Delete' })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ ...input, _type: 'Get' })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

import { StorageService } from './storage.service';

const mockConfig = {
  get: jest.fn().mockImplementation((key: string, fallback?: string) => {
    const map: Record<string, string> = {
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY: 'minioadmin',
      S3_SECRET_KEY: 'minioadmin',
      S3_BUCKET: 'test-bucket',
    };
    return map[key] ?? fallback;
  }),
};

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StorageService(mockConfig as never);
    service.onModuleInit();
  });

  describe('onModuleInit', () => {
    it('initializes S3 client and sets bucket', () => {
      // S3Client constructor was called
      const { S3Client } = jest.requireMock('@aws-sdk/client-s3');
      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'http://localhost:9000',
          region: 'us-east-1',
          forcePathStyle: true,
        }),
      );
      expect(service.getBucket()).toBe('test-bucket');
    });
  });

  describe('upload', () => {
    it('sends PutObjectCommand and returns bucket + key', async () => {
      const result = await service.upload('test/key.pdf', Buffer.from('data'), 'application/pdf');

      const { PutObjectCommand } = jest.requireMock('@aws-sdk/client-s3');
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test/key.pdf',
        Body: expect.any(Buffer),
        ContentType: 'application/pdf',
      });
      expect(mockSend).toHaveBeenCalled();
      expect(result).toEqual({ bucket: 'test-bucket', key: 'test/key.pdf' });
    });
  });

  describe('delete', () => {
    it('sends DeleteObjectCommand', async () => {
      await service.delete('test/key.pdf');

      const { DeleteObjectCommand } = jest.requireMock('@aws-sdk/client-s3');
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test/key.pdf',
      });
      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('getSignedUrl', () => {
    it('creates GetObjectCommand and returns signed URL', async () => {
      const url = await service.getSignedUrl('test/key.pdf', 7200);

      const { GetObjectCommand } = jest.requireMock('@aws-sdk/client-s3');
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test/key.pdf',
      });
      expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
        expiresIn: 7200,
      });
      expect(url).toBe('https://signed.url/key');
    });

    it('uses default expiry of 3600 seconds', async () => {
      await service.getSignedUrl('test/key.pdf');
      expect(mockGetSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
        expiresIn: 3600,
      });
    });
  });

  describe('getObject', () => {
    it('returns body buffer and content type when Body exists', async () => {
      const fakeBytes = new Uint8Array([0x50, 0x44, 0x46]);
      mockSend.mockResolvedValueOnce({
        Body: { transformToByteArray: jest.fn().mockResolvedValue(fakeBytes) },
        ContentType: 'application/pdf',
      });

      const result = await service.getObject('test/key.pdf');

      expect(result.body).toBeInstanceOf(Buffer);
      expect(result.body).toEqual(Buffer.from(fakeBytes));
      expect(result.contentType).toBe('application/pdf');

      const { GetObjectCommand } = jest.requireMock('@aws-sdk/client-s3');
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test/key.pdf',
      });
    });

    it('returns null body when Body is undefined', async () => {
      mockSend.mockResolvedValueOnce({
        Body: undefined,
        ContentType: undefined,
      });

      const result = await service.getObject('test/missing.pdf');

      expect(result.body).toBeNull();
      expect(result.contentType).toBeUndefined();
    });

    it('returns null body when transformToByteArray returns undefined', async () => {
      mockSend.mockResolvedValueOnce({
        Body: { transformToByteArray: jest.fn().mockResolvedValue(undefined) },
        ContentType: 'text/plain',
      });

      const result = await service.getObject('test/empty.txt');

      expect(result.body).toBeNull();
      expect(result.contentType).toBe('text/plain');
    });
  });

  describe('uploadBuffer', () => {
    it('uploads with folder prefix when folder is provided', async () => {
      const buffer = Buffer.from('test-data');
      const result = await service.uploadBuffer({
        buffer,
        filename: 'report.pdf',
        contentType: 'application/pdf',
        folder: 'exports',
      });

      const { PutObjectCommand } = jest.requireMock('@aws-sdk/client-s3');
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: 'exports/report.pdf',
          ContentType: 'application/pdf',
        }),
      );
      expect(result).toEqual({ bucket: 'test-bucket', key: 'exports/report.pdf' });
    });

    it('uploads without folder prefix when folder is not provided', async () => {
      const buffer = Buffer.from('test-data');
      const result = await service.uploadBuffer({
        buffer,
        filename: 'report.pdf',
        contentType: 'application/pdf',
      });

      const { PutObjectCommand } = jest.requireMock('@aws-sdk/client-s3');
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: 'report.pdf',
        }),
      );
      expect(result).toEqual({ bucket: 'test-bucket', key: 'report.pdf' });
    });
  });

  describe('getPublicUrl', () => {
    it('constructs public URL from endpoint, bucket, and key', () => {
      const url = service.getPublicUrl('uploads/photo.jpg');

      expect(url).toBe('http://localhost:9000/test-bucket/uploads/photo.jpg');
    });

    it('handles keys without folder prefix', () => {
      const url = service.getPublicUrl('photo.jpg');

      expect(url).toBe('http://localhost:9000/test-bucket/photo.jpg');
    });
  });

  describe('getBucket', () => {
    it('returns the configured bucket name', () => {
      expect(service.getBucket()).toBe('test-bucket');
    });
  });
});
