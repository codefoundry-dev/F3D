import { randomUUID } from 'crypto';
import * as path from 'path';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, UserRole } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class PoDocumentService {
  private readonly logger = new Logger(PoDocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Best-effort audit of a PO document upload/removal onto the PO's activity
   * trail (FOR-353). Never throws, matching po-status.service.ts.
   */
  private async auditDocumentEvent(
    action: AuditAction,
    poId: string,
    user: AuthenticatedUser,
    filename: string,
  ): Promise<void> {
    try {
      await this.auditService.log({
        action,
        performedById: user.id,
        targetType: 'PurchaseOrder',
        targetId: poId,
        metadata: { filename },
      });
    } catch (err) {
      this.logger.debug(
        `Failed to audit PO document event ${action}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // ── Upload PO Document ─────────────────────────────────────────────────

  async uploadDocument(poId: string, file: Express.Multer.File, user: AuthenticatedUser) {
    if (!file) throw new BadRequestException(ERR.storage.noFileProvided);
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException(ERR.storage.fileTooLarge('10MB'));

    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { id: true, companyId: true, vendorId: true },
    });
    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    const isOwner = user.companyId === po.companyId;
    const isVendor = user.role === UserRole.VENDOR && user.companyId === po.vendorId;
    if (user.role !== UserRole.SUPER_ADMIN && !isOwner && !isVendor) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    const ext = path.extname(file.originalname);
    const key = `po-documents/${poId}/${randomUUID()}${ext}`;

    const result = await this.storageService.upload(key, file.buffer, file.mimetype);

    const fileRecord = await this.prisma.file.create({
      data: {
        bucket: result.bucket,
        key: result.key,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedById: user.id,
      },
    });

    const doc = await this.prisma.poDocument.create({
      data: { purchaseOrderId: poId, fileId: fileRecord.id },
      include: {
        file: { include: { uploadedBy: { select: { id: true, name: true, email: true } } } },
      },
    });

    await this.auditDocumentEvent(AuditAction.FILE_UPLOADED, poId, user, file.originalname);

    return {
      id: doc.id,
      name: doc.file.filename,
      fileId: doc.fileId,
      uploadedBy: {
        name: doc.file.uploadedBy?.name ?? '',
        email: doc.file.uploadedBy?.email ?? '',
        avatarUrl: null,
      },
      uploadedAt: doc.createdAt.toISOString(),
    };
  }

  // ── Delete PO Document ────────────────────────────────────────────────

  async deleteDocument(poId: string, docId: string, user: AuthenticatedUser) {
    const doc = await this.prisma.poDocument.findFirst({
      where: { id: docId, purchaseOrderId: poId },
      include: { file: true, purchaseOrder: { select: { companyId: true, vendorId: true } } },
    });

    if (!doc) throw new NotFoundException(ERR.purchaseOrders.notFound);

    const isOwner = user.companyId === doc.purchaseOrder.companyId;
    const isVendor = user.role === UserRole.VENDOR && user.companyId === doc.purchaseOrder.vendorId;
    if (user.role !== UserRole.SUPER_ADMIN && !isOwner && !isVendor) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    await this.storageService.delete(doc.file.key);
    await this.prisma.poDocument.delete({ where: { id: docId } });
    await this.prisma.file.delete({ where: { id: doc.fileId } });

    await this.auditDocumentEvent(AuditAction.FILE_DELETED, poId, user, doc.file.filename);

    return { success: true };
  }
}
