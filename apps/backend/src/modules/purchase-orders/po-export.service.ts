import { PoListQueryDto } from '@forethread/shared-types';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessTokenPurpose, AccessTokenSubject } from '@prisma/client';
import * as QRCode from 'qrcode';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { formatEnum } from '../../common/utils/format-enum';
import { AccessTokensService } from '../access-tokens/access-tokens.service';
import { BrandingService } from '../export/branding.service';
import {
  InvoiceExportOptions,
  PdfBrand,
  PdfExportService,
  PdfQrBlock,
} from '../export/pdf-export.service';

import { DELIVERABLE_PO_STATUSES, DELIVERY_LINK_TTL_MS } from './delivery-link.const';
import { PurchaseOrdersService } from './purchase-orders.service';

/** Resolved single-PO detail shape (return type of PurchaseOrdersService.getPurchaseOrder). */
type PoDetail = Awaited<ReturnType<PurchaseOrdersService['getPurchaseOrder']>>;

/* ─── Column definition registry ──────────────────────────────────────────── */

interface ExportColumnDef {
  header: string;
  value: (item: Record<string, unknown>) => string;
  pdfWidth?: number;
}

/**
 * PO status label for exports. ACCEPTED is the vendor's Approve, so everyone
 * sees it as "Approved" (FOR-397), matching the app.
 */
const formatPoStatus = (status: string | null | undefined): string =>
  status === 'ACCEPTED' ? 'Approved' : formatEnum(status);

/** Safely convert an unknown value to a string (avoids [object Object]) */
const str = (v: unknown): string =>
  v === null || v === undefined
    ? ''
    : typeof v === 'object'
      ? JSON.stringify(v)
      : `${v as string | number}`;

/** Maps every frontend column key to a header + value extractor */
const COLUMN_MAP: Record<string, ExportColumnDef> = {
  poNumber: {
    header: 'PO Number',
    pdfWidth: 80,
    value: (r) => str(r.poNumber),
  },
  projectName: {
    header: 'Project Name',
    pdfWidth: 120,
    value: (r) => str(r.projectName),
  },
  projectId: {
    header: 'Project ID',
    pdfWidth: 80,
    value: (r) => str(r.projectCode),
  },
  vendorName: {
    header: 'Vendor Name',
    pdfWidth: 100,
    value: (r) => str(r.vendorName ?? r.contractorName),
  },
  contractorName: {
    header: 'Contractor Name',
    pdfWidth: 100,
    value: (r) => str(r.contractorName),
  },
  poStatus: {
    header: 'PO Status',
    pdfWidth: 80,
    value: (r) => formatPoStatus(r.status as string),
  },
  revision: {
    header: 'Revision',
    pdfWidth: 50,
    value: (r) => str(r.revision),
  },
  poType: {
    header: 'PO Type',
    pdfWidth: 60,
    value: (r) => formatEnum(r.poType as string),
  },
  pickUp: {
    header: 'Pick Up',
    pdfWidth: 50,
    value: (r) => (r.pickUp ? 'Yes' : 'No'),
  },
  deliveryLocation: {
    header: 'Delivery Location',
    pdfWidth: 110,
    value: (r) => str(r.deliveryLocationId),
  },
  pickUpLocation: {
    header: 'Pick-Up Location',
    pdfWidth: 110,
    value: (r) => str(r.pickUpLocation),
  },
  paymentTermsDays: {
    header: 'Payment Terms',
    pdfWidth: 80,
    value: (r) => (r.paymentTermsDays ? `${str(r.paymentTermsDays)} days` : ''),
  },
  totalAmount: {
    header: 'Total Amount',
    pdfWidth: 70,
    value: (r) => str(r.totalAmount),
  },
  needBy: {
    header: 'Need By',
    pdfWidth: 70,
    value: (r) => str(r.deadlineEnd),
  },
  holdForRelease: {
    header: 'Hold For Release',
    pdfWidth: 60,
    value: (r) => (r.holdForRelease ? 'Yes' : 'No'),
  },
  earliestDate: {
    header: 'Earliest Date',
    pdfWidth: 70,
    value: (r) => str(r.deadlineStart),
  },
  plannedDeliveryDate: {
    header: 'Planned Delivery Date',
    pdfWidth: 80,
    value: (r) => str(r.plannedDeliveryDate),
  },
  lineItems: {
    header: 'Line Items',
    pdfWidth: 50,
    value: (r) => str(r.lineItemCount),
  },
  totalQuantity: {
    header: 'Total Quantity',
    pdfWidth: 60,
    value: (r) => str(r.totalRequestedQty),
  },
  createdDate: {
    header: 'Created Date',
    pdfWidth: 70,
    value: (r) => str(r.createdDate),
  },
  createdBy: {
    header: 'Created By',
    pdfWidth: 90,
    value: (r) => str(r.createdBy),
  },
  lastModifyBy: {
    header: 'Last Modified By',
    pdfWidth: 90,
    value: (r) => str(r.lastModifiedBy),
  },
  lastUpdated: {
    header: 'Last Updated',
    pdfWidth: 70,
    value: (r) => str(r.updatedAt),
  },
  approvalStatus: {
    header: 'Approval Status',
    pdfWidth: 80,
    value: (r) => formatEnum(r.approvalStatus as string),
  },
  approvedBy: {
    header: 'Approved By',
    pdfWidth: 90,
    value: (r) => str(r.approvedBy),
  },
  aging: {
    header: 'Aging',
    pdfWidth: 50,
    value: (r) => {
      const ref = (r.issuedAt ?? r.updatedAt) as string | null;
      if (!ref) return '';
      return `${Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000)}d`;
    },
  },
  isBulkOrder: {
    header: 'Is Bulk Order',
    pdfWidth: 50,
    value: (r) => (r.poType === 'BULK' ? 'Yes' : 'No'),
  },
  linkedRfqAvgPrice: {
    header: 'Linked RFQ Avg. Price',
    pdfWidth: 80,
    value: (r) => str(r.linkedRfqAvgPrice),
  },
  lineItemsDelivered: {
    header: 'Line Items Delivered',
    pdfWidth: 60,
    value: (r) => str(r.lineItemsDelivered),
  },
  quantityDelivered: {
    header: 'Quantity Delivered',
    pdfWidth: 60,
    value: (r) => str(r.quantityDelivered),
  },
};

/** Fallback column set when no columns param is provided */
const DEFAULT_COLUMNS = [
  'poNumber',
  'projectName',
  'vendorName',
  'poStatus',
  'poType',
  'revision',
  'totalAmount',
  'pickUp',
  'deliveryLocation',
  'createdDate',
  'createdBy',
  'approvalStatus',
];

@Injectable()
export class PoExportService {
  constructor(
    private readonly poService: PurchaseOrdersService,
    private readonly pdfExportService: PdfExportService,
    private readonly brandingService: BrandingService,
    private readonly accessTokens: AccessTokensService,
    config: ConfigService,
  ) {
    this.webAppUrl = config.get<string>('WEB_APP_URL', 'http://localhost:5179');
  }

  private readonly logger = new Logger(PoExportService.name);
  private readonly webAppUrl: string;

  async exportPos(
    format: string,
    query: PoListQueryDto,
    user: AuthenticatedUser,
  ): Promise<{ url: string }> {
    const normalized = format.toUpperCase();

    // Fetch all matching POs (up to 10 000)
    const overrideQuery = Object.assign(new PoListQueryDto(), query, { page: 1, limit: 10000 });
    const { items } = await this.poService.listPurchaseOrders(overrideQuery, user);

    // Resolve requested columns (from view) or fall back to defaults
    const requestedKeys = query.columns
      ? query.columns.split(',').filter((k) => COLUMN_MAP[k])
      : DEFAULT_COLUMNS;

    const activeCols = requestedKeys.map((k) => COLUMN_MAP[k]);
    const headers = activeCols.map((c) => c.header);
    const rows = items.map((item) =>
      activeCols.map((c) => c.value(item as unknown as Record<string, unknown>)),
    );

    if (normalized === 'CSV') {
      return this.pdfExportService.exportToCSV({
        headers,
        rows,
        filenamePrefix: 'purchase-orders-export',
      });
    }

    if (normalized === 'PDF') {
      const brand = await this.brandingService.getPdfBrand(user.companyId);
      return this.pdfExportService.exportToPDF({
        title: 'Purchase Orders Export',
        landscape: true,
        ...(brand ? { brand } : {}),
        columns: activeCols.map((c) => ({ header: c.header, width: c.pdfWidth ?? 80 })),
        rows: items.map((item) => {
          const record: Record<string, string> = {};
          for (const col of activeCols) {
            record[col.header] = col.value(item as unknown as Record<string, unknown>);
          }
          return record;
        }),
        filenamePrefix: 'purchase-orders-export',
      });
    }

    if (normalized === 'XLSX') {
      return this.pdfExportService.exportToXLSX({
        headers,
        rows,
        filenamePrefix: 'purchase-orders-export',
      });
    }

    throw new BadRequestException(ERR.export.invalidFormatCsvPdfXlsx);
  }

  /** Export a single PO as a professional PDF (for download or archive). */
  async exportSinglePo(
    id: string,
    format: string,
    user: AuthenticatedUser,
  ): Promise<{ url: string }> {
    if (format.toUpperCase() !== 'PDF') {
      throw new BadRequestException(ERR.export.invalidFormatCsvPdfXlsx);
    }
    const po = await this.poService.getPurchaseOrder(id, user);
    const brand = await this.brandingService.getPdfBrand(po.company?.id);
    const qr = await this.buildDeliveryQr(po, user.id);
    return this.pdfExportService.exportInvoicePDF(this.buildPoPdfOptions(po, brand, qr));
  }

  /** Generate a PO PDF buffer (for email attachment — not uploaded to storage). */
  async generatePoPdfBuffer(id: string, user: AuthenticatedUser): Promise<Buffer> {
    const po = await this.poService.getPurchaseOrder(id, user);
    const brand = await this.brandingService.getPdfBrand(po.company?.id);
    const qr = await this.buildDeliveryQr(po, user.id);
    return this.pdfExportService.generateInvoicePDFBuffer(this.buildPoPdfOptions(po, brand, qr));
  }

  /**
   * Export a single PO as a PDF for the tokenised vendor portal (FOR-246).
   * Identity-free: the validated access token has already authorised this exact
   * PO, so there is no caller user. Returns a URL, mirroring exportSinglePo.
   */
  async exportPublicPoPdf(id: string): Promise<{ url: string }> {
    const po = await this.poService.getPurchaseOrderById(id);
    const brand = await this.brandingService.getPdfBrand(po.company?.id);
    const qr = await this.buildDeliveryQr(po);
    return this.pdfExportService.exportInvoicePDF(this.buildPoPdfOptions(po, brand, qr));
  }

  /**
   * The "scan to confirm delivery" QR for a PO printout: a public
   * delivery-portal link (the same DELIVERY_SUBMIT grant the buyer's "Generate
   * delivery QR" button mints), so whoever receives the goods on site can open
   * the PO and log the delivery from their phone without an account.
   *
   * Only issued once the PO is deliverable — a draft carries no QR. A stored
   * token can't be turned back into a link (only its hash is kept), so each
   * printout mints its own; they all stay valid for the usual 90 days. Never a
   * reason the PDF fails: any error just leaves the QR off.
   */
  private async buildDeliveryQr(
    po: PoDetail,
    createdByUserId?: string,
  ): Promise<PdfQrBlock | undefined> {
    if (!DELIVERABLE_PO_STATUSES.includes(po.status)) return undefined;
    try {
      const { token } = await this.accessTokens.issueToken({
        subjectType: AccessTokenSubject.PURCHASE_ORDER,
        subjectId: po.id,
        purpose: AccessTokenPurpose.DELIVERY_SUBMIT,
        ttlMs: DELIVERY_LINK_TTL_MS,
        createdByUserId: createdByUserId ?? null,
      });
      const image = await QRCode.toBuffer(`${this.webAppUrl}/delivery/${token}`, {
        type: 'png',
        margin: 1,
        width: 336,
      });
      return {
        image,
        title: 'Scan to confirm delivery',
        caption:
          'Receiving this order on site? Scan with your phone camera to view the PO and log what was delivered. No login needed.',
      };
    } catch (error) {
      this.logger.warn(
        `Delivery QR skipped for PO ${po.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  /**
   * Build the polished PO PDF template model (FOR-211): renders number, vendor,
   * line items, the multi-delivery schedule (FOR-210), terms and signature lines.
   * Shared by the download and email-attachment paths so both stay in sync.
   */
  buildPoPdfOptions(po: PoDetail, brand?: PdfBrand, qr?: PdfQrBlock): InvoiceExportOptions {
    const currency = po.currency || 'AUD';
    const money = (value: unknown): string => formatMoney(value, currency);

    const createdDate = formatLongDate(po.createdAt);

    const vendorName = po.vendor?.name ?? '—';
    const buyerName = po.company?.name ?? '—';

    // Item code + cost code columns appear only when some line carries one, so
    // a PO without codes keeps the roomier five-column layout.
    const lines = po.lineItems ?? [];
    const showCode = lines.some((li) => li.materialCode);
    const showCostCode = lines.some((li) => li.costCode);
    const compact = showCode || showCostCode;

    return {
      heading: 'Purchase Order',
      ...(brand ? { brand } : {}),
      ...(qr ? { qr } : {}),
      date: createdDate,
      infoLeft: {
        label: 'PO Details',
        lines: [
          `PO Number: ${po.poNumber}`,
          `Project: ${po.projectName}`,
          `Status: ${formatPoStatus(po.status)}`,
          `Type: ${formatEnum(po.poType ?? 'STANDARD')}`,
          `Revision: ${str(po.revision)}`,
          `Buyer: ${buyerName}`,
          ...(po.costCode ? [`Cost Code: ${po.costCode}`] : []),
        ],
      },
      infoRight: {
        label: 'Vendor',
        lines: [
          vendorName,
          ...(po.paymentTermsDays ? [`Payment: Net ${po.paymentTermsDays} days`] : []),
          ...(po.deliveryLocationName ? [`Deliver to: ${po.deliveryLocationName}`] : []),
        ],
      },
      // Sized to the A4 printable width (515pt less cell padding and gaps) so nothing
      // is scaled or clipped (FOR-388). With a code column the numeric columns
      // tighten up to make room, keeping codes and "Cost Code" on one line.
      columns: [
        ...(showCode ? [{ header: 'Code', width: 62 }] : []),
        { header: 'Item', width: compact ? 118 : 165 },
        ...(showCostCode ? [{ header: 'Cost Code', width: 56 }] : []),
        { header: 'Qty', width: compact ? 26 : 40, align: 'right' as const },
        { header: 'Unit', width: compact ? 30 : 45 },
        { header: 'Unit Price', width: compact ? 66 : 100, align: 'right' as const },
        { header: 'Total', width: compact ? 73 : 105, align: 'right' as const },
      ],
      rows: lines.map((li) => ({
        ...(showCode ? { Code: str(li.materialCode) } : {}),
        Item: str(li.materialName ?? li.description ?? ''),
        ...(showCostCode ? { 'Cost Code': str(li.costCode) } : {}),
        Qty: str(li.quantityOrdered),
        Unit: str(li.unitOfMeasure),
        'Unit Price': money(li.unitPrice),
        Total: money(li.lineTotal),
      })),
      totalRow: {
        label: 'Total Amount',
        value: money(po.totalAmount),
      },
      sections: [
        {
          label: 'Delivery Schedule',
          emptyText: po.plannedDeliveryDate
            ? `Planned delivery: ${formatLongDate(po.plannedDeliveryDate)}`
            : 'No delivery schedule specified.',
          columns: [
            { header: '#', width: 25 },
            { header: 'Location', width: 180 },
            { header: 'Date', width: 110 },
            { header: 'Notes', width: 152 },
          ],
          rows: (po.deliveries ?? []).map((d, i) => ({
            '#': str(d.sequence ?? i + 1),
            Location: str(d.deliveryLocationName ?? '—'),
            Date: d.deliveryDate ? formatLongDate(d.deliveryDate) : '—',
            Notes: str(d.notes ?? ''),
          })),
        },
      ],
      terms: {
        label: 'Terms & Notes',
        lines: [
          po.paymentTermsDays ? `Payment terms: Net ${po.paymentTermsDays} days` : '',
          po.deliveryResponsibleName
            ? `Delivery contact: ${po.deliveryResponsibleName}${
                po.deliveryResponsibleEmail ? ` (${po.deliveryResponsibleEmail})` : ''
              }`
            : '',
          po.deliveryNotes ? `Delivery notes: ${po.deliveryNotes}` : '',
          po.message ? `Message: ${po.message}` : '',
          ...(po.termsAndConditions
            ? ['This order is subject to the General Terms & Conditions below.']
            : []),
        ],
      },
      signatures: [
        { label: 'Authorised by (Buyer)', name: po.approvedBy?.name ?? po.createdBy?.name },
        { label: 'Approved by (Vendor)' },
      ],
      ...(po.termsAndConditions && {
        legalText: { label: 'General Terms & Conditions', text: po.termsAndConditions },
      }),
      filenamePrefix: `po-${po.poNumber}`,
    };
  }
}

/** Format a value as currency (e.g. "$1,234.00 AUD"); blank-safe. */
function formatMoney(value: unknown, currency: string): string {
  const amount = Number(value ?? 0);
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${currency}`;
}

/** Format an ISO date string as "Month D, YYYY". */
function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
