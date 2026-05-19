import { BadRequestException } from '@nestjs/common';

import { StorageController } from './storage.controller';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockStorageService = {
  upload: jest.fn(),
  getSignedUrl: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn().mockResolvedValue(true),
};

const mockPrisma = {
  file: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};

const authUser = { id: 'user-1', role: 'COMPANY_ADMIN', companyId: 'comp-1' };

describe('StorageController', () => {
  let controller: StorageController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new StorageController(mockStorageService as never, mockPrisma as never);
  });

  // ── uploadFile ─────────────────────────────────────────────────────────

  describe('uploadFile', () => {
    const validFile = {
      originalname: 'doc.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('data'),
    } as Express.Multer.File;

    it('uploads a valid file and returns the file record', async () => {
      mockStorageService.upload.mockResolvedValue({ bucket: 'b', key: 'uploads/uuid.pdf' });
      mockPrisma.file.create.mockResolvedValue({
        id: 'f-1',
        bucket: 'b',
        key: 'uploads/uuid.pdf',
        filename: 'doc.pdf',
        mimeType: 'application/pdf',
        size: 1024,
      });

      const result = await controller.uploadFile(validFile, authUser);
      expect(mockStorageService.upload).toHaveBeenCalledWith(
        expect.stringContaining('uploads/'),
        validFile.buffer,
        'application/pdf',
      );
      expect(mockPrisma.file.create).toHaveBeenCalled();
      expect(result.id).toBe('f-1');
    });

    it('throws BadRequestException when no file provided', async () => {
      await expect(
        controller.uploadFile(undefined as unknown as Express.Multer.File, authUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when file exceeds 10MB', async () => {
      const bigFile = { ...validFile, size: 11 * 1024 * 1024 } as Express.Multer.File;
      await expect(controller.uploadFile(bigFile, authUser)).rejects.toThrow('File too large');
    });

    it('throws BadRequestException for disallowed mime type', async () => {
      const badFile = { ...validFile, mimetype: 'application/zip' } as Express.Multer.File;
      await expect(controller.uploadFile(badFile, authUser)).rejects.toThrow(
        'File type not allowed',
      );
    });

    it('accepts all allowed mime types', async () => {
      const allowed = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/svg+xml',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      for (const mimetype of allowed) {
        mockStorageService.upload.mockResolvedValue({ bucket: 'b', key: 'k' });
        mockPrisma.file.create.mockResolvedValue({ id: 'f' });
        const file = { ...validFile, mimetype } as Express.Multer.File;
        await expect(controller.uploadFile(file, authUser)).resolves.toBeDefined();
      }
    });
  });

  // ── getFileUrl ─────────────────────────────────────────────────────────

  describe('getFileUrl', () => {
    it('returns signed URL for an existing file', async () => {
      mockPrisma.file.findUnique.mockResolvedValue({ id: 'f-1', key: 'uploads/test.pdf' });
      mockStorageService.getSignedUrl.mockResolvedValue('https://signed.url/test.pdf');

      const result = await controller.getFileUrl('f-1');
      expect(result).toEqual({ url: 'https://signed.url/test.pdf' });
      expect(mockStorageService.getSignedUrl).toHaveBeenCalledWith('uploads/test.pdf');
    });

    it('throws BadRequestException when file not found', async () => {
      mockPrisma.file.findUnique.mockResolvedValue(null);
      await expect(controller.getFileUrl('bad-id')).rejects.toThrow('File not found');
    });
  });

  // ── deleteFile ─────────────────────────────────────────────────────────

  describe('deleteFile', () => {
    it('deletes file from storage and database', async () => {
      mockPrisma.file.findUnique.mockResolvedValue({ id: 'f-1', key: 'uploads/test.pdf' });
      mockStorageService.delete.mockResolvedValue(undefined);
      mockPrisma.file.delete.mockResolvedValue({});

      const result = await controller.deleteFile('f-1');
      expect(mockStorageService.delete).toHaveBeenCalledWith('uploads/test.pdf');
      expect(mockPrisma.file.delete).toHaveBeenCalledWith({ where: { id: 'f-1' } });
      expect(result).toEqual({ message: 'File deleted' });
    });

    it('throws BadRequestException when file not found', async () => {
      mockPrisma.file.findUnique.mockResolvedValue(null);
      await expect(controller.deleteFile('bad-id')).rejects.toThrow('File not found');
    });
  });
});
