import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccessTokenPurpose,
  AccessTokenSubject,
  AuditAction,
  DiscountType,
  Prisma,
  QuoteAuditAction,
  QuoteLineItemAvailability,
  QuoteResponseStatus,
  QuoteSource,
  RfqStatus,
  UserRole,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessTokensService } from '../access-tokens/access-tokens.service';
import { AuditService } from '../audit/audit.service';
import { DocIntelligenceService } from '../doc-intelligence/doc-intelligence.service';
import { StorageService } from '../storage/storage.service';

import { buildQuoteComparison } from './quote-comparison';
import type {
  SubmitQuoteDto,
  UpdateQuoteDto,
  UpdateQuoteLineItemStatusDto,
} from './quote-response.dto';

/** Statuses that block vendor quote submission / update */
const CLOSED_STATUSES: RfqStatus[] = [RfqStatus.CLOSED, RfqStatus.CANCELLED];

/** Statuses that allow vendor quote submission */
const OPEN_STATUSES: RfqStatus[] = [RfqStatus.OPEN, RfqStatus.AWAITING_RESPONSE];

@Injectable()
export class QuoteResponseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessTokens: AccessTokensService,
    private readonly storageService: StorageService,
    private readonly docIntelligence: DocIntelligenceService,
  ) {}

  /** Standard relation graph returned by every quote create/update path. */
  private static readonly QUOTE_WRITE_INCLUDE = {
    lineItems: {
      include: {
        rfqLineItem: {
          include: { material: { select: { id: true, name: true, uom: true } } },
        },
        substituteItem: { select: { id: true, name: true, uom: true } },
      },
    },
    attachments: {
      include: { file: { select: { id: true, filename: true, mimeType: true, size: true } } },
    },
    vendor: { select: { id: true, legalName: true } },
  } as const;

  // ── Shared quote persistence (FOR-207) ───────────────────────────────────────

  /**
   * Build the full set of quote line items (submitted items + NO_QUOTE fillers
   * for RFQ items the vendor skipped) and the derived totals. Shared by every
   * submission path so the form (B4) and PDF (B5) flows compute quotes
   * identically.
   */
  private buildQuoteWriteData(rfqLineItemIds: string[], dto: SubmitQuoteDto) {
    const submittedLineItemIds = new Set(dto.lineItems.map((li) => li.rfqLineItemId));

    const lineItemsData = dto.lineItems.map((li) => ({
      rfqLineItemId: li.rfqLineItemId,
      unitPrice: li.unitPrice,
      quotedQuantity: li.quotedQuantity,
      availability:
        (li.availability as QuoteLineItemAvailability) ?? QuoteLineItemAvailability.AVAILABLE,
      deliveryDate: new Date(li.deliveryDate),
      substituteItemId: li.substituteItemId,
      discount: li.discount,
      discountType: li.discountType,
      tax: li.tax,
      taxIncluded: li.taxIncluded ?? false,
      backOrderQty: li.backOrderQty,
      backOrderDeliveryDate: li.backOrderDeliveryDate
        ? new Date(li.backOrderDeliveryDate)
        : undefined,
      notes: li.notes,
      lineTotal: this.calculateLineTotal(
        li.quotedQuantity,
        li.unitPrice,
        li.discount,
        li.discountType,
      ),
    }));

    const noQuoteItems = rfqLineItemIds
      .filter((id) => !submittedLineItemIds.has(id))
      .map((rfqLineItemId) => ({
        rfqLineItemId,
        unitPrice: 0,
        quotedQuantity: 0,
        availability: QuoteLineItemAvailability.NO_QUOTE,
        deliveryDate: new Date(),
        lineTotal: 0,
      }));

    const allLineItems = [...lineItemsData, ...noQuoteItems];
    const sumLineTotals = allLineItems.reduce((sum, li) => sum + Number(li.lineTotal), 0);
    const totalCost = sumLineTotals + (dto.bulkShipment ?? 0);
    const itemsCovered = dto.lineItems.filter(
      (li) => (li.availability ?? 'AVAILABLE') !== 'NO_QUOTE',
    ).length;

    return { allLineItems, totalCost, itemsCovered, totalItems: rfqLineItemIds.length };
  }

  /** Scalar fields applied to a QuoteResponse on both create and update. */
  private buildQuoteScalars(dto: SubmitQuoteDto) {
    return {
      bulkDeliveryTime: dto.bulkDeliveryTime ? new Date(dto.bulkDeliveryTime) : null,
      bulkDiscount: dto.bulkDiscount ?? null,
      bulkTax: dto.bulkTax ?? null,
      bulkShipment: dto.bulkShipment ?? null,
      warehouseLocationId: dto.warehouseLocationId ?? null,
      validityPeriod: dto.validityPeriod ? new Date(dto.validityPeriod) : null,
      paymentTerms: dto.paymentTerms ?? null,
      message: dto.message ?? null,
    };
  }

  /** Compact, queryable snapshot of a quote's money + per-line figures. */
  private buildQuoteSnapshot(quote: {
    totalCost: Prisma.Decimal | number;
    itemsCovered: number;
    totalItems: number;
    bulkDiscount: Prisma.Decimal | number | null;
    bulkTax: Prisma.Decimal | number | null;
    bulkShipment: Prisma.Decimal | number | null;
    lineItems: Array<{
      rfqLineItemId: string;
      unitPrice: Prisma.Decimal | number;
      quotedQuantity: number;
      lineTotal: Prisma.Decimal | number;
    }>;
  }) {
    return {
      totalCost: Number(quote.totalCost),
      itemsCovered: quote.itemsCovered,
      totalItems: quote.totalItems,
      bulkDiscount: quote.bulkDiscount === null ? null : Number(quote.bulkDiscount),
      bulkTax: quote.bulkTax === null ? null : Number(quote.bulkTax),
      bulkShipment: quote.bulkShipment === null ? null : Number(quote.bulkShipment),
      lineItems: quote.lineItems.map((li) => ({
        rfqLineItemId: li.rfqLineItemId,
        unitPrice: Number(li.unitPrice),
        quotedQuantity: li.quotedQuantity,
        lineTotal: Number(li.lineTotal),
      })),
    };
  }

  /**
   * Diff a vendor's edits during confirmation: which scalar fields changed and
   * how many line items were added / removed / repriced between the previously
   * persisted quote and the new one. Drives the "edits made during confirmation"
   * part of the audit trail.
   */
  private diffQuoteSnapshots(
    before: ReturnType<QuoteResponseService['buildQuoteSnapshot']>,
    after: ReturnType<QuoteResponseService['buildQuoteSnapshot']>,
  ) {
    const fields: Record<string, { from: unknown; to: unknown }> = {};
    const scalarKeys = [
      'totalCost',
      'itemsCovered',
      'bulkDiscount',
      'bulkTax',
      'bulkShipment',
    ] as const;
    for (const key of scalarKeys) {
      if (before[key] !== after[key]) fields[key] = { from: before[key], to: after[key] };
    }

    const beforeById = new Map(before.lineItems.map((li) => [li.rfqLineItemId, li]));
    const afterById = new Map(after.lineItems.map((li) => [li.rfqLineItemId, li]));
    let changed = 0;
    let added = 0;
    let removed = 0;
    for (const [id, a] of afterById) {
      const b = beforeById.get(id);
      if (!b) {
        added += 1;
      } else if (b.unitPrice !== a.unitPrice || b.quotedQuantity !== a.quotedQuantity) {
        changed += 1;
      }
    }
    for (const id of beforeById.keys()) {
      if (!afterById.has(id)) removed += 1;
    }

    return { fields, lineItems: { changed, added, removed }, snapshot: after };
  }

  /**
   * The single write path for every quote submission / revision. Builds line
   * items + totals, writes the QuoteResponse (create or full-replace update) and
   * a {@link QuoteAuditAction} entry in one transaction, and runs an optional
   * in-transaction hook (used by the guest path to burn its invitation token).
   */
  private async persistQuote(params: {
    mode: 'create' | 'update';
    rfqId: string;
    vendorId: string;
    rfqLineItemIds: string[];
    dto: SubmitQuoteDto;
    source: QuoteSource;
    actor: { userId: string | null; label: string | null };
    quoteId?: string;
    previousSnapshot?: ReturnType<QuoteResponseService['buildQuoteSnapshot']>;
    afterWrite?: (tx: Prisma.TransactionClient) => Promise<void>;
  }) {
    const { allLineItems, totalCost, itemsCovered, totalItems } = this.buildQuoteWriteData(
      params.rfqLineItemIds,
      params.dto,
    );
    const scalars = this.buildQuoteScalars(params.dto);

    return this.prisma.$transaction(async (tx) => {
      let quote: Prisma.QuoteResponseGetPayload<{
        include: typeof QuoteResponseService.QUOTE_WRITE_INCLUDE;
      }>;

      if (params.mode === 'create') {
        quote = await tx.quoteResponse.create({
          data: {
            rfqId: params.rfqId,
            vendorId: params.vendorId,
            status: QuoteResponseStatus.SUBMITTED,
            source: params.source,
            totalCost,
            itemsCovered,
            totalItems,
            submittedAt: new Date(),
            ...scalars,
            lineItems: { createMany: { data: allLineItems } },
            attachments: params.dto.attachmentIds?.length
              ? { create: params.dto.attachmentIds.map((fileId) => ({ fileId })) }
              : undefined,
          },
          include: QuoteResponseService.QUOTE_WRITE_INCLUDE,
        });
      } else {
        const quoteId = params.quoteId as string;
        await tx.quoteResponseLineItem.deleteMany({ where: { quoteResponseId: quoteId } });
        await tx.quoteAttachment.deleteMany({ where: { quoteResponseId: quoteId } });
        await tx.quoteResponseLineItem.createMany({
          data: allLineItems.map((li) => ({ ...li, quoteResponseId: quoteId })),
        });
        if (params.dto.attachmentIds?.length) {
          await tx.quoteAttachment.createMany({
            data: params.dto.attachmentIds.map((fileId) => ({ quoteResponseId: quoteId, fileId })),
          });
        }
        quote = await tx.quoteResponse.update({
          where: { id: quoteId },
          data: { totalCost, itemsCovered, totalItems, ...scalars },
          include: QuoteResponseService.QUOTE_WRITE_INCLUDE,
        });
      }

      const snapshot = this.buildQuoteSnapshot(quote);
      const changes =
        params.mode === 'update' && params.previousSnapshot
          ? this.diffQuoteSnapshots(params.previousSnapshot, snapshot)
          : { snapshot };

      await tx.quoteAudit.create({
        data: {
          quoteResponseId: quote.id,
          rfqId: params.rfqId,
          vendorId: params.vendorId,
          action: params.mode === 'create' ? QuoteAuditAction.SUBMITTED : QuoteAuditAction.UPDATED,
          source: params.source,
          performedById: params.actor.userId,
          performedByLabel: params.actor.label,
          changes: changes as Prisma.InputJsonValue,
        },
      });

      if (params.afterWrite) await params.afterWrite(tx);

      return quote;
    });
  }

  // ── Submit Quote ────────────────────────────────────────────────────────────

  async submitQuote(rfqId: string, dto: SubmitQuoteDto, user: AuthenticatedUser) {
    const vendorCompanyId = this.assertVendorRole(user);

    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      include: { lineItems: true, invitedVendors: true },
    });

    if (!rfq) throw new NotFoundException(ERR.rfqs.notFound);

    // Vendor's company must be invited
    if (!rfq.invitedVendors.some((v) => v.vendorId === vendorCompanyId)) {
      throw new ForbiddenException(ERR.quotes.notInvited);
    }

    // RFQ must be open for quoting
    if (!OPEN_STATUSES.includes(rfq.status)) {
      throw new BadRequestException(`Cannot submit quote: RFQ status is ${rfq.status}`);
    }

    // Check no existing SUBMITTED quote from this vendor
    const existingQuote = await this.prisma.quoteResponse.findFirst({
      where: {
        rfqId,
        vendorId: vendorCompanyId,
        status: QuoteResponseStatus.SUBMITTED,
      },
    });

    if (existingQuote) {
      throw new BadRequestException(
        'A submitted quote already exists for this RFQ from your company',
      );
    }

    const result = await this.persistQuote({
      mode: 'create',
      rfqId,
      vendorId: vendorCompanyId,
      rfqLineItemIds: rfq.lineItems.map((li) => li.id),
      dto,
      source: dto.source ?? QuoteSource.FORM,
      actor: { userId: user.id, label: null },
    });

    await this.auditService.log({
      action: AuditAction.QUOTE_SUBMITTED,
      performedById: user.id,
      targetType: 'QuoteResponse',
      targetId: result.id,
      targetLabel: `Quote for RFQ ${rfqId}`,
      metadata: { rfqId, vendorId: vendorCompanyId },
    });

    return result;
  }

  // ── Update Quote ────────────────────────────────────────────────────────────

  async updateQuote(rfqId: string, quoteId: string, dto: UpdateQuoteDto, user: AuthenticatedUser) {
    const vendorCompanyId = this.assertVendorRole(user);

    const quote = await this.prisma.quoteResponse.findUnique({
      where: { id: quoteId },
      include: {
        lineItems: true,
        rfq: { include: { lineItems: true } },
      },
    });

    if (!quote) throw new NotFoundException(ERR.rfqs.quoteNotFound);

    // Validate ownership
    if (quote.vendorId !== vendorCompanyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    // Validate RFQ not closed
    if (CLOSED_STATUSES.includes(quote.rfq.status)) {
      throw new BadRequestException(`Cannot update quote: RFQ status is ${quote.rfq.status}`);
    }

    // Snapshot the quote before the rewrite so the audit trail can record the
    // vendor's edits made during confirmation.
    const previousSnapshot = this.buildQuoteSnapshot(quote);

    const result = await this.persistQuote({
      mode: 'update',
      quoteId,
      rfqId,
      vendorId: vendorCompanyId,
      rfqLineItemIds: quote.rfq.lineItems.map((li) => li.id),
      dto,
      source: dto.source ?? quote.source,
      actor: { userId: user.id, label: null },
      previousSnapshot,
    });

    await this.auditService.log({
      action: AuditAction.QUOTE_UPDATED,
      performedById: user.id,
      targetType: 'QuoteResponse',
      targetId: result.id,
      targetLabel: `Quote ${quoteId} for RFQ ${rfqId}`,
      metadata: { rfqId, quoteId, vendorId: vendorCompanyId },
    });

    return result;
  }

  // ── Get Quote Detail ────────────────────────────────────────────────────────

  async getQuoteDetail(rfqId: string, quoteId: string, user: AuthenticatedUser) {
    const quote = await this.prisma.quoteResponse.findUnique({
      where: { id: quoteId },
      include: {
        lineItems: {
          include: {
            rfqLineItem: { include: { material: { select: { id: true, name: true, uom: true } } } },
            substituteItem: { select: { id: true, name: true, uom: true } },
          },
        },
        attachments: {
          include: { file: { select: { id: true, filename: true, mimeType: true, size: true } } },
        },
        vendor: { select: { id: true, legalName: true } },
        rfq: { select: { id: true, companyId: true, rfqNumber: true } },
        warehouseLocation: true,
      },
    });

    if (!quote || quote.rfqId !== rfqId) {
      throw new NotFoundException(ERR.rfqs.quoteNotFound);
    }

    // Access control: vendor who submitted OR contractor of the RFQ's company
    const isVendorOwner = user.role === UserRole.VENDOR && quote.vendorId === user.companyId;
    const isContractor =
      (user.role === UserRole.COMPANY_ADMIN || user.role === UserRole.PROCUREMENT_OFFICER) &&
      quote.rfq.companyId === user.companyId;

    if (!isVendorOwner && !isContractor) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    // Convert Prisma Decimal fields to plain numbers and flatten nested objects
    return {
      ...quote,
      totalCost: Number(quote.totalCost),
      discountPercent: quote.discountPercent !== null ? Number(quote.discountPercent) : null,
      discountAmount: quote.discountAmount !== null ? Number(quote.discountAmount) : null,
      bulkDiscount: quote.bulkDiscount !== null ? Number(quote.bulkDiscount) : null,
      bulkTax: quote.bulkTax !== null ? Number(quote.bulkTax) : null,
      bulkShipment: quote.bulkShipment !== null ? Number(quote.bulkShipment) : null,
      lineItems: quote.lineItems.map((li) => ({
        ...li,
        unitPrice: Number(li.unitPrice),
        discount: li.discount !== null ? Number(li.discount) : null,
        tax: li.tax !== null ? Number(li.tax) : null,
        lineTotal: Number(li.lineTotal),
      })),
      attachments: quote.attachments.map((a) => ({
        id: a.id,
        fileId: a.file.id,
        filename: a.file.filename,
        mimeType: a.file.mimeType,
        size: a.file.size,
      })),
    };
  }

  // ── Quote Audit Trail (FOR-207) ───────────────────────────────────────────────

  /**
   * Return the per-RFQ quote audit trail for the RFQ detail view. A contractor
   * of the RFQ's company sees every vendor's entries; a vendor sees only their
   * own company's. Anyone else is denied.
   */
  async getQuoteAudit(rfqId: string, user: AuthenticatedUser) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      select: { id: true, companyId: true },
    });
    if (!rfq) throw new NotFoundException(ERR.rfqs.notFound);

    const isContractor =
      (user.role === UserRole.COMPANY_ADMIN || user.role === UserRole.PROCUREMENT_OFFICER) &&
      rfq.companyId === user.companyId;
    const isVendor = user.role === UserRole.VENDOR && !!user.companyId;

    if (!isContractor && !isVendor) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    const audits = await this.prisma.quoteAudit.findMany({
      where: {
        rfqId,
        // Vendors are scoped to their own company's entries.
        ...(isContractor ? {} : { vendorId: user.companyId as string }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        performedBy: { select: { id: true, name: true } },
        quoteResponse: { select: { id: true, vendor: { select: { id: true, legalName: true } } } },
      },
    });

    return audits.map((a) => ({
      id: a.id,
      quoteResponseId: a.quoteResponseId,
      action: a.action,
      source: a.source,
      vendorId: a.vendorId,
      vendorName: a.quoteResponse.vendor.legalName,
      // Authed users surface their account name; guest submits fall back to the
      // vendor label captured at submit time, then the vendor's legal name.
      performedByName:
        a.performedBy?.name ?? a.performedByLabel ?? a.quoteResponse.vendor.legalName,
      changes: a.changes,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  // ── Quote Comparison (FOR-208) ───────────────────────────────────────────────

  /**
   * Quote statuses that count as "received" for the contractor's comparison view.
   * Declined quotes stay visible — the review-quotes table keeps them in their
   * own filter section so the buyer can restore them (US 5.06).
   */
  private static readonly COMPARISON_STATUSES: QuoteResponseStatus[] = [
    QuoteResponseStatus.SUBMITTED,
    QuoteResponseStatus.APPROVED,
    QuoteResponseStatus.DECLINED,
  ];

  /**
   * Aggregate every received quote for an RFQ into a side-by-side comparison
   * grid (rows = line items, columns = vendors) with the lowest extended cost
   * per line flagged and per-vendor totals. Contractor-only: vendors must never
   * see competitors' pricing, so this is scoped to the RFQ's owning company.
   */
  async getQuoteComparison(rfqId: string, user: AuthenticatedUser) {
    const rfq = await this.prisma.rfq.findUnique({
      where: { id: rfqId },
      select: {
        id: true,
        companyId: true,
        currency: true,
        projectId: true,
        project: { select: { name: true } },
        lineItems: {
          select: {
            id: true,
            materialName: true,
            material: { select: { name: true } },
            quantity: true,
            unit: true,
            projectId: true,
            project: { select: { name: true } },
          },
        },
      },
    });
    if (!rfq) throw new NotFoundException(ERR.rfqs.notFound);

    const isContractor =
      (user.role === UserRole.COMPANY_ADMIN || user.role === UserRole.PROCUREMENT_OFFICER) &&
      rfq.companyId === user.companyId;
    if (!isContractor) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    const quotes = await this.prisma.quoteResponse.findMany({
      where: { rfqId, status: { in: QuoteResponseService.COMPARISON_STATUSES } },
      orderBy: { submittedAt: 'asc' },
      select: {
        id: true,
        vendorId: true,
        status: true,
        submittedAt: true,
        paymentTerms: true,
        bulkDeliveryTime: true,
        totalCost: true,
        discountPercent: true,
        discountAmount: true,
        bulkShipment: true,
        vendor: { select: { legalName: true } },
        _count: { select: { attachments: true } },
        lineItems: {
          select: {
            id: true,
            rfqLineItemId: true,
            unitPrice: true,
            quotedQuantity: true,
            availability: true,
            deliveryDate: true,
            discount: true,
            discountType: true,
            lineTotal: true,
            status: true,
            notes: true,
            substituteItemId: true,
            substituteItem: { select: { name: true } },
          },
        },
      },
    });

    return buildQuoteComparison(
      {
        id: rfq.id,
        currency: rfq.currency,
        projectId: rfq.projectId,
        projectName: rfq.project.name,
        lineItems: rfq.lineItems.map((li) => ({
          id: li.id,
          materialName: li.materialName ?? li.material?.name ?? null,
          quantity: li.quantity,
          unit: li.unit,
          projectId: li.projectId,
          projectName: li.project?.name ?? null,
        })),
      },
      quotes.map((q) => ({
        id: q.id,
        vendorId: q.vendorId,
        vendorName: q.vendor.legalName,
        status: q.status,
        submittedAt: q.submittedAt,
        paymentTerms: q.paymentTerms,
        bulkDeliveryTime: q.bulkDeliveryTime,
        totalCost: Number(q.totalCost),
        discountPercent: q.discountPercent !== null ? Number(q.discountPercent) : null,
        discountAmount: q.discountAmount !== null ? Number(q.discountAmount) : null,
        bulkShipment: q.bulkShipment !== null ? Number(q.bulkShipment) : null,
        attachmentCount: q._count.attachments,
        lineItems: q.lineItems.map((li) => ({
          id: li.id,
          rfqLineItemId: li.rfqLineItemId,
          unitPrice: Number(li.unitPrice),
          quotedQuantity: li.quotedQuantity,
          availability: li.availability,
          deliveryDate: li.deliveryDate,
          discount: li.discount !== null ? Number(li.discount) : null,
          discountType: li.discountType,
          lineTotal: Number(li.lineTotal),
          status: li.status,
          notes: li.notes,
          substituteItemId: li.substituteItemId,
          substituteItemName: li.substituteItem?.name ?? null,
        })),
      })),
    );
  }

  // ── Per-line review status (US 5.19 — approve line items) ───────────────────

  /**
   * Set the review status of one or more lines on a vendor quote
   * (approve / decline / restore-to-pending). Contractor-only: this is the
   * buyer's line-level review of a received quote, recorded on the quote audit
   * trail as an UPDATED entry carrying the affected line ids.
   */
  async updateQuoteLineItemStatuses(
    rfqId: string,
    quoteId: string,
    dto: UpdateQuoteLineItemStatusDto,
    user: AuthenticatedUser,
  ) {
    const quote = await this.prisma.quoteResponse.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        rfqId: true,
        vendorId: true,
        source: true,
        rfq: { select: { companyId: true } },
        lineItems: { select: { id: true } },
      },
    });
    if (quote?.rfqId !== rfqId) {
      throw new NotFoundException(ERR.rfqs.quoteNotFound);
    }

    const isContractor =
      (user.role === UserRole.COMPANY_ADMIN || user.role === UserRole.PROCUREMENT_OFFICER) &&
      quote.rfq.companyId === user.companyId;
    if (!isContractor) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    const known = new Set(quote.lineItems.map((li) => li.id));
    const unknown = dto.lineItemIds.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new NotFoundException(ERR.rfqs.quoteLineItemNotFound);
    }

    const lineItems = await this.prisma.$transaction(async (tx) => {
      await tx.quoteResponseLineItem.updateMany({
        where: { id: { in: dto.lineItemIds }, quoteResponseId: quoteId },
        data: { status: dto.status },
      });

      await tx.quoteAudit.create({
        data: {
          quoteResponseId: quoteId,
          rfqId,
          vendorId: quote.vendorId,
          action: QuoteAuditAction.UPDATED,
          source: quote.source,
          performedById: user.id,
          changes: { lineItemStatus: { ids: dto.lineItemIds, status: dto.status } },
        },
      });

      return tx.quoteResponseLineItem.findMany({
        where: { id: { in: dto.lineItemIds } },
        select: { id: true, status: true },
      });
    });

    return { updated: lineItems.length, lineItems };
  }

  // ── Guest (invitation link) access ──────────────────────────────────────────

  /**
   * Prisma include for the RFQ scope shown on / submitted from the guest portal.
   * `documents.file` carries the storage key used to mint signed download URLs.
   */
  private static readonly GUEST_RFQ_VENDOR_INCLUDE = {
    rfq: {
      include: {
        lineItems: {
          include: { material: { select: { id: true, name: true, uom: true } } },
        },
        project: { select: { name: true } },
        company: { select: { legalName: true } },
        deliveryLocation: true,
        documents: {
          include: {
            file: { select: { id: true, key: true, filename: true, mimeType: true, size: true } },
          },
          orderBy: { createdAt: 'desc' as const },
        },
      },
    },
    vendor: { select: { id: true, legalName: true } },
  } as const;

  /**
   * Resolve a vendor invitation via the A15 access-token system. Validates the
   * token (purpose QUOTE_SUBMIT, subject RFQ) — bumping its attempt counter and
   * rejecting expired/used/revoked tokens — then loads the invited vendor + RFQ
   * scope. Does NOT consume the token; callers burn it after a successful submit.
   */
  private async resolveInvitationToken(token: string) {
    const tokenRecord = await this.accessTokens.validateToken(token, {
      expectedPurpose: AccessTokenPurpose.QUOTE_SUBMIT,
      expectedSubjectType: AccessTokenSubject.RFQ,
    });

    const metadata = (tokenRecord.metadata ?? {}) as {
      rfqVendorId?: string;
      vendorId?: string;
    };

    const where = metadata.rfqVendorId
      ? { id: metadata.rfqVendorId }
      : { rfqId_vendorId: { rfqId: tokenRecord.subjectId, vendorId: metadata.vendorId ?? '' } };

    const rfqVendor = await this.prisma.rfqVendor.findUnique({
      where,
      include: QuoteResponseService.GUEST_RFQ_VENDOR_INCLUDE,
    });

    if (!rfqVendor || rfqVendor.rfqId !== tokenRecord.subjectId) {
      throw new NotFoundException('Invalid or expired invitation token');
    }

    return { rfqVendor, tokenRecord };
  }

  async getGuestRfq(token: string) {
    const { rfqVendor } = await this.resolveInvitationToken(token);
    const rfq = rfqVendor.rfq;

    const attachments = await Promise.all(
      rfq.documents.map(async ({ file }) => ({
        id: file.id,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        url: await this.storageService.getSignedUrl(file.key),
      })),
    );

    return {
      id: rfq.id,
      rfqNumber: rfq.rfqNumber,
      contractorName: rfq.company.legalName,
      projectName: rfq.project?.name ?? null,
      status: rfq.status,
      deliveryLocation: rfq.deliveryLocation?.label ?? rfq.deliveryLocation?.address ?? null,
      needByDate: rfq.needByDate?.toISOString() ?? null,
      message: rfq.message,
      lineItems: rfq.lineItems.map((li) => ({
        id: li.id,
        materialName: li.material?.name ?? li.description ?? '',
        unit: li.unit,
        quantity: li.quantity,
        description: li.description,
        costCode: li.costCode,
      })),
      attachments,
      vendorName: rfqVendor.vendor.legalName,
      vendorId: rfqVendor.vendorId,
    };
  }

  async submitGuestQuote(token: string, dto: SubmitQuoteDto) {
    const { rfqVendor, tokenRecord } = await this.resolveInvitationToken(token);
    const rfq = rfqVendor.rfq;

    if (!OPEN_STATUSES.includes(rfq.status)) {
      throw new BadRequestException(`Cannot submit quote: RFQ status is ${rfq.status}`);
    }

    // Check for duplicate
    const existing = await this.prisma.quoteResponse.findFirst({
      where: {
        rfqId: rfq.id,
        vendorId: rfqVendor.vendorId,
        status: QuoteResponseStatus.SUBMITTED,
      },
    });
    if (existing) {
      throw new BadRequestException('A quote has already been submitted for this RFQ');
    }

    const result = await this.persistQuote({
      mode: 'create',
      rfqId: rfq.id,
      vendorId: rfqVendor.vendorId,
      rfqLineItemIds: rfq.lineItems.map((li) => li.id),
      dto,
      source: dto.source ?? QuoteSource.FORM,
      // Guest submitters have no platform account; record the vendor's legal
      // name as the actor label instead of a user id.
      actor: { userId: null, label: rfqVendor.vendor.legalName },
      // Burn the single-use token in the same transaction so a quote can never
      // be persisted without consuming its link (and vice-versa). updateMany is
      // atomic, so concurrent submits race here and only one wins.
      afterWrite: async (tx) => {
        const burned = await tx.accessToken.updateMany({
          where: { id: tokenRecord.id, usedAt: null, revokedAt: null },
          data: { usedAt: new Date() },
        });
        if (burned.count === 0) {
          throw new ForbiddenException(ERR.accessTokens.alreadyUsed);
        }
      },
    });

    // A guest submitter has no platform user account, but audit_logs.performed_by
    // is a required FK to a user. Attribute the entry to the RFQ creator and
    // record the true (guest vendor) actor in the metadata.
    await this.auditService.log({
      action: AuditAction.QUOTE_SUBMITTED,
      performedById: rfq.createdByUserId,
      targetType: 'QuoteResponse',
      targetId: result.id,
      targetLabel: `Guest quote for RFQ ${rfq.id}`,
      metadata: { rfqId: rfq.id, vendorId: rfqVendor.vendorId, guestAccess: true },
    });

    return result;
  }

  // ── Guest quote PDF extraction (FOR-206) ────────────────────────────────────

  /**
   * Start a Gemini extraction of a quote PDF a guest vendor uploaded through the
   * tokenized portal. Validates the invitation token (bumping its attempt
   * counter once) but does NOT consume it — the vendor still submits the quote
   * afterwards via {@link submitGuestQuote}. Delegates the upload + async
   * extraction to the doc-intelligence pipeline, tagging the job with the RFQ so
   * the poll endpoint can be scoped to guest quote jobs.
   */
  async createGuestQuoteExtraction(token: string, file: Express.Multer.File) {
    const { rfqVendor } = await this.resolveInvitationToken(token);
    const rfq = rfqVendor.rfq;

    if (!OPEN_STATUSES.includes(rfq.status)) {
      throw new BadRequestException(`Cannot submit quote: RFQ status is ${rfq.status}`);
    }

    return this.docIntelligence.createGuestQuoteExtraction({
      file,
      rfqId: rfq.id,
      attributedUserId: rfq.createdByUserId,
      companyId: rfq.companyId,
    });
  }

  /**
   * Poll a guest quote extraction by its (unguessable) id. Intentionally
   * token-less: `validateToken` bumps the attempt counter on every call, which a
   * 1.5s status poll over a 30–60s Gemini run would quickly exhaust. The
   * extraction id is a server-minted UUID and the job only ever holds the
   * vendor's own uploaded quote data, so addressing by id is sufficient.
   */
  getGuestQuoteExtraction(id: string) {
    return this.docIntelligence.getGuestQuoteExtraction(id);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private assertVendorRole(user: AuthenticatedUser): string {
    if (user.role !== UserRole.VENDOR) {
      throw new ForbiddenException(ERR.quotes.onlyVendor);
    }
    if (!user.companyId) {
      throw new ForbiddenException(ERR.quotes.vendorNoCompany);
    }
    return user.companyId;
  }

  private calculateLineTotal(
    quantity: number,
    unitPrice: number,
    discount?: number,
    discountType?: DiscountType,
  ): number {
    const subtotal = quantity * unitPrice;
    if (!discount || !discountType) return subtotal;

    if (discountType === DiscountType.PERCENT) {
      return subtotal * (1 - discount / 100);
    }
    if (discountType === DiscountType.AMOUNT) {
      return subtotal - discount;
    }
    return subtotal;
  }
}
