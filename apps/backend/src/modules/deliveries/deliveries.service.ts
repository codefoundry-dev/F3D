import type {
  DeliveryReportDetailResponse,
  DeliveryReportLineResponse,
  DeliveryReportListItem,
  DamageDisposition as DamageDispositionContract,
  DamageType as DamageTypeContract,
  DeliveryOutcome as DeliveryOutcomeContract,
  DeliveryReportSource as DeliveryReportSourceContract,
  DeliveryReportStatus as DeliveryReportStatusContract,
} from '@forethread/shared-types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  DamageDisposition,
  DeliveryOutcome,
  DeliveryReportSource,
  DeliveryReportStatus,
  Prisma,
  UserRole,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DeliveryDeltaPo, PoStatusService } from '../purchase-orders/po-status.service';
import { StorageService } from '../storage/storage.service';

import { CreateDeliveryReportDto, ListDeliveryReportQueryDto } from './deliveries.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/** PO statuses against which a delivery may be recorded / a link generated. */
export const DELIVERABLE_PO_STATUSES = [
  'SENT',
  'ACKNOWLEDGED',
  'ACCEPTED',
  'SCHEDULED_FOR_DELIVERY',
  'PARTIALLY_DELIVERED',
  'LATE_FOR_DELIVERY',
] as const;

/** Shape captured per-line at submit time (shared by internal + portal create). */
export interface DeliveryLineInput {
  poLineItemId: string;
  quantityReceived: number;
  outcome: DeliveryOutcome;
  notes?: string;
  damagedQuantity?: number;
  damageType?: import('@prisma/client').DamageType;
  damageDisposition?: DamageDisposition;
}

/** Submitter identity used when creating a report (internal user or portal). */
export interface DeliverySubmitter {
  userId: string | null;
  name: string;
  email: string;
}

/** Header fields shared by internal create and portal submit. */
export interface DeliveryReportHeaderInput {
  deliveryDate?: string;
  deliveryLocationId?: string;
  projectId?: string;
  vendorId?: string;
  contactPerson?: string;
  contactPhone?: string;
  overallNotes?: string;
}

/** Prisma include used by the detail read + the create read-back. */
const REPORT_DETAIL_INCLUDE = {
  purchaseOrder: { select: { id: true, poNumber: true, rfqId: true } },
  project: { select: { id: true, name: true } },
  deliveryLocation: { select: { id: true, label: true, address: true } },
  vendor: { select: { id: true, legalName: true } },
  reviewer: { select: { id: true, name: true } },
  lines: {
    orderBy: { id: 'asc' as const },
    include: {
      material: { select: { id: true, name: true, uom: true } },
      poLineItem: {
        select: {
          id: true,
          lineNumber: true,
          materialCode: true,
          description: true,
          unitOfMeasure: true,
          quantityOrdered: true,
        },
      },
      damagePhotos: { include: { file: { select: { id: true, filename: true, key: true } } } },
    },
  },
  attachments: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      file: { select: { id: true, filename: true, key: true, size: true, mimeType: true } },
    },
  },
} satisfies Prisma.DeliveryReportInclude;

type ReportWithRelations = Prisma.DeliveryReportGetPayload<{
  include: typeof REPORT_DETAIL_INCLUDE;
}>;

@Injectable()
export class DeliveriesService {
  private readonly logger = new Logger(DeliveriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
    private readonly poStatusService: PoStatusService,
  ) {}

  // ── List ──────────────────────────────────────────────────────────────────

  async list(
    user: AuthenticatedUser,
    query: ListDeliveryReportQueryDto,
  ): Promise<{
    items: DeliveryReportListItem[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where: Prisma.DeliveryReportWhereInput = {};

    // Company scoping (SUPER_ADMIN sees all; everyone else their own company).
    if (user.role !== UserRole.SUPER_ADMIN) {
      if (!user.companyId) {
        return {
          items: [],
          meta: { page: 1, limit: query.limit ?? DEFAULT_LIMIT, total: 0, totalPages: 0 },
        };
      }
      where.companyId = user.companyId;
    }

    if (query.status) where.status = query.status;
    if (query.source) where.source = query.source;
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.projectId) where.projectId = query.projectId;
    if (query.deliveryLocationId) where.deliveryLocationId = query.deliveryLocationId;
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { reportNumber: { contains: term, mode: 'insensitive' } },
        { submitterName: { contains: term, mode: 'insensitive' } },
        { purchaseOrder: { poNumber: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const page = query.page && query.page > 0 ? query.page : DEFAULT_PAGE;
    const limit = query.limit && query.limit > 0 ? query.limit : DEFAULT_LIMIT;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.deliveryReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          reportNumber: true,
          status: true,
          source: true,
          purchaseOrderId: true,
          deliveryDate: true,
          projectId: true,
          vendorId: true,
          deliveryLocationId: true,
          submitterName: true,
          createdAt: true,
          purchaseOrder: { select: { poNumber: true, rfqId: true } },
          project: { select: { name: true } },
          vendor: { select: { legalName: true } },
          deliveryLocation: { select: { label: true, address: true } },
        },
      }),
      this.prisma.deliveryReport.count({ where }),
    ]);

    // Resolve the linked-RFQ + linked-invoice references per PO in one pass.
    const rfqIds = [
      ...new Set(rows.map((r) => r.purchaseOrder.rfqId).filter((x): x is string => !!x)),
    ];
    const poIds = [...new Set(rows.map((r) => r.purchaseOrderId))];
    const [rfqs, invoices] = await Promise.all([
      rfqIds.length
        ? this.prisma.rfq.findMany({
            where: { id: { in: rfqIds } },
            select: { id: true, rfqNumber: true },
          })
        : Promise.resolve([]),
      poIds.length
        ? this.prisma.invoice.findMany({
            where: { relatedPoId: { in: poIds } },
            select: { id: true, relatedPoId: true },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);
    const rfqNumberById = new Map(rfqs.map((r) => [r.id, r.rfqNumber]));
    const invoiceByPoId = new Map<string, string>();
    for (const inv of invoices) {
      if (inv.relatedPoId && !invoiceByPoId.has(inv.relatedPoId)) {
        invoiceByPoId.set(inv.relatedPoId, this.invoiceRef(inv.id));
      }
    }

    const items: DeliveryReportListItem[] = rows.map((r) => ({
      id: r.id,
      reportNumber: r.reportNumber,
      status: r.status as DeliveryReportStatusContract,
      source: r.source as DeliveryReportSourceContract,
      purchaseOrderId: r.purchaseOrderId,
      poNumber: r.purchaseOrder.poNumber,
      deliveryDate: r.deliveryDate?.toISOString() ?? null,
      projectId: r.projectId,
      projectName: r.project?.name ?? null,
      vendorId: r.vendorId,
      vendorName: r.vendor?.legalName ?? null,
      deliveryLocationId: r.deliveryLocationId,
      deliveryLocationName: r.deliveryLocation
        ? (r.deliveryLocation.label ?? r.deliveryLocation.address)
        : null,
      linkedRfqNumber: r.purchaseOrder.rfqId
        ? (rfqNumberById.get(r.purchaseOrder.rfqId) ?? null)
        : null,
      invoiceNumber: invoiceByPoId.get(r.purchaseOrderId) ?? null,
      submitterName: r.submitterName,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Get single (detail) ──────────────────────────────────────────────────────

  async get(id: string, user: AuthenticatedUser): Promise<DeliveryReportDetailResponse> {
    const report = await this.prisma.deliveryReport.findUnique({
      where: { id },
      include: REPORT_DETAIL_INCLUDE,
    });
    if (!report) throw new NotFoundException('Delivery report not found');
    this.assertCompanyAccess(user, report.companyId);
    return this.toDetail(report);
  }

  // ── Create (INTERNAL) ────────────────────────────────────────────────────────

  async create(
    user: AuthenticatedUser,
    dto: CreateDeliveryReportDto,
  ): Promise<DeliveryReportDetailResponse> {
    // AuthenticatedUser carries no display name — resolve it for the submitter
    // snapshot, falling back to the email.
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true },
    });
    const id = await this.createReport(
      DeliveryReportSource.INTERNAL,
      { userId: user.id, name: dbUser?.name ?? user.email, email: user.email },
      dto.purchaseOrderId,
      dto,
      dto.lines,
      user,
    );
    return this.get(id, user);
  }

  /**
   * Shared report-creation routine used by both the internal create path and the
   * public portal submit. Validates the PO is deliverable + (for internal) in the
   * caller's company, validates the lines against the PO, then writes the report
   * + lines (status SUBMITTED) with per-line ordered/material snapshots inside a
   * transaction that also mints the sequential report number. Returns the new id.
   */
  async createReport(
    source: DeliveryReportSource,
    submitter: DeliverySubmitter,
    purchaseOrderId: string,
    header: DeliveryReportHeaderInput,
    lines: DeliveryLineInput[],
    user?: AuthenticatedUser,
  ): Promise<string> {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: {
        id: true,
        companyId: true,
        projectId: true,
        vendorId: true,
        status: true,
        deliveryLocationId: true,
        lineItems: { select: { id: true, materialId: true, quantityOrdered: true } },
      },
    });
    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    // Internal create is company-scoped; portal create is already token-bound to
    // the PO so it skips this check.
    if (user) this.assertCompanyAccess(user, po.companyId);

    if (!this.isDeliverable(po.status)) {
      throw new BadRequestException(
        `A delivery cannot be recorded for a PO in status ${po.status}.`,
      );
    }

    this.validateLines(lines, po.lineItems);

    const poLineById = new Map(po.lineItems.map((li) => [li.id, li]));

    const created = await this.prisma.$transaction(async (tx) => {
      const reportNumber = await this.nextReportNumber(po.companyId, tx);
      return tx.deliveryReport.create({
        data: {
          reportNumber,
          purchaseOrderId: po.id,
          companyId: po.companyId,
          projectId: header.projectId ?? po.projectId ?? null,
          status: DeliveryReportStatus.SUBMITTED,
          source,
          deliveryDate: header.deliveryDate ? new Date(header.deliveryDate) : null,
          deliveryLocationId: header.deliveryLocationId ?? po.deliveryLocationId ?? null,
          vendorId: header.vendorId ?? po.vendorId ?? null,
          overallNotes: header.overallNotes ?? null,
          submitterUserId: submitter.userId,
          submitterName: submitter.name,
          submitterEmail: submitter.email,
          contactPerson: header.contactPerson ?? null,
          contactPhone: header.contactPhone ?? null,
          lines: {
            create: lines.map((line) => {
              const poLine = poLineById.get(line.poLineItemId);
              const isDamaged = line.outcome === DeliveryOutcome.DAMAGED;
              return {
                poLineItemId: line.poLineItemId,
                materialId: poLine?.materialId ?? null,
                quantityOrdered: poLine?.quantityOrdered ?? 0,
                quantityReceived: line.quantityReceived,
                outcome: line.outcome,
                notes: line.notes ?? null,
                damagedQuantity: isDamaged ? (line.damagedQuantity ?? 0) : null,
                damageType: isDamaged ? (line.damageType ?? null) : null,
                damageDisposition: isDamaged ? (line.damageDisposition ?? null) : null,
              };
            }),
          },
        },
        select: { id: true },
      });
    });

    await this.audit(AuditAction.DELIVERY_REPORT_CREATED, created.id, submitter.userId, {
      purchaseOrderId: po.id,
      source,
    });

    return created.id;
  }

  // ── Approve (SUBMITTED → APPROVED) ────────────────────────────────────────────

  /**
   * Approve a submitted report: flow the per-line received quantities onto the PO
   * lines + inventory (advancing PO status), then mark the report APPROVED.
   *
   * Idempotency is enforced INSIDE the transaction by re-reading the report
   * status (the line bump is an absolute write and inventory is append-only, so a
   * concurrent / double approve must be defeated here). Delta math per line:
   *   • NOT_DELIVERED / REJECTED                 → 0
   *   • DAMAGED + RETURNED                       → quantityReceived − damagedQuantity
   *   • everything else (incl. DAMAGED+ACCEPTED) → quantityReceived  (over-receipt allowed)
   */
  async approve(id: string, user: AuthenticatedUser): Promise<DeliveryReportDetailResponse> {
    const report = await this.prisma.deliveryReport.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        companyId: true,
        purchaseOrderId: true,
        lines: {
          select: {
            poLineItemId: true,
            quantityReceived: true,
            outcome: true,
            damagedQuantity: true,
            damageDisposition: true,
          },
        },
      },
    });
    if (!report) throw new NotFoundException('Delivery report not found');
    this.assertCompanyAccess(user, report.companyId);
    if (report.status !== DeliveryReportStatus.SUBMITTED) {
      throw new BadRequestException('Only a submitted delivery report can be approved.');
    }

    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: report.purchaseOrderId },
      select: {
        id: true,
        status: true,
        companyId: true,
        deliveryLocationId: true,
        lineItems: {
          select: {
            id: true,
            quantityOrdered: true,
            quantityDelivered: true,
            materialId: true,
            deliveryLocationId: true,
          },
        },
      },
    });
    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    // Build per-line received deltas from the report outcomes.
    const deltas = this.buildApprovalDeltas(report.lines);

    const outcome = await this.prisma.$transaction(async (tx) => {
      // Re-read status inside the tx — defeats a concurrent/double approve.
      const fresh = await tx.deliveryReport.findUnique({
        where: { id },
        select: { status: true },
      });
      if (fresh?.status !== DeliveryReportStatus.SUBMITTED) {
        throw new BadRequestException('Only a submitted delivery report can be approved.');
      }

      const deltaOutcome = await this.poStatusService.applyDeliveryDeltasInTx(
        tx,
        po as DeliveryDeltaPo,
        deltas,
        user.id,
      );

      await tx.deliveryReport.update({
        where: { id },
        data: {
          status: DeliveryReportStatus.APPROVED,
          reviewedByUserId: user.id,
          reviewedAt: new Date(),
        },
      });

      return deltaOutcome;
    });

    // Best-effort audits after commit.
    await this.poStatusService.auditDeliveryTransition(po.id, user.id, outcome, {
      deliveryReportId: id,
    });
    await this.audit(AuditAction.DELIVERY_REPORT_APPROVED, id, user.id, {
      purchaseOrderId: po.id,
      poTransitioned: outcome.transitioned,
      poStatus: outcome.nextStatus,
    });

    return this.get(id, user);
  }

  // ── Reject (SUBMITTED → REJECTED) ─────────────────────────────────────────────

  async reject(
    id: string,
    reason: string,
    user: AuthenticatedUser,
  ): Promise<DeliveryReportDetailResponse> {
    const report = await this.prisma.deliveryReport.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true, purchaseOrderId: true },
    });
    if (!report) throw new NotFoundException('Delivery report not found');
    this.assertCompanyAccess(user, report.companyId);
    if (report.status !== DeliveryReportStatus.SUBMITTED) {
      throw new BadRequestException('Only a submitted delivery report can be rejected.');
    }

    // No inventory, no PO change — just record the rejection.
    await this.prisma.deliveryReport.update({
      where: { id },
      data: {
        status: DeliveryReportStatus.REJECTED,
        rejectionReason: reason,
        reviewedByUserId: user.id,
        reviewedAt: new Date(),
      },
    });

    await this.audit(AuditAction.DELIVERY_REPORT_REJECTED, id, user.id, {
      purchaseOrderId: report.purchaseOrderId,
      reason,
    });

    return this.get(id, user);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /** Per-line received delta for the approval close-out (see approve() doc). */
  private buildApprovalDeltas(
    lines: Array<{
      poLineItemId: string;
      quantityReceived: number;
      outcome: DeliveryOutcome;
      damagedQuantity: number | null;
      damageDisposition: DamageDisposition | null;
    }>,
  ): Map<string, number> {
    const deltas = new Map<string, number>();
    for (const line of lines) {
      let delta: number;
      if (
        line.outcome === DeliveryOutcome.NOT_DELIVERED ||
        line.outcome === DeliveryOutcome.REJECTED
      ) {
        delta = 0;
      } else if (
        line.outcome === DeliveryOutcome.DAMAGED &&
        line.damageDisposition === DamageDisposition.RETURNED
      ) {
        delta = line.quantityReceived - (line.damagedQuantity ?? 0);
      } else {
        delta = line.quantityReceived;
      }
      // Several report lines could reference the same PO line — accumulate.
      const clamped = Math.max(0, delta);
      deltas.set(line.poLineItemId, (deltas.get(line.poLineItemId) ?? 0) + clamped);
    }
    return deltas;
  }

  /**
   * Next "DR-00001" report number for a company, sequential by existing report
   * count. Mirrors MaterialRequestsService.nextMrNumber; run inside the create
   * transaction so the count + insert are consistent.
   */
  async nextReportNumber(
    companyId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    const count = await tx.deliveryReport.count({ where: { companyId } });
    return `DR-${String(count + 1).padStart(5, '0')}`;
  }

  /** A delivery may be recorded against a PO only in a deliverable status. */
  isDeliverable(status: string): boolean {
    return (DELIVERABLE_PO_STATUSES as readonly string[]).includes(status);
  }

  /**
   * Each report line must reference a PO line on the PO, carry a non-negative
   * received quantity, and — when DAMAGED — a damaged quantity that does not
   * exceed what was received, plus a damage type + disposition.
   */
  private validateLines(lines: DeliveryLineInput[], poLines: Array<{ id: string }>): void {
    if (lines.length === 0)
      throw new BadRequestException('At least one delivery line is required.');
    const poLineIds = new Set(poLines.map((li) => li.id));
    for (const line of lines) {
      if (!poLineIds.has(line.poLineItemId)) {
        throw new BadRequestException(`Line ${line.poLineItemId} does not belong to this PO.`);
      }
      if (line.quantityReceived < 0) {
        throw new BadRequestException('Received quantity cannot be negative.');
      }
      if (line.outcome === DeliveryOutcome.DAMAGED) {
        if (
          line.damagedQuantity === null ||
          line.damagedQuantity === undefined ||
          line.damagedQuantity < 0
        ) {
          throw new BadRequestException('A damaged line requires a non-negative damaged quantity.');
        }
        if (line.damagedQuantity > line.quantityReceived) {
          throw new BadRequestException('Damaged quantity cannot exceed received quantity.');
        }
        if (!line.damageType) {
          throw new BadRequestException('A damaged line requires a damage type.');
        }
        if (!line.damageDisposition) {
          throw new BadRequestException('A damaged line requires a damage disposition.');
        }
      }
    }
  }

  /** Human invoice reference derived from the invoice id (no canonical number column). */
  private invoiceRef(invoiceId: string): string {
    return `INV-${invoiceId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }

  private assertCompanyAccess(user: AuthenticatedUser, companyId: string): void {
    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }
  }

  /** Best-effort audit — never throws (fire-and-forget like the PO/MR modules). */
  private async audit(
    action: AuditAction,
    reportId: string,
    performedById: string | null,
    metadata?: Prisma.InputJsonObject,
  ): Promise<void> {
    // The audit log requires a performer; portal (no-account) creates carry none,
    // so skip the audit row in that case rather than fabricate a user.
    if (!performedById) return;
    try {
      await this.auditService.log({
        action,
        performedById,
        targetType: 'DeliveryReport',
        targetId: reportId,
        metadata: metadata ?? {},
      });
    } catch (err) {
      this.logger.debug(
        `Failed to audit delivery ${action} on ${reportId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // ── Serialisers ──────────────────────────────────────────────────────────────

  private async toDetail(report: ReportWithRelations): Promise<DeliveryReportDetailResponse> {
    const lines = await Promise.all(report.lines.map((line) => this.toLineResponse(line)));
    const attachments = await Promise.all(
      report.attachments.map(async (att) => ({
        id: att.id,
        fileId: att.fileId,
        fileName: att.file.filename,
        url: await this.signedUrlOrNull(att.file.key),
        sizeBytes: att.file.size,
        mimeType: att.file.mimeType,
        uploadedAt: att.createdAt.toISOString(),
      })),
    );

    return {
      id: report.id,
      reportNumber: report.reportNumber,
      status: report.status as DeliveryReportStatusContract,
      source: report.source as DeliveryReportSourceContract,
      purchaseOrderId: report.purchaseOrderId,
      poNumber: report.purchaseOrder.poNumber,
      projectId: report.projectId,
      projectName: report.project?.name ?? null,
      deliveryDate: report.deliveryDate?.toISOString() ?? null,
      deliveryLocationId: report.deliveryLocationId,
      deliveryLocationName: report.deliveryLocation
        ? (report.deliveryLocation.label ?? report.deliveryLocation.address)
        : null,
      vendorId: report.vendorId,
      vendorName: report.vendor?.legalName ?? null,
      submitterName: report.submitterName,
      submitterEmail: report.submitterEmail,
      contactPerson: report.contactPerson,
      contactPhone: report.contactPhone,
      overallNotes: report.overallNotes,
      rejectionReason: report.rejectionReason,
      reviewedByName: report.reviewer?.name ?? null,
      reviewedAt: report.reviewedAt?.toISOString() ?? null,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      lines,
      attachments,
    };
  }

  private async toLineResponse(
    line: ReportWithRelations['lines'][number],
  ): Promise<DeliveryReportLineResponse> {
    const poLine = line.poLineItem;
    const lineItemRef =
      poLine?.materialCode ?? (poLine ? `Line ${poLine.lineNumber}` : line.poLineItemId);
    const damagePhotos = await Promise.all(
      line.damagePhotos.map(async (p) => ({
        id: p.id,
        fileId: p.fileId,
        fileName: p.file.filename,
        url: await this.signedUrlOrNull(p.file.key),
      })),
    );

    return {
      id: line.id,
      poLineItemId: line.poLineItemId,
      lineItemRef,
      materialId: line.materialId,
      materialName: line.material?.name ?? poLine?.description ?? '',
      description: poLine?.description ?? null,
      uom: line.material?.uom ?? poLine?.unitOfMeasure ?? '',
      quantityOrdered: line.quantityOrdered,
      quantityReceived: line.quantityReceived,
      outcome: line.outcome as DeliveryOutcomeContract,
      notes: line.notes,
      damagedQuantity: line.damagedQuantity,
      damageType: line.damageType as DamageTypeContract | null,
      damageDisposition: line.damageDisposition as DamageDispositionContract | null,
      damagePhotos,
    };
  }

  private async signedUrlOrNull(key: string): Promise<string | null> {
    try {
      return await this.storageService.getSignedUrl(key);
    } catch {
      return null;
    }
  }
}
