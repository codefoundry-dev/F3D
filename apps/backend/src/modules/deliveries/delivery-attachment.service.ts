import { randomUUID } from 'crypto';
import * as path from 'path';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/** A serialised attachment row (matches DeliveryReportAttachmentResponse). */
export interface DeliveryAttachmentDto {
  id: string;
  fileId: string;
  fileName: string;
  url: string | null;
  sizeBytes: number | null;
  mimeType: string | null;
  uploadedAt: string;
}

/** A serialised damage-photo row (matches DeliveryDamagePhotoResponse). */
export interface DeliveryDamagePhotoDto {
  id: string;
  fileId: string;
  fileName: string;
  url: string | null;
}

/**
 * File handling for Delivery Reports (Epic 6) — report-level attachments and
 * per-line damage photos. Mirrors PoDocumentService's multipart pattern (10 MB
 * cap, StorageService upload, shared File model + a join row, delete cascade).
 * Each public operation has an internal (company-scoped, authenticated) variant
 * and a portal (report-id-scoped, token-authorised) variant that binds uploads
 * to a fixed deliveryReportId the session token already proved access to.
 */
@Injectable()
export class DeliveryAttachmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  // ── Internal (authenticated) attachment upload / delete ──────────────────────

  async uploadAttachment(
    reportId: string,
    file: Express.Multer.File,
    user: AuthenticatedUser,
  ): Promise<DeliveryAttachmentDto> {
    const report = await this.prisma.deliveryReport.findUnique({
      where: { id: reportId },
      select: { id: true, companyId: true },
    });
    if (!report) throw new NotFoundException('Delivery report not found');
    this.assertCompanyAccess(user, report.companyId);

    return this.storeAttachment(reportId, file, user.id);
  }

  async deleteAttachment(
    reportId: string,
    attId: string,
    user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    const att = await this.prisma.deliveryReportAttachment.findFirst({
      where: { id: attId, deliveryReportId: reportId },
      include: { file: true, deliveryReport: { select: { companyId: true } } },
    });
    if (!att) throw new NotFoundException('Attachment not found');
    this.assertCompanyAccess(user, att.deliveryReport.companyId);

    await this.storageService.delete(att.file.key);
    await this.prisma.deliveryReportAttachment.delete({ where: { id: attId } });
    await this.prisma.file.delete({ where: { id: att.fileId } });
    return { success: true };
  }

  // ── Internal (authenticated) damage-photo upload / delete ────────────────────

  async uploadDamagePhoto(
    reportId: string,
    lineId: string,
    file: Express.Multer.File,
    user: AuthenticatedUser,
  ): Promise<DeliveryDamagePhotoDto> {
    const line = await this.prisma.deliveryReportLine.findFirst({
      where: { id: lineId, deliveryReportId: reportId },
      select: { id: true, deliveryReport: { select: { companyId: true } } },
    });
    if (!line) throw new NotFoundException('Delivery report line not found');
    this.assertCompanyAccess(user, line.deliveryReport.companyId);

    return this.storeDamagePhoto(lineId, file, user.id);
  }

  async deleteDamagePhoto(
    reportId: string,
    lineId: string,
    photoId: string,
    user: AuthenticatedUser,
  ): Promise<{ success: true }> {
    const photo = await this.prisma.deliveryDamagePhoto.findFirst({
      where: {
        id: photoId,
        deliveryReportLineId: lineId,
        deliveryReportLine: { deliveryReportId: reportId },
      },
      include: {
        file: true,
        deliveryReportLine: { select: { deliveryReport: { select: { companyId: true } } } },
      },
    });
    if (!photo) throw new NotFoundException('Damage photo not found');
    this.assertCompanyAccess(user, photo.deliveryReportLine.deliveryReport.companyId);

    await this.storageService.delete(photo.file.key);
    await this.prisma.deliveryDamagePhoto.delete({ where: { id: photoId } });
    await this.prisma.file.delete({ where: { id: photo.fileId } });
    return { success: true };
  }

  // ── Portal (token-authorised) uploads ────────────────────────────────────────
  // Bound to a fixed reportId the DELIVERY_SESSION token already authorised; the
  // uploader has no account, so the File is owned by the PO's creator (a real
  // user in the owning company).

  async uploadAttachmentForReport(
    reportId: string,
    file: Express.Multer.File,
  ): Promise<DeliveryAttachmentDto> {
    const ownerId = await this.resolveReportOwnerUserId(reportId);
    return this.storeAttachment(reportId, file, ownerId);
  }

  async uploadDamagePhotoForReport(
    reportId: string,
    lineId: string,
    file: Express.Multer.File,
  ): Promise<DeliveryDamagePhotoDto> {
    const line = await this.prisma.deliveryReportLine.findFirst({
      where: { id: lineId, deliveryReportId: reportId },
      select: { id: true },
    });
    if (!line) throw new NotFoundException('Delivery report line not found');
    const ownerId = await this.resolveReportOwnerUserId(reportId);
    return this.storeDamagePhoto(lineId, file, ownerId);
  }

  // ── Shared store helpers ─────────────────────────────────────────────────────

  private async storeAttachment(
    reportId: string,
    file: Express.Multer.File,
    uploadedById: string,
  ): Promise<DeliveryAttachmentDto> {
    if (!file) throw new BadRequestException(ERR.storage.noFileProvided);
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException(ERR.storage.fileTooLarge('10MB'));

    const ext = path.extname(file.originalname);
    const key = `delivery-reports/${reportId}/attachments/${randomUUID()}${ext}`;
    const result = await this.storageService.upload(key, file.buffer, file.mimetype);

    const fileRecord = await this.prisma.file.create({
      data: {
        bucket: result.bucket,
        key: result.key,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedById,
      },
    });

    const att = await this.prisma.deliveryReportAttachment.create({
      data: { deliveryReportId: reportId, fileId: fileRecord.id },
      include: { file: true },
    });

    return this.toAttachmentDto(att.id, att.file, att.createdAt);
  }

  private async storeDamagePhoto(
    lineId: string,
    file: Express.Multer.File,
    uploadedById: string,
  ): Promise<DeliveryDamagePhotoDto> {
    if (!file) throw new BadRequestException(ERR.storage.noFileProvided);
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException(ERR.storage.fileTooLarge('10MB'));

    const ext = path.extname(file.originalname);
    const key = `delivery-reports/lines/${lineId}/photos/${randomUUID()}${ext}`;
    const result = await this.storageService.upload(key, file.buffer, file.mimetype);

    const fileRecord = await this.prisma.file.create({
      data: {
        bucket: result.bucket,
        key: result.key,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedById,
      },
    });

    const photo = await this.prisma.deliveryDamagePhoto.create({
      data: { deliveryReportLineId: lineId, fileId: fileRecord.id },
      include: { file: true },
    });

    return { id: photo.id, fileId: photo.fileId, fileName: photo.file.filename, url: null };
  }

  /** The PO creator owns portal-uploaded files (a valid user in the company). */
  private async resolveReportOwnerUserId(reportId: string): Promise<string> {
    const report = await this.prisma.deliveryReport.findUnique({
      where: { id: reportId },
      select: { purchaseOrder: { select: { createdByUserId: true } } },
    });
    if (!report) throw new NotFoundException('Delivery report not found');
    return report.purchaseOrder.createdByUserId;
  }

  private async toAttachmentDto(
    id: string,
    file: { id: string; filename: string; key: string; size: number; mimeType: string },
    createdAt: Date,
  ): Promise<DeliveryAttachmentDto> {
    let url: string | null = null;
    try {
      url = await this.storageService.getSignedUrl(file.key);
    } catch {
      url = null;
    }
    return {
      id,
      fileId: file.id,
      fileName: file.filename,
      url,
      sizeBytes: file.size,
      mimeType: file.mimeType,
      uploadedAt: createdAt.toISOString(),
    };
  }

  private assertCompanyAccess(user: AuthenticatedUser, companyId: string): void {
    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }
  }
}
