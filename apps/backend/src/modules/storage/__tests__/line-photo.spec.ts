import { BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { LinePhotoService } from '../line-photo.service';
import { signLinePhotoUrls } from '../line-photo.util';
import { StorageService } from '../storage.service';

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    originalname: 'bracket.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('x'),
    ...overrides,
  } as Express.Multer.File;
}

function makeService() {
  const storage = {
    upload: jest.fn((key: string) => Promise.resolve({ bucket: 'b', key })),
    getSignedUrl: jest.fn((key: string) => Promise.resolve(`https://signed.example/${key}`)),
  };
  const prisma = {
    file: {
      create: jest.fn(({ data }: { data: { key: string; filename: string } }) =>
        Promise.resolve({ id: 'file-1', filename: data.filename, key: data.key }),
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const service = new LinePhotoService(
    storage as unknown as StorageService,
    prisma as unknown as PrismaService,
  );
  return { service, storage, prisma };
}

describe('LinePhotoService (FOR-404)', () => {
  describe('upload', () => {
    it('stores the image under the uploader and returns its file id with a preview URL', async () => {
      const { service, storage, prisma } = makeService();

      const result = await service.upload(makeFile(), 'user-1');

      const key = storage.upload.mock.calls[0][0];
      expect(key).toMatch(/^line-photos\/user-1\/[0-9a-f-]+\.jpg$/);
      expect(prisma.file.create.mock.calls[0][0].data).toMatchObject({
        key,
        filename: 'bracket.jpg',
        mimeType: 'image/jpeg',
        uploadedById: 'user-1',
      });
      expect(result).toEqual({
        fileId: 'file-1',
        fileName: 'bracket.jpg',
        url: `https://signed.example/${key}`,
      });
    });

    it('still succeeds when the preview URL cannot be signed', async () => {
      const { service, storage } = makeService();
      storage.getSignedUrl.mockRejectedValue(new Error('down'));
      await expect(service.upload(makeFile(), 'user-1')).resolves.toMatchObject({
        fileId: 'file-1',
        url: null,
      });
    });

    it.each([
      ['no file', undefined],
      ['a PDF', makeFile({ mimetype: 'application/pdf', originalname: 'a.pdf' })],
      ['an SVG', makeFile({ mimetype: 'image/svg+xml', originalname: 'a.svg' })],
      ['a file over 10 MB', makeFile({ size: 10 * 1024 * 1024 + 1 })],
    ])('rejects %s without storing anything', async (_label, file) => {
      const { service, storage, prisma } = makeService();
      await expect(service.upload(file, 'user-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.upload).not.toHaveBeenCalled();
      expect(prisma.file.create).not.toHaveBeenCalled();
    });
  });

  describe('assertOwnedPhotos', () => {
    it('does nothing when no line carries a photo', async () => {
      const { service, prisma } = makeService();
      await service.assertOwnedPhotos([undefined, null], 'user-1');
      expect(prisma.file.findMany).not.toHaveBeenCalled();
    });

    it("looks the ids up as the caller's own line photos, de-duplicated", async () => {
      const { service, prisma } = makeService();
      prisma.file.findMany.mockResolvedValue([{ id: 'f1' }, { id: 'f2' }]);

      await service.assertOwnedPhotos(['f1', 'f2', 'f1', undefined], 'user-1');

      expect(prisma.file.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['f1', 'f2'] },
          uploadedById: 'user-1',
          key: { startsWith: 'line-photos/' },
        },
        select: { id: true },
      });
    });

    it("rejects when any id is missing, someone else's, or not a line photo", async () => {
      const { service, prisma } = makeService();
      prisma.file.findMany.mockResolvedValue([{ id: 'f1' }]);
      await expect(service.assertOwnedPhotos(['f1', 'f2'], 'user-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});

describe('signLinePhotoUrls (FOR-404)', () => {
  const signer = {
    getSignedUrl: jest.fn((key: string) => Promise.resolve(`https://signed.example/${key}`)),
  };

  beforeEach(() => signer.getSignedUrl.mockClear());

  it('signs only the lines that have a photo', async () => {
    const urls = await signLinePhotoUrls(signer, [
      { id: 'a', photoFile: { key: 'k/a.jpg' } },
      { id: 'b', photoFile: null },
      { id: 'c' },
    ]);
    expect([...urls.entries()]).toEqual([['a', 'https://signed.example/k/a.jpg']]);
    expect(signer.getSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('drops a line whose photo cannot be signed instead of failing the read', async () => {
    signer.getSignedUrl.mockRejectedValueOnce(new Error('down'));
    const urls = await signLinePhotoUrls(signer, [
      { id: 'a', photoFile: { key: 'k/a.jpg' } },
      { id: 'b', photoFile: { key: 'k/b.jpg' } },
    ]);
    expect(urls.has('a')).toBe(false);
    expect(urls.get('b')).toBe('https://signed.example/k/b.jpg');
  });

  it('returns an empty map when no signer is available', async () => {
    const urls = await signLinePhotoUrls(undefined, [{ id: 'a', photoFile: { key: 'k' } }]);
    expect(urls.size).toBe(0);
  });
});
