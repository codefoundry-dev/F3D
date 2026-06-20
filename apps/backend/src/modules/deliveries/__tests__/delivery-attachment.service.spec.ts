import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { DeliveryAttachmentService } from '../delivery-attachment.service';

const officer: AuthenticatedUser = {
  id: 'u-1',
  email: 'po@example.com',
  role: UserRole.PROCUREMENT_OFFICER,
  companyId: 'company-1',
};
const superAdmin: AuthenticatedUser = {
  id: 'sa-1',
  email: 'sa@example.com',
  role: UserRole.SUPER_ADMIN,
  companyId: null,
};

function file(size = 1024): Express.Multer.File {
  return {
    originalname: 'pod.pdf',
    buffer: Buffer.from('x'),
    mimetype: 'application/pdf',
    size,
  } as unknown as Express.Multer.File;
}

function makeService() {
  const prisma = {
    deliveryReport: { findUnique: jest.fn() },
    deliveryReportLine: { findFirst: jest.fn() },
    deliveryReportAttachment: {
      create: jest.fn().mockResolvedValue({
        id: 'att-1',
        fileId: 'f-1',
        createdAt: new Date('2026-06-18'),
        file: { id: 'f-1', filename: 'pod.pdf', key: 'k', size: 1024, mimeType: 'application/pdf' },
      }),
      findFirst: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    },
    deliveryDamagePhoto: {
      create: jest.fn().mockResolvedValue({
        id: 'ph-1',
        fileId: 'f-2',
        file: { id: 'f-2', filename: 'dmg.jpg', key: 'k2' },
      }),
      findFirst: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    },
    file: { create: jest.fn().mockResolvedValue({ id: 'f-1' }), delete: jest.fn().mockResolvedValue({}) },
  } as unknown as PrismaService & Record<string, never>;

  const storage = {
    upload: jest.fn().mockResolvedValue({ bucket: 'b', key: 'k' }),
    delete: jest.fn().mockResolvedValue(undefined),
    getSignedUrl: jest.fn().mockResolvedValue('https://signed/url'),
  } as unknown as StorageService & { upload: jest.Mock; delete: jest.Mock; getSignedUrl: jest.Mock };

  const service = new DeliveryAttachmentService(prisma, storage);
  return { service, prisma, storage };
}

describe('DeliveryAttachmentService', () => {
  // ── uploadAttachment (internal) ────────────────────────────────────────────────
  describe('uploadAttachment', () => {
    it('throws NotFound when the report is missing', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.uploadAttachment('dr-x', file(), officer)).rejects.toThrow(NotFoundException);
    });

    it('throws Forbidden when the company does not match', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue({ id: 'dr-1', companyId: 'other' });
      await expect(service.uploadAttachment('dr-1', file(), officer)).rejects.toThrow(ForbiddenException);
    });

    it('rejects when no file is provided', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue({ id: 'dr-1', companyId: 'company-1' });
      await expect(
        service.uploadAttachment('dr-1', undefined as unknown as Express.Multer.File, officer),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a file over the 10MB cap', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue({ id: 'dr-1', companyId: 'company-1' });
      await expect(service.uploadAttachment('dr-1', file(11 * 1024 * 1024), officer)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('uploads, creates the file + join row, and returns a signed url', async () => {
      const { service, prisma, storage } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue({ id: 'dr-1', companyId: 'company-1' });

      const res = await service.uploadAttachment('dr-1', file(), officer);

      expect(storage.upload).toHaveBeenCalled();
      expect(prisma.file.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ uploadedById: 'u-1' }) }),
      );
      expect(res.fileName).toBe('pod.pdf');
      expect(res.url).toBe('https://signed/url');
    });

    it('returns a null url when signing fails', async () => {
      const { service, prisma, storage } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue({ id: 'dr-1', companyId: 'company-1' });
      storage.getSignedUrl.mockRejectedValue(new Error('no s3'));

      const res = await service.uploadAttachment('dr-1', file(), officer);
      expect(res.url).toBeNull();
    });
  });

  // ── deleteAttachment ───────────────────────────────────────────────────────────
  describe('deleteAttachment', () => {
    it('throws NotFound when the attachment is missing', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReportAttachment.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.deleteAttachment('dr-1', 'att-x', officer)).rejects.toThrow(NotFoundException);
    });

    it('deletes the object, the join row, and the file', async () => {
      const { service, prisma, storage } = makeService();
      (prisma.deliveryReportAttachment.findFirst as jest.Mock).mockResolvedValue({
        id: 'att-1',
        fileId: 'f-1',
        file: { key: 'k' },
        deliveryReport: { companyId: 'company-1' },
      });

      await expect(service.deleteAttachment('dr-1', 'att-1', officer)).resolves.toEqual({ success: true });
      expect(storage.delete).toHaveBeenCalledWith('k');
      expect(prisma.deliveryReportAttachment.delete).toHaveBeenCalled();
      expect(prisma.file.delete).toHaveBeenCalled();
    });
  });

  // ── uploadDamagePhoto (internal) ───────────────────────────────────────────────
  describe('uploadDamagePhoto', () => {
    it('throws NotFound when the line is missing', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReportLine.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.uploadDamagePhoto('dr-1', 'li-x', file(), officer)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('uploads a photo for a super admin on any company', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReportLine.findFirst as jest.Mock).mockResolvedValue({
        id: 'drl-1',
        deliveryReport: { companyId: 'company-9' },
      });
      const res = await service.uploadDamagePhoto('dr-1', 'drl-1', file(), superAdmin);
      expect(res.fileName).toBe('dmg.jpg');
      expect(res.url).toBeNull();
    });

    it('rejects a damage photo with no file', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReportLine.findFirst as jest.Mock).mockResolvedValue({
        id: 'drl-1',
        deliveryReport: { companyId: 'company-1' },
      });
      await expect(
        service.uploadDamagePhoto('dr-1', 'drl-1', undefined as unknown as Express.Multer.File, officer),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a damage photo over the 10MB cap', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReportLine.findFirst as jest.Mock).mockResolvedValue({
        id: 'drl-1',
        deliveryReport: { companyId: 'company-1' },
      });
      await expect(
        service.uploadDamagePhoto('dr-1', 'drl-1', file(11 * 1024 * 1024), officer),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── deleteDamagePhoto ──────────────────────────────────────────────────────────
  describe('deleteDamagePhoto', () => {
    it('throws NotFound when the photo is missing', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryDamagePhoto.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.deleteDamagePhoto('dr-1', 'li-1', 'ph-x', officer)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes the object, photo row, and file', async () => {
      const { service, prisma, storage } = makeService();
      (prisma.deliveryDamagePhoto.findFirst as jest.Mock).mockResolvedValue({
        id: 'ph-1',
        fileId: 'f-2',
        file: { key: 'k2' },
        deliveryReportLine: { deliveryReport: { companyId: 'company-1' } },
      });

      await expect(service.deleteDamagePhoto('dr-1', 'li-1', 'ph-1', officer)).resolves.toEqual({
        success: true,
      });
      expect(storage.delete).toHaveBeenCalledWith('k2');
    });
  });

  // ── portal (token-bound) uploads ───────────────────────────────────────────────
  describe('portal uploads', () => {
    it('uploads an attachment for a report, owned by the PO creator', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue({
        purchaseOrder: { createdByUserId: 'creator-1' },
      });

      await service.uploadAttachmentForReport('dr-1', file());
      expect(prisma.file.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ uploadedById: 'creator-1' }) }),
      );
    });

    it('throws NotFound resolving the owner when the report is gone', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.uploadAttachmentForReport('dr-x', file())).rejects.toThrow(NotFoundException);
    });

    it('uploads a damage photo for a report line bound to the session report', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReportLine.findFirst as jest.Mock).mockResolvedValue({ id: 'drl-1' });
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue({
        purchaseOrder: { createdByUserId: 'creator-1' },
      });

      const res = await service.uploadDamagePhotoForReport('dr-1', 'drl-1', file());
      expect(res.fileName).toBe('dmg.jpg');
    });

    it('throws NotFound when the portal line does not belong to the report', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReportLine.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.uploadDamagePhotoForReport('dr-1', 'li-x', file())).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
