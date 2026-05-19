import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PoDocumentService } from '../po-document.service';

const companyAdmin = {
  id: 'ca-1',
  email: 'ca@test.com',
  role: UserRole.COMPANY_ADMIN,
  companyId: 'comp-1',
};
const superAdmin = {
  id: 'sa-1',
  email: 'sa@test.com',
  role: UserRole.SUPER_ADMIN,
  companyId: null,
};

const mockPrisma = {
  purchaseOrder: {
    findUnique: jest.fn(),
  },
  file: {
    create: jest.fn(),
    delete: jest.fn(),
  },
  poDocument: {
    create: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
};

const mockStorageService = {
  upload: jest.fn(),
  getSignedUrl: jest.fn(),
  getPublicUrl: jest.fn(),
  delete: jest.fn(),
};

describe('PoDocumentService', () => {
  let service: PoDocumentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PoDocumentService(mockPrisma as never, mockStorageService as never);
  });

  describe('uploadDocument', () => {
    const makeFile = (overrides = {}): Express.Multer.File =>
      ({
        originalname: 'doc.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('fake'),
        ...overrides,
      }) as Express.Multer.File;

    it('throws BadRequestException when no file is provided', async () => {
      await expect(
        service.uploadDocument('po-1', undefined as never, companyAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when file is too large', async () => {
      await expect(
        service.uploadDocument('po-1', makeFile({ size: 11 * 1024 * 1024 }), companyAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when PO not found', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue(null);

      await expect(service.uploadDocument('missing', makeFile(), companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user company does not match', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        companyId: 'other-company',
      });

      await expect(service.uploadDocument('po-1', makeFile(), companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('uploads file and creates document record', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        companyId: 'comp-1',
      });
      mockStorageService.upload.mockResolvedValue({
        bucket: 'b',
        key: 'po-documents/po-1/uuid.pdf',
      });
      mockPrisma.file.create.mockResolvedValue({ id: 'f-1' });
      mockPrisma.poDocument.create.mockResolvedValue({
        id: 'doc-1',
        fileId: 'f-1',
        createdAt: new Date('2026-03-01'),
        file: {
          filename: 'doc.pdf',
          uploadedBy: { id: 'ca-1', name: 'CA User', email: 'ca@test.com' },
        },
      });

      const result = await service.uploadDocument('po-1', makeFile(), companyAdmin);

      expect(result.id).toBe('doc-1');
      expect(result.name).toBe('doc.pdf');
      expect(result.uploadedBy).toEqual({ name: 'CA User', email: 'ca@test.com', avatarUrl: null });
      expect(mockStorageService.upload).toHaveBeenCalled();
    });

    it('allows SuperAdmin to upload to any PO', async () => {
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        companyId: 'any-company',
      });
      mockStorageService.upload.mockResolvedValue({ bucket: 'b', key: 'key' });
      mockPrisma.file.create.mockResolvedValue({ id: 'f-1' });
      mockPrisma.poDocument.create.mockResolvedValue({
        id: 'doc-1',
        fileId: 'f-1',
        createdAt: new Date('2026-03-01'),
        file: { filename: 'doc.pdf', uploadedBy: null },
      });

      const result = await service.uploadDocument('po-1', makeFile(), superAdmin);
      expect(result.id).toBe('doc-1');
      expect(result.uploadedBy).toEqual({ name: '', email: '', avatarUrl: null });
    });
  });

  describe('deleteDocument', () => {
    it('throws NotFoundException when document not found', async () => {
      mockPrisma.poDocument.findFirst.mockResolvedValue(null);

      await expect(service.deleteDocument('po-1', 'doc-1', companyAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user company does not match', async () => {
      mockPrisma.poDocument.findFirst.mockResolvedValue({
        id: 'doc-1',
        file: { key: 'key' },
        purchaseOrder: { companyId: 'other-company' },
      });

      await expect(service.deleteDocument('po-1', 'doc-1', companyAdmin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deletes document, file record, and storage object', async () => {
      mockPrisma.poDocument.findFirst.mockResolvedValue({
        id: 'doc-1',
        fileId: 'f-1',
        file: { key: 'po-documents/po-1/uuid.pdf' },
        purchaseOrder: { companyId: 'comp-1' },
      });
      mockStorageService.delete.mockResolvedValue(undefined);
      mockPrisma.poDocument.delete.mockResolvedValue({});
      mockPrisma.file.delete.mockResolvedValue({});

      const result = await service.deleteDocument('po-1', 'doc-1', companyAdmin);

      expect(result).toEqual({ success: true });
      expect(mockStorageService.delete).toHaveBeenCalledWith('po-documents/po-1/uuid.pdf');
      expect(mockPrisma.poDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } });
      expect(mockPrisma.file.delete).toHaveBeenCalledWith({ where: { id: 'f-1' } });
    });

    it('allows SuperAdmin to delete any document', async () => {
      mockPrisma.poDocument.findFirst.mockResolvedValue({
        id: 'doc-1',
        fileId: 'f-1',
        file: { key: 'key' },
        purchaseOrder: { companyId: 'any-company' },
      });
      mockStorageService.delete.mockResolvedValue(undefined);
      mockPrisma.poDocument.delete.mockResolvedValue({});
      mockPrisma.file.delete.mockResolvedValue({});

      const result = await service.deleteDocument('po-1', 'doc-1', superAdmin);
      expect(result).toEqual({ success: true });
    });
  });
});
