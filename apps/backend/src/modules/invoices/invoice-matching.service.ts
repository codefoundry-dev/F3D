import {
  isInvoiceExtractionResult,
  type PreviewInvoicePoMatchDto,
  type InvoiceLineMatchFlag,
  type InvoiceMatchedPo,
  type InvoicePoDelivery,
  type InvoicePoDeliveryReport,
  type InvoicePoInfoResult,
  type InvoicePoMatchLine,
  type InvoicePoMatchPoLine,
  type InvoicePoMatchResult,
  type InvoicePoMatchThresholds,
} from '@forethread/shared-types';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocExtractionType, UserRole } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { PoExportService } from '../purchase-orders/po-export.service';

import {
  pairLines,
  referenceMatchesPoNumber,
  type MatchableInvoiceLine,
  type MatchablePoLine,
} from './invoice-matching.util';

type PoWithLines = {
  id: string;
  poNumber: string;
  status: string;
  companyId: string;
  vendorId: string | null;
  projectId: string;
  currency: string;
  plannedDeliveryDate: Date | null;
  totalAmount: { toNumber(): number } | null;
  vendor: { legalName: string } | null;
  project: { name: string } | null;
  lineItems: {
    id: string;
    lineNumber: number;
    materialCode: string | null;
    description: string | null;
    quantityOrdered: number;
    quantityDelivered: number;
    unitOfMeasure: string;
    unitPrice: { toNumber(): number };
    lineTotal: { toNumber(): number };
    costCode: string | null;
    /** Optional so hand-built fixtures without the relation still type-check. */
    material?: { imageUrl: string | null } | null;
  }[];
};

const PO_SELECT = {
  id: true,
  poNumber: true,
  status: true,
  // Carried so a reviewer-selected PO can be proven to belong to the invoice's
  // company before anything about it is disclosed.
  companyId: true,
  vendorId: true,
  projectId: true,
  currency: true,
  plannedDeliveryDate: true,
  totalAmount: true,
  vendor: { select: { legalName: true } },
  project: { select: { name: true } },
  lineItems: {
    orderBy: { lineNumber: 'asc' as const },
    select: {
      id: true,
      lineNumber: true,
      materialCode: true,
      description: true,
      quantityOrdered: true,
      quantityDelivered: true,
      unitOfMeasure: true,
      unitPrice: true,
      lineTotal: true,
      costCode: true,
      material: { select: { imageUrl: true } },
    },
  },
};

/**
 * Invoice↔PO reconciliation (FOR-293, building on the FOR-218 three-way match
 * spec): resolve which purchase order the invoice bills against, pair each
 * saved invoice line with a PO line, and flag price variance, quantity
 * variance, and lines the PO never ordered. Nothing is persisted — the report
 * is recomputed from the reviewer's latest saved lines on every call, and the
 * reviewer confirms the PO link itself through the review form (`relatedPoId`).
 */
@Injectable()
export class InvoiceMatchingService {
  private readonly thresholds: InvoicePoMatchThresholds;

  constructor(
    private readonly prisma: PrismaService,
    private readonly poExportService: PoExportService,
    config: ConfigService,
  ) {
    // FOR-218: variance thresholds configurable — ±2% price, exact qty default.
    this.thresholds = {
      priceTolerancePct: Number(config.get('INVOICE_MATCH_PRICE_TOLERANCE_PCT') ?? 2),
      quantityTolerance: Number(config.get('INVOICE_MATCH_QTY_TOLERANCE') ?? 0),
    };
  }

  /**
   * @param poIdOverride The PO the reviewer has picked in the review form but not
   *   yet saved. Lets the form show the pairing, status and delivery progress of a
   *   PO before committing to it; ignored when it is not one of the invoice
   *   company's POs.
   * @param linesOverride The review form's current (unsaved) lines. When given,
   *   pairing and variance flags are computed against them instead of the saved
   *   invoice lines, so the comparison is live while the reviewer edits.
   */
  async getPoMatch(
    invoiceId: string,
    user: AuthenticatedUser,
    poIdOverride?: string,
    linesOverride?: PreviewInvoicePoMatchDto['lines'],
  ): Promise<InvoicePoMatchResult> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        companyId: true,
        vendorId: true,
        relatedPoId: true,
        lines: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            position: true,
            lineId: true,
            description: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException(ERR.invoices.notFound);

    // Reviewer surface: the buying company (or a super admin), never the vendor.
    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== invoice.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    const poReferences = await this.getExtractedPoReferences(invoiceId);
    const { resolution, po, poCandidates } = await this.resolvePo(
      invoice,
      poReferences,
      poIdOverride,
    );

    // Preview lines (the form's unsaved edits) stand in for the saved rows when
    // supplied; ids are synthetic since the rows don't exist yet. Blank
    // descriptions are dropped the same way the review save drops them.
    const sourceLines = linesOverride
      ? linesOverride
          .filter((line) => line.description.trim() !== '')
          .map((line, index) => ({
            id: `preview-${index}`,
            position: index,
            lineId: line.lineId ?? null,
            description: line.description,
            quantity: line.quantity ?? null,
            unitPrice: line.unitPrice ?? null,
            lineTotal: line.lineTotal ?? null,
          }))
      : invoice.lines.map((line) => ({
          id: line.id,
          position: line.position,
          lineId: line.lineId,
          description: line.description,
          quantity: line.quantity === null ? null : Number(line.quantity),
          unitPrice: line.unitPrice === null ? null : Number(line.unitPrice),
          lineTotal: line.lineTotal === null ? null : Number(line.lineTotal),
        }));

    const invoiceLines: MatchableInvoiceLine[] = sourceLines.map((line) => ({
      lineId: line.lineId,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    }));

    const poLines: MatchablePoLine[] = (po?.lineItems ?? []).map((line) => ({
      lineNumber: line.lineNumber,
      materialCode: line.materialCode,
      description: line.description,
      quantityOrdered: line.quantityOrdered,
      unitPrice: line.unitPrice.toNumber(),
    }));

    const assignments = po ? pairLines(invoiceLines, poLines) : new Map<number, never>();

    const usedPoLineIndexes = new Set<number>();
    const lines: InvoicePoMatchLine[] = sourceLines.map((line, index) => {
      const assignment = assignments.get(index);
      const poLine = assignment ? (po?.lineItems[assignment.poIndex] ?? null) : null;
      if (assignment) usedPoLineIndexes.add(assignment.poIndex);

      const { quantity, unitPrice } = line;

      const flags: InvoiceLineMatchFlag[] = [];
      let priceVariancePct: number | null = null;
      let quantityDelta: number | null = null;

      if (poLine) {
        const poUnitPrice = poLine.unitPrice.toNumber();
        if (unitPrice !== null && poUnitPrice !== 0) {
          priceVariancePct = ((unitPrice - poUnitPrice) / poUnitPrice) * 100;
          if (Math.abs(priceVariancePct) > this.thresholds.priceTolerancePct) {
            flags.push('PRICE_VARIANCE');
          }
        }
        if (quantity !== null) {
          quantityDelta = quantity - poLine.quantityOrdered;
          if (Math.abs(quantityDelta) > this.thresholds.quantityTolerance) {
            flags.push('QTY_VARIANCE');
          }
        }
      } else if (po) {
        // Only meaningful once a PO is resolved — until then no line can be
        // judged expected or unexpected.
        flags.push('NOT_ON_PO');
      }

      return {
        invoiceLineId: line.id,
        position: line.position,
        description: line.description,
        quantity,
        unitPrice,
        lineTotal: line.lineTotal,
        poLine: poLine ? toPoLineDto(poLine) : null,
        matchConfidence: assignment ? round2(assignment.score) : null,
        priceVariancePct: priceVariancePct === null ? null : round2(priceVariancePct),
        quantityDelta,
        flags,
      };
    });

    const unbilledPoLines = (po?.lineItems ?? [])
      .filter((_, index) => !usedPoLineIndexes.has(index))
      .map(toPoLineDto);

    return {
      resolution,
      po: po ? toPoDto(po) : null,
      poCandidates: poCandidates.map(toPoDto),
      poReferences,
      vendorMismatch: !!(po && invoice.vendorId && po.vendorId && po.vendorId !== invoice.vendorId),
      lines,
      poLines: (po?.lineItems ?? []).map(toPoLineDto),
      unbilledPoLines,
      thresholds: this.thresholds,
      summary: {
        lineCount: lines.length,
        matchedCount: lines.filter((line) => line.poLine !== null).length,
        priceVarianceCount: lines.filter((line) => line.flags.includes('PRICE_VARIANCE')).length,
        quantityVarianceCount: lines.filter((line) => line.flags.includes('QTY_VARIANCE')).length,
        unexpectedCount: lines.filter((line) => line.flags.includes('NOT_ON_PO')).length,
      },
    };
  }

  /**
   * The Invoice Details PO tab payload (FOR-355): the reconciliation report the
   * review form already uses, plus the delivery reports recorded against the
   * resolved PO.
   *
   * `poIdOverride` lets the tab show the PO the reviewer has picked in the
   * review form before the link is saved. Like the po-export override it stays
   * behind `invoice.read` and is company-scoped: a PO outside the invoice's
   * company is ignored (resolvePo falls back to the invoice's own resolution),
   * so it never discloses more than po-export already does.
   */
  async getPoInfo(
    invoiceId: string,
    user: AuthenticatedUser,
    poIdOverride?: string,
  ): Promise<InvoicePoInfoResult> {
    const match = await this.getPoMatch(invoiceId, user, poIdOverride);
    const deliveryReports = match.po ? await this.getDeliveryReports(match.po.id) : [];
    return { match, deliveryReports };
  }

  /**
   * Generate the system PO PDF for the invoice's resolved purchase order and
   * return its signed URL (FOR-355). Served through the invoice scope because
   * invoice viewers (finance) do not necessarily hold `po.exportSingle`.
   *
   * `poId` names the PO the tab is displaying when it is auto-matched rather
   * than saved on the invoice. Like the po-match override, a PO outside the
   * invoice's company is not the caller's to see.
   */
  async exportRelatedPoPdf(
    invoiceId: string,
    user: AuthenticatedUser,
    poId?: string,
  ): Promise<{ url: string }> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { companyId: true, relatedPoId: true },
    });
    if (!invoice) throw new NotFoundException(ERR.invoices.notFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== invoice.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    const targetPoId = poId ?? invoice.relatedPoId;
    if (!targetPoId) throw new NotFoundException(ERR.purchaseOrders.notFound);

    // The PO must belong to the invoice's company: a PO the caller could read
    // for another reason (e.g. as its vendor) is still not this invoice's PO.
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: targetPoId },
      select: { id: true, companyId: true },
    });
    if (po?.companyId !== invoice.companyId) {
      throw new NotFoundException(ERR.purchaseOrders.notFound);
    }

    return this.poExportService.exportSinglePo(po.id, 'pdf', user);
  }

  /** Delivery reports recorded against the PO, newest first, summarised to rows. */
  private async getDeliveryReports(purchaseOrderId: string): Promise<InvoicePoDeliveryReport[]> {
    const reports = await this.prisma.deliveryReport.findMany({
      where: { purchaseOrderId },
      orderBy: [{ deliveryDate: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        reportNumber: true,
        status: true,
        source: true,
        deliveryDate: true,
        submitterName: true,
        createdAt: true,
        deliveryLocation: { select: { label: true, address: true } },
        lines: { select: { quantityReceived: true } },
      },
    });

    return reports.map((report) => ({
      id: report.id,
      reportNumber: report.reportNumber,
      status: report.status as InvoicePoDeliveryReport['status'],
      source: report.source as InvoicePoDeliveryReport['source'],
      deliveryDate: report.deliveryDate ? report.deliveryDate.toISOString() : null,
      locationName: report.deliveryLocation?.label ?? report.deliveryLocation?.address ?? null,
      submitterName: report.submitterName,
      lineCount: report.lines.length,
      quantityReceived: report.lines.reduce((sum, line) => sum + line.quantityReceived, 0),
      createdAt: report.createdAt.toISOString(),
    }));
  }

  /** PO references as extracted from the document (FOR-291); [] when none. */
  private async getExtractedPoReferences(invoiceId: string): Promise<string[]> {
    const extraction = await this.prisma.docExtraction.findFirst({
      where: { invoiceId, type: DocExtractionType.INVOICE },
      orderBy: { createdAt: 'desc' },
      select: { editedResult: true },
    });
    const result = extraction?.editedResult;
    return isInvoiceExtractionResult(result) ? result.poReferences : [];
  }

  /**
   * Resolve the PO to reconcile against: a PO the reviewer has picked in the form
   * wins, then the reviewer-confirmed link, then the extracted references matched
   * against the company's PO numbers (tolerantly — "P/O 13603" cites "PO-13603").
   *
   * The automatic resolution runs first even when a selection is supplied, so a
   * selection that lands on the auto-matched PO still reports AUTO_MATCHED, and
   * the candidates of an ambiguous match survive the reviewer picking one of them
   * (the form's PO dropdown is built from them).
   */
  private async resolvePo(
    invoice: { companyId: string; relatedPoId: string | null },
    poReferences: string[],
    poIdOverride?: string,
  ): Promise<{
    resolution: InvoicePoMatchResult['resolution'];
    po: PoWithLines | null;
    poCandidates: PoWithLines[];
  }> {
    const auto = await this.autoResolvePo(invoice, poReferences);
    if (!poIdOverride || poIdOverride === auto.po?.id) return auto;

    const selected = await this.prisma.purchaseOrder.findUnique({
      where: { id: poIdOverride },
      select: PO_SELECT,
    });
    // A PO outside the invoice's company is not the reviewer's to see — fall back
    // to whatever the document itself resolved to.
    if (selected?.companyId !== invoice.companyId) return auto;

    // Always SELECTED here: a selection matching the saved link resolves to
    // LINKED inside autoResolvePo and returns above, never reaching this point.
    return { resolution: 'SELECTED', po: selected, poCandidates: auto.poCandidates };
  }

  /** The PO the invoice resolves to on its own: saved link, else extracted references. */
  private async autoResolvePo(
    invoice: { companyId: string; relatedPoId: string | null },
    poReferences: string[],
  ): Promise<{
    resolution: InvoicePoMatchResult['resolution'];
    po: PoWithLines | null;
    poCandidates: PoWithLines[];
  }> {
    if (invoice.relatedPoId) {
      const po = await this.prisma.purchaseOrder.findUnique({
        where: { id: invoice.relatedPoId },
        select: PO_SELECT,
      });
      // A dangling link is treated as no link rather than a crash.
      if (po) return { resolution: 'LINKED', po, poCandidates: [] };
    }

    if (poReferences.length === 0) {
      return { resolution: 'NO_REFERENCE', po: null, poCandidates: [] };
    }

    // Company PO numbers are short sequential strings; matching is fuzzy, so
    // compare in memory over the company's PO numbers rather than in SQL.
    const companyPos = await this.prisma.purchaseOrder.findMany({
      where: { companyId: invoice.companyId },
      select: { id: true, poNumber: true },
    });

    const hitIds = new Set<string>();
    for (const reference of poReferences) {
      for (const po of companyPos) {
        if (referenceMatchesPoNumber(reference, po.poNumber)) hitIds.add(po.id);
      }
    }

    if (hitIds.size === 0) {
      return { resolution: 'NOT_FOUND', po: null, poCandidates: [] };
    }

    const hits = await this.prisma.purchaseOrder.findMany({
      where: { id: { in: [...hitIds] } },
      orderBy: { poNumber: 'asc' },
      select: PO_SELECT,
    });

    if (hits.length === 1) {
      return { resolution: 'AUTO_MATCHED', po: hits[0], poCandidates: [] };
    }
    return { resolution: 'AMBIGUOUS', po: null, poCandidates: hits };
  }
}

function toPoDto(po: PoWithLines): InvoiceMatchedPo {
  return {
    id: po.id,
    poNumber: po.poNumber,
    status: po.status,
    vendorId: po.vendorId,
    vendorName: po.vendor?.legalName ?? null,
    projectId: po.projectId,
    projectName: po.project?.name ?? null,
    currency: po.currency,
    totalAmount: po.totalAmount === null ? null : po.totalAmount.toNumber(),
    delivery: toDeliveryDto(po),
  };
}

/**
 * Delivery progress derived from the PO's line quantities, mirroring how the
 * delivery close-out advances the PO status (PoStatusService): all lines received
 * in full → DELIVERED, anything received → PARTIALLY_DELIVERED, else awaiting.
 * A lineless PO can never be "delivered", so it reports awaiting.
 */
function toDeliveryDto(po: PoWithLines): InvoicePoDelivery {
  const lines = po.lineItems;
  const quantityOrdered = lines.reduce((sum, line) => sum + line.quantityOrdered, 0);
  const quantityDelivered = lines.reduce((sum, line) => sum + line.quantityDelivered, 0);
  const linesDelivered = lines.filter(
    (line) => line.quantityDelivered >= line.quantityOrdered,
  ).length;

  const status =
    lines.length > 0 && linesDelivered === lines.length
      ? 'DELIVERED'
      : quantityDelivered > 0
        ? 'PARTIALLY_DELIVERED'
        : 'AWAITING_DELIVERY';

  return {
    status,
    quantityOrdered,
    quantityDelivered,
    linesDelivered,
    lineCount: lines.length,
    // Over-receipt is allowed on a line, so the roll-up is capped at 100 rather
    // than reporting a progress bar past full.
    percentDelivered:
      quantityOrdered === 0
        ? 0
        : Math.min(100, Math.round((quantityDelivered / quantityOrdered) * 100)),
    plannedDeliveryDate: po.plannedDeliveryDate ? po.plannedDeliveryDate.toISOString() : null,
  };
}

function toPoLineDto(line: PoWithLines['lineItems'][number]): InvoicePoMatchPoLine {
  return {
    id: line.id,
    lineNumber: line.lineNumber,
    materialCode: line.materialCode,
    description: line.description,
    imageUrl: line.material?.imageUrl ?? null,
    quantityOrdered: line.quantityOrdered,
    quantityDelivered: line.quantityDelivered,
    unitOfMeasure: line.unitOfMeasure,
    unitPrice: line.unitPrice.toNumber(),
    lineTotal: line.lineTotal.toNumber(),
    costCode: line.costCode,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
