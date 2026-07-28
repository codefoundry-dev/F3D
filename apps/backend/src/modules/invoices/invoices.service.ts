import { randomUUID } from 'crypto';
import * as path from 'path';

import {
  InvoiceListQueryDto,
  RejectInvoiceDto,
  ReviewInvoiceDto,
  buildPaginationMeta,
  type InvoiceExtractionResult,
} from '@forethread/shared-types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CompanyType,
  DocExtractionStatus,
  DocExtractionType,
  NotificationEntityType,
  NotificationType,
  InvoiceStatus as PrismaInvoiceStatus,
  Prisma,
  UserRole,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { invoiceReference } from '../../common/utils/invoice-reference.util';
import { resolveVendorEmailRecipients } from '../../common/utils/vendor-recipients.util';
import { PrismaService } from '../../prisma/prisma.service';
import { BrandingService } from '../export/branding.service';
import { NotificationService } from '../notification-feed/notification.service';
import { EmailService } from '../notifications/email.service';
import { StorageService } from '../storage/storage.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/** Reviewed text fields collapse to null when blank — '' is never stored. */
function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
}

@Injectable()
export class InvoicesService {
  private readonly webAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
    private readonly notifications: NotificationService,
    private readonly branding: BrandingService,
    config: ConfigService,
  ) {
    this.webAppUrl = config.get<string>('WEB_APP_URL', 'http://localhost:5179');
  }

  // ── List Invoices ──────────────────────────────────────────────────────────

  async listInvoices(query: InvoiceListQueryDto, user: AuthenticatedUser) {
    const sortBy = query.sortBy ?? 'dueDate';
    const sortDir = query.sortDir ?? 'desc';

    const where: Prisma.InvoiceWhereInput = {};

    // Role-based scoping
    if (user.role === UserRole.VENDOR) {
      if (user.companyId) where.vendorId = user.companyId;
    } else if (user.role !== UserRole.SUPER_ADMIN) {
      if (user.companyId) where.companyId = user.companyId;
    }

    // Status filter
    if (query.status) {
      where.status = query.status as PrismaInvoiceStatus;
    }

    // Project filter
    if (query.projectId) {
      where.projectId = query.projectId;
    }

    // Vendor filter
    if (query.vendorId) {
      where.vendorId = query.vendorId;
    }

    // Due date range filter
    if (query.dueDateFrom || query.dueDateTo) {
      where.dueDate = {};
      if (query.dueDateFrom) {
        where.dueDate.gte = new Date(query.dueDateFrom);
      }
      if (query.dueDateTo) {
        where.dueDate.lte = new Date(query.dueDateTo);
      }
    }

    // Amount range filter
    if (query.amountMin !== undefined || query.amountMax !== undefined) {
      where.totalAmount = {};
      if (query.amountMin !== undefined) {
        where.totalAmount.gte = query.amountMin;
      }
      if (query.amountMax !== undefined) {
        where.totalAmount.lte = query.amountMax;
      }
    }

    // Search
    if (query.search) {
      where.OR = [
        { id: { contains: query.search, mode: 'insensitive' } },
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { project: { name: { contains: query.search, mode: 'insensitive' } } },
        { vendor: { legalName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    // Sorting
    const orderBy: Prisma.InvoiceOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'id':
        orderBy.id = sortDir;
        break;
      case 'projectName':
        orderBy.project = { name: sortDir };
        break;
      case 'vendorName':
        orderBy.vendor = { legalName: sortDir };
        break;
      case 'status':
        orderBy.status = sortDir;
        break;
      case 'totalAmount':
        orderBy.totalAmount = sortDir;
        break;
      default:
        orderBy.dueDate = sortDir;
    }

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy,
        include: {
          project: { select: { name: true, code: true } },
          vendor: { select: { legalName: true } },
          relatedPo: { select: { id: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      // project/vendor/totalAmount are null on intake-created invoices that
      // haven't been reviewed yet (FOR-290).
      items: items.map((inv) => ({
        id: inv.id,
        projectName: inv.project?.name ?? null,
        projectId: inv.projectId,
        projectCode: inv.project?.code ?? null,
        vendorName: inv.vendor?.legalName ?? null,
        status: inv.status,
        source: inv.source,
        relatedPo: inv.relatedPo?.id ?? null,
        totalAmount: inv.totalAmount === null ? null : Number(inv.totalAmount),
        dueDate: inv.dueDate?.toISOString() ?? null,
        invoiceNumber: inv.invoiceNumber,
      })),
      meta: buildPaginationMeta(query.page ?? 1, query.take, total),
    };
  }

  // ── Get single Invoice ─────────────────────────────────────────────────────

  async getInvoice(id: string, _user: AuthenticatedUser) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        project: { select: { name: true } },
        vendor: { select: { legalName: true } },
        relatedPo: { select: { id: true } },
        lines: { orderBy: { position: 'asc' } },
        documents: {
          include: {
            file: {
              include: { uploadedBy: { select: { id: true, name: true, email: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!inv) throw new NotFoundException(ERR.invoices.notFound);

    // The latest extraction for this invoice (FOR-291) — the review UI's
    // prefill source and processing/failure indicator.
    const extraction = await this.prisma.docExtraction.findFirst({
      where: { invoiceId: id, type: DocExtractionType.INVOICE },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        errorCode: true,
        editedResult: true,
        completedAt: true,
      },
    });

    return {
      id: inv.id,
      projectName: inv.project?.name ?? null,
      projectId: inv.projectId,
      vendorName: inv.vendor?.legalName ?? null,
      status: inv.status,
      source: inv.source,
      senderEmail: inv.senderEmail,
      relatedPo: inv.relatedPo?.id ?? null,
      totalAmount: inv.totalAmount === null ? null : Number(inv.totalAmount),
      dueDate: inv.dueDate?.toISOString() ?? null,
      invoiceNumber: inv.invoiceNumber,
      issuedDate: inv.issuedDate?.toISOString() ?? null,
      reviewedAt: inv.reviewedAt?.toISOString() ?? null,
      lines: inv.lines.map((line) => ({
        id: line.id,
        lineId: line.lineId,
        description: line.description,
        quantity: line.quantity === null ? null : Number(line.quantity),
        unit: line.unit,
        unitPrice: line.unitPrice === null ? null : Number(line.unitPrice),
        lineTotal: line.lineTotal === null ? null : Number(line.lineTotal),
      })),
      extraction: extraction
        ? {
            id: extraction.id,
            status: extraction.status,
            errorCode: extraction.errorCode,
            completedAt: extraction.completedAt?.toISOString() ?? null,
            result:
              extraction.status === DocExtractionStatus.COMPLETED ||
              extraction.status === DocExtractionStatus.CONFIRMED
                ? (extraction.editedResult as unknown as InvoiceExtractionResult | null)
                : null,
          }
        : null,
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
      documents: inv.documents.map((doc) => ({
        id: doc.id,
        name: doc.file.filename,
        fileId: doc.fileId,
        // Email-intake documents have no uploading user (FOR-290).
        uploadedBy: doc.file.uploadedBy
          ? {
              name: doc.file.uploadedBy.name,
              email: doc.file.uploadedBy.email,
              avatarUrl: null,
            }
          : null,
        uploadedAt: doc.createdAt.toISOString(),
      })),
    };
  }

  // ── Review Invoice (FOR-291) ───────────────────────────────────────────────

  /**
   * Persist the reviewer's confirmed/corrected fields onto the invoice.
   * Replace semantics: every save writes the full set of reviewed fields and
   * swaps the line items wholesale, so the record always reflects the
   * reviewer's latest statement of what the document says. Only Pending
   * invoices are reviewable — approval freezes the record.
   */
  async reviewInvoice(id: string, dto: ReviewInvoiceDto, user: AuthenticatedUser) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true },
    });

    if (!inv) throw new NotFoundException(ERR.invoices.notFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== inv.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (inv.status !== PrismaInvoiceStatus.PENDING) {
      throw new BadRequestException(ERR.invoices.cannotReview(inv.status));
    }

    if (dto.vendorId) {
      const vendor = await this.prisma.company.findFirst({
        where: { id: dto.vendorId, type: CompanyType.VENDOR },
        select: { id: true },
      });
      if (!vendor) throw new BadRequestException(ERR.invoices.reviewVendorNotFound);
    }

    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, companyId: inv.companyId },
        select: { id: true },
      });
      if (!project) throw new BadRequestException(ERR.invoices.reviewProjectNotFound);
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.invoice.update({
        where: { id },
        data: {
          vendorId: dto.vendorId ?? null,
          projectId: dto.projectId ?? null,
          invoiceNumber: trimmedOrNull(dto.invoiceNumber),
          issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          totalAmount: dto.totalAmount ?? null,
          reviewedByUserId: user.id,
          reviewedAt: now,
          // Review moves dueDate, so the reminder ledger (US 8.09) must reset —
          // the new date is what should be reminded on. Reviews only happen
          // while Pending (reminders sweep Approved), so nothing has fired yet.
          dueReminderSentAt: null,
          overdueReminderSentAt: null,
        },
        select: { id: true },
      }),
      this.prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } }),
      this.prisma.invoiceLineItem.createMany({
        data: dto.lines.map((line, position) => ({
          invoiceId: id,
          position,
          lineId: trimmedOrNull(line.lineId),
          description: line.description.trim(),
          quantity: line.quantity ?? null,
          unit: trimmedOrNull(line.unit),
          unitPrice: line.unitPrice ?? null,
          lineTotal: line.lineTotal ?? null,
        })),
      }),
      // A human has signed off on the extracted values — the completed
      // extraction job graduates to Confirmed.
      this.prisma.docExtraction.updateMany({
        where: {
          invoiceId: id,
          type: DocExtractionType.INVOICE,
          status: DocExtractionStatus.COMPLETED,
        },
        data: {
          status: DocExtractionStatus.CONFIRMED,
          confirmedByUserId: user.id,
          confirmedAt: now,
        },
      }),
    ]);

    return this.getInvoice(id, user);
  }

  // ── Approve Invoice ────────────────────────────────────────────────────────

  async approveInvoice(id: string, user: AuthenticatedUser) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        companyId: true,
        projectId: true,
        vendorId: true,
        totalAmount: true,
      },
    });

    if (!inv) throw new NotFoundException(ERR.invoices.notFound);

    // Check company access
    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== inv.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (inv.status !== PrismaInvoiceStatus.PENDING) {
      throw new BadRequestException(ERR.invoices.cannotApprove(inv.status));
    }

    // Intake-created invoices (FOR-290) stay unapprovable until review
    // (FOR-291) has filled in who it's from, what it's for, and how much.
    if (inv.vendorId === null || inv.projectId === null || inv.totalAmount === null) {
      throw new BadRequestException(ERR.invoices.notReviewed);
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: PrismaInvoiceStatus.APPROVED },
      include: {
        project: { select: { name: true } },
        vendor: { select: { legalName: true } },
        relatedPo: { select: { id: true } },
      },
    });

    return {
      id: updated.id,
      projectName: updated.project?.name ?? null,
      projectId: updated.projectId,
      vendorName: updated.vendor?.legalName ?? null,
      status: updated.status,
      relatedPo: updated.relatedPo?.id ?? null,
      totalAmount: updated.totalAmount === null ? null : Number(updated.totalAmount),
      dueDate: updated.dueDate?.toISOString() ?? null,
    };
  }

  // ── Reject Invoice ────────────────────────────────────────────────────────

  async rejectInvoice(id: string, dto: RejectInvoiceDto, user: AuthenticatedUser) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true },
    });

    if (!inv) throw new NotFoundException(ERR.invoices.notFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== inv.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (inv.status !== PrismaInvoiceStatus.PENDING && inv.status !== PrismaInvoiceStatus.DISPUTED) {
      throw new BadRequestException(ERR.invoices.cannotReject(inv.status));
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: PrismaInvoiceStatus.REJECTED,
        rejectionReason: dto.reason ?? null,
      },
      include: {
        project: { select: { name: true } },
        company: { select: { legalName: true } },
        vendor: { select: { legalName: true } },
        relatedPo: { select: { id: true } },
      },
    });

    // Tell the vendor their invoice was rejected / a discrepancy was raised
    // (US 8.05 / 8.06). Fire-and-forget, like every other transactional
    // notification — the status change is already committed.
    void this.notifyVendorOfRejection(updated, user.id).catch(() => {});

    return {
      id: updated.id,
      projectName: updated.project?.name ?? null,
      projectId: updated.projectId,
      vendorName: updated.vendor?.legalName ?? null,
      status: updated.status,
      relatedPo: updated.relatedPo?.id ?? null,
      totalAmount: updated.totalAmount === null ? null : Number(updated.totalAmount),
      dueDate: updated.dueDate?.toISOString() ?? null,
    };
  }

  /**
   * Email the vendor that their invoice was rejected / a discrepancy was raised,
   * and mirror it into the in-app feed for any vendor rep with an account
   * (US 8.05 / 8.06). Supporting references stay behind the invoice link — the
   * matrix explicitly does not attach them.
   *
   * Best-effort: the rejection is already committed, so nothing here may throw
   * back into the request.
   */
  private async notifyVendorOfRejection(
    invoice: {
      id: string;
      companyId: string;
      vendorId: string | null;
      rejectionReason: string | null;
      project: { name: string } | null;
      company: { legalName: string };
    },
    rejectedByUserId: string,
  ): Promise<void> {
    // Intake invoices that review never linked to a vendor have no one to tell.
    if (!invoice.vendorId) return;

    const vendor = await this.prisma.company.findUnique({
      where: { id: invoice.vendorId },
      select: {
        contactEmail: true,
        users: {
          where: { role: UserRole.VENDOR, status: { not: 'INACTIVE' } },
          select: { email: true },
        },
      },
    });
    if (!vendor) return;

    const recipients = resolveVendorEmailRecipients(vendor.users, vendor.contactEmail);
    if (recipients.length === 0) return;

    const reference = invoiceReference(invoice.id);
    const viewUrl = `${this.webAppUrl}/invoices/${invoice.id}`;
    // Intake invoices may be rejected before review linked them to a project.
    const projectName = invoice.project?.name ?? null;
    // The rejecting (buyer) company's logo + name, shown atop the email (FOR-288).
    const brand = await this.branding.getEmailBrand(invoice.companyId);

    await Promise.all(
      recipients.map((email) =>
        this.emailService.sendInvoiceRejectedEmail(
          email,
          {
            invoiceReference: reference,
            companyName: invoice.company.legalName,
            projectName: projectName ?? '',
          },
          viewUrl,
          { comment: invoice.rejectionReason, brand },
        ),
      ),
    );

    await this.notifications.createForEmails(recipients, {
      type: NotificationType.INVOICE_REJECTED,
      title: 'Invoice rejected',
      body: projectName
        ? `${invoice.company.legalName} rejected invoice ${reference} for ${projectName}.`
        : `${invoice.company.legalName} rejected invoice ${reference}.`,
      entityType: NotificationEntityType.INVOICE,
      entityId: invoice.id,
      metadata: { rejectedByUserId },
    });
  }

  // ── Bulk Approve Invoices ──────────────────────────────────────────────────

  async bulkApproveInvoices(ids: string[], user: AuthenticatedUser) {
    if (ids.length === 0) {
      throw new BadRequestException(ERR.invoices.noIdsProvided);
    }

    const where: Prisma.InvoiceWhereInput = {
      id: { in: ids },
      status: PrismaInvoiceStatus.PENDING,
      // Unreviewed intake invoices (FOR-290) are skipped, mirroring the
      // single-approve guard; approvedCount reflects how many qualified.
      vendorId: { not: null },
      projectId: { not: null },
      totalAmount: { not: null },
    };

    // Scope by company
    if (user.role !== UserRole.SUPER_ADMIN && user.companyId) {
      where.companyId = user.companyId;
    }

    const result = await this.prisma.invoice.updateMany({
      where,
      data: { status: PrismaInvoiceStatus.APPROVED },
    });

    return {
      approvedCount: result.count,
      requestedCount: ids.length,
    };
  }

  // ── Upload Invoice Document ─────────────────────────────────────────────────

  async uploadDocument(invoiceId: string, file: Express.Multer.File, user: AuthenticatedUser) {
    if (!file) throw new BadRequestException(ERR.storage.noFileProvided);
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException(ERR.storage.fileTooLarge('10MB'));

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, companyId: true },
    });
    if (!invoice) throw new NotFoundException(ERR.invoices.notFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== invoice.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    const ext = path.extname(file.originalname);
    const key = `invoice-documents/${invoiceId}/${randomUUID()}${ext}`;

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

    const doc = await this.prisma.invoiceDocument.create({
      data: { invoiceId, fileId: fileRecord.id },
      include: {
        file: { include: { uploadedBy: { select: { id: true, name: true, email: true } } } },
      },
    });

    return {
      id: doc.id,
      name: doc.file.filename,
      fileId: doc.fileId,
      // Always present on this path (the file was just created with an
      // uploader); typed nullable since FOR-290 email-intake files.
      uploadedBy: doc.file.uploadedBy
        ? {
            name: doc.file.uploadedBy.name,
            email: doc.file.uploadedBy.email,
            avatarUrl: null,
          }
        : null,
      uploadedAt: doc.createdAt.toISOString(),
    };
  }

  // ── Delete Invoice Document ─────────────────────────────────────────────────

  async deleteDocument(invoiceId: string, docId: string, user: AuthenticatedUser) {
    const doc = await this.prisma.invoiceDocument.findFirst({
      where: { id: docId, invoiceId },
      include: { file: true, invoice: { select: { companyId: true } } },
    });

    if (!doc) throw new NotFoundException(ERR.invoices.documentNotFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== doc.invoice.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    await this.storageService.delete(doc.file.key);
    await this.prisma.invoiceDocument.delete({ where: { id: docId } });
    await this.prisma.file.delete({ where: { id: doc.fileId } });

    return { success: true };
  }
}
