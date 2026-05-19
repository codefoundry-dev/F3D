import { PoListQueryDto } from '@forethread/shared-types';
import { BadRequestException, Injectable } from '@nestjs/common';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { formatEnum } from '../../common/utils/format-enum';
import { PdfExportService } from '../export/pdf-export.service';

import { PurchaseOrdersService } from './purchase-orders.service';

/* ─── Column definition registry ──────────────────────────────────────────── */

interface ExportColumnDef {
  header: string;
  value: (item: Record<string, unknown>) => string;
  pdfWidth?: number;
}

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
    value: (r) => str(r.projectId),
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
    value: (r) => formatEnum(r.status as string),
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
  ) {}

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
      return this.pdfExportService.exportToPDF({
        title: 'Purchase Orders Export',
        landscape: true,
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

  /** Export a single PO as a professional PDF (for download or email attachment) */
  async exportSinglePo(
    id: string,
    format: string,
    user: AuthenticatedUser,
  ): Promise<{ url: string }> {
    const normalized = format.toUpperCase();
    const po = await this.poService.getPurchaseOrder(id, user);

    const totalAmount = `$${Number(po.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const createdDate = new Date(po.createdAt).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    if (normalized === 'PDF') {
      return this.pdfExportService.exportInvoicePDF({
        heading: 'Purchase Order',
        date: createdDate,
        infoLeft: {
          label: 'PO Details',
          lines: [
            `PO Number: ${po.poNumber}`,
            `Project: ${po.projectName}`,
            `Status: ${formatEnum(po.status)}`,
            `Type: ${formatEnum(po.poType ?? 'STANDARD')}`,
            ...((po as Record<string, unknown>).deliveryLocationName
              ? [`Delivery: ${String((po as Record<string, unknown>).deliveryLocationName)}`]
              : []),
          ],
        },
        infoRight: {
          label: 'Vendor',
          lines: [
            ((po as Record<string, unknown>).vendorName as string) ?? '—',
            ...(po.paymentTermsDays ? [`Payment: Net ${po.paymentTermsDays} days`] : []),
          ],
        },
        columns: [
          { header: 'Item', width: 200 },
          { header: 'Qty', width: 60 },
          { header: 'Unit', width: 60 },
          { header: 'Unit Price', width: 100 },
          { header: 'Total', width: 100 },
        ],
        rows: (po.lineItems ?? []).map((li: Record<string, unknown>) => ({
          Item: str(li.materialName ?? li.description ?? ''),
          Qty: str(li.quantity),
          Unit: str(li.unit),
          'Unit Price': `$${Number(li.unitPrice ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          Total: `$${Number(li.lineTotal ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        })),
        totalRow: {
          label: 'Total Amount',
          value: totalAmount,
        },
        filenamePrefix: `po-${po.poNumber}`,
      });
    }

    throw new BadRequestException(ERR.export.invalidFormatCsvPdfXlsx);
  }

  /** Generate a PO PDF buffer (for email attachment — not uploaded to storage) */
  async generatePoPdfBuffer(id: string, user: AuthenticatedUser): Promise<Buffer> {
    const po = await this.poService.getPurchaseOrder(id, user);

    const totalAmount = `$${Number(po.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const createdDate = new Date(po.createdAt).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    return this.pdfExportService.generateInvoicePDFBuffer({
      heading: 'Purchase Order',
      date: createdDate,
      infoLeft: {
        label: 'PO Details',
        lines: [
          `PO Number: ${po.poNumber}`,
          `Project: ${po.projectName}`,
          `Status: ${formatEnum(po.status)}`,
        ],
      },
      infoRight: {
        label: 'Vendor',
        lines: [((po as Record<string, unknown>).vendorName as string) ?? '—'],
      },
      columns: [
        { header: 'Item', width: 200 },
        { header: 'Qty', width: 60 },
        { header: 'Unit', width: 60 },
        { header: 'Unit Price', width: 100 },
        { header: 'Total', width: 100 },
      ],
      rows: (po.lineItems ?? []).map((li: Record<string, unknown>) => ({
        Item: str(li.materialName ?? li.description ?? ''),
        Qty: str(li.quantity),
        Unit: str(li.unit),
        'Unit Price': `$${Number(li.unitPrice ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        Total: `$${Number(li.lineTotal ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      })),
      totalRow: {
        label: 'Total Amount',
        value: totalAmount,
      },
      filenamePrefix: `po-${po.poNumber}`,
    });
  }
}
