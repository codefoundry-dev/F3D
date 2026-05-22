import { randomUUID } from 'crypto';
import * as path from 'path';

import { InvoiceListQueryDto, buildPaginationMeta } from '@forethread/shared-types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus as PrismaInvoiceStatus, Prisma, UserRole } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

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
          project: { select: { name: true } },
          vendor: { select: { legalName: true } },
          relatedPo: { select: { id: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      items: items.map((inv) => ({
        id: inv.id,
        projectName: inv.project.name,
        projectId: inv.projectId,
        vendorName: inv.vendor.legalName,
        status: inv.status,
        relatedPo: inv.relatedPo?.id ?? null,
        totalAmount: Number(inv.totalAmount),
        dueDate: inv.dueDate?.toISOString() ?? null,
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

    return {
      id: inv.id,
      projectName: inv.project.name,
      projectId: inv.projectId,
      vendorName: inv.vendor.legalName,
      status: inv.status,
      relatedPo: inv.relatedPo?.id ?? null,
      totalAmount: Number(inv.totalAmount),
      dueDate: inv.dueDate?.toISOString() ?? null,
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
      documents: inv.documents.map((doc) => ({
        id: doc.id,
        name: doc.file.filename,
        fileId: doc.fileId,
        uploadedBy: {
          name: doc.file.uploadedBy.name,
          email: doc.file.uploadedBy.email,
          avatarUrl: null,
        },
        uploadedAt: doc.createdAt.toISOString(),
      })),
    };
  }

  // ── Approve Invoice ────────────────────────────────────────────────────────

  async approveInvoice(id: string, user: AuthenticatedUser) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true },
    });

    if (!inv) throw new NotFoundException(ERR.invoices.notFound);

    // Check company access
    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== inv.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (inv.status !== PrismaInvoiceStatus.PENDING) {
      throw new BadRequestException(ERR.invoices.cannotApprove(inv.status));
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
      projectName: updated.project.name,
      projectId: updated.projectId,
      vendorName: updated.vendor.legalName,
      status: updated.status,
      relatedPo: updated.relatedPo?.id ?? null,
      totalAmount: Number(updated.totalAmount),
      dueDate: updated.dueDate?.toISOString() ?? null,
    };
  }

  // ── Reject Invoice ────────────────────────────────────────────────────────

  async rejectInvoice(id: string, user: AuthenticatedUser) {
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
      data: { status: PrismaInvoiceStatus.REJECTED },
      include: {
        project: { select: { name: true } },
        vendor: { select: { legalName: true } },
        relatedPo: { select: { id: true } },
      },
    });

    return {
      id: updated.id,
      projectName: updated.project.name,
      projectId: updated.projectId,
      vendorName: updated.vendor.legalName,
      status: updated.status,
      relatedPo: updated.relatedPo?.id ?? null,
      totalAmount: Number(updated.totalAmount),
      dueDate: updated.dueDate?.toISOString() ?? null,
    };
  }

  // ── Bulk Approve Invoices ──────────────────────────────────────────────────

  async bulkApproveInvoices(ids: string[], user: AuthenticatedUser) {
    if (ids.length === 0) {
      throw new BadRequestException(ERR.invoices.noIdsProvided);
    }

    const where: Prisma.InvoiceWhereInput = {
      id: { in: ids },
      status: PrismaInvoiceStatus.PENDING,
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
      uploadedBy: {
        name: doc.file.uploadedBy.name,
        email: doc.file.uploadedBy.email,
        avatarUrl: null,
      },
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
