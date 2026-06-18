import { RfqListQueryDto } from '@forethread/shared-types';
import { BadRequestException, Injectable } from '@nestjs/common';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { formatEnum } from '../../common/utils/format-enum';
import { PdfExportService } from '../export/pdf-export.service';

import { RfqsService } from './rfqs.service';

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

const COLUMN_MAP: Record<string, ExportColumnDef> = {
  rfqId: {
    header: 'RFQ ID',
    pdfWidth: 80,
    value: (r) => str(r.rfqNumber ?? r.id),
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
  rfqStatus: {
    header: 'Status',
    pdfWidth: 80,
    value: (r) => formatEnum(r.status as string),
  },
  resDeadline: {
    header: 'Deadline',
    pdfWidth: 90,
    value: (r) => str(r.deadlineRange),
  },
  pickUp: {
    header: 'Pick Up',
    pdfWidth: 50,
    value: (r) => (r.pickUp ? 'Yes' : 'No'),
  },
  deliveryLocation: {
    header: 'Delivery Location',
    pdfWidth: 110,
    value: (r) => str(r.deliveryLocation),
  },
  pickUpLocation: {
    header: 'Pick-Up Location',
    pdfWidth: 110,
    value: (r) => str(r.pickUpLocation),
  },
  recVendors: {
    header: 'Rec. Vendors',
    pdfWidth: 60,
    value: (r) => str(r.recVendors),
  },
  invitedVendors: {
    header: 'Inv. Vendors',
    pdfWidth: 60,
    value: (r) => str(r.invitedVendors),
  },
  recQuotes: {
    header: 'Rec. Quotes',
    pdfWidth: 60,
    value: (r) => str(r.recQuotes),
  },
  // Vendor dashboard column. `RfqListItem` has no distinct "responded quotes"
  // count, so this mirrors `recQuotes` (received quotes) — matches the vendor
  // VENDOR_COLUMNS mapping so the export stays consistent with the on-screen table.
  totalRespondedQuotes: {
    header: 'Total Responded Quotes',
    pdfWidth: 90,
    value: (r) => str(r.recQuotes),
  },
  applVendors: {
    header: 'Appr. Vendors',
    pdfWidth: 60,
    value: (r) => str(r.applVendors),
  },
  lineItems: {
    header: 'Line Items',
    pdfWidth: 50,
    value: (r) => str(r.lineItems),
  },
  declinedItems: {
    header: 'Decline items',
    pdfWidth: 60,
    value: (r) => str(r.declinedItems),
  },
  approvedItems: {
    header: 'Appr. items',
    pdfWidth: 60,
    value: (r) => str(r.approvedItems),
  },
  totalRequestedQty: {
    header: 'Total requested Qty',
    pdfWidth: 60,
    value: (r) => str(r.totalRequestedQty),
  },
  avgQuoteCost: {
    header: 'Avr. Quote Cost',
    pdfWidth: 80,
    value: (r) =>
      r.avgQuoteCost === null || r.avgQuoteCost === undefined ? '' : str(r.avgQuoteCost),
  },
  applIssues: {
    header: 'Appl. Issues',
    pdfWidth: 60,
    value: (r) => str(r.applIssues),
  },
  arcBlocksDist: {
    header: 'Arc Blocks Dist.',
    pdfWidth: 80,
    value: (r) => str(r.arcBlocksDist),
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
  contractorName: {
    header: 'Contractor Name',
    pdfWidth: 100,
    value: (r) => str(r.createdBy),
  },
  // Vendor dashboard column. `RfqListItem` exposes a single contractor identity
  // (no separate org/person split), so this mirrors `contractorName` →
  // `createdBy`, matching the vendor VENDOR_COLUMNS mapping.
  contractorCompany: {
    header: 'Contractor Company',
    pdfWidth: 100,
    value: (r) => str(r.createdBy),
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
  lastModifiedBy: {
    header: 'Last Modified By',
    pdfWidth: 90,
    value: (r) => str(r.lastModifiedBy),
  },
};

/** Fallback column set when no columns param is provided */
const DEFAULT_COLUMNS = [
  'rfqId',
  'projectName',
  'rfqStatus',
  'resDeadline',
  'pickUp',
  'deliveryLocation',
  'recVendors',
  'recQuotes',
  'lineItems',
  'totalRequestedQty',
  'createdDate',
  'createdBy',
  'approvalStatus',
];

@Injectable()
export class RfqExportService {
  constructor(
    private readonly rfqsService: RfqsService,
    private readonly pdfExportService: PdfExportService,
  ) {}

  async exportRfqs(
    format: string,
    query: RfqListQueryDto,
    user: AuthenticatedUser,
  ): Promise<{ url: string }> {
    const normalized = format.toUpperCase();

    // Fetch all matching RFQs (up to 10 000)
    const overrideQuery = Object.assign(new RfqListQueryDto(), query, { page: 1, limit: 10000 });
    const { items } = await this.rfqsService.listRfqs(overrideQuery, user);

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
        filenamePrefix: 'rfqs-export',
      });
    }

    if (normalized === 'PDF') {
      return this.pdfExportService.exportToPDF({
        title: 'RFQ List Export',
        landscape: true,
        columns: activeCols.map((c) => ({ header: c.header, width: c.pdfWidth ?? 80 })),
        rows: items.map((item) => {
          const record: Record<string, string> = {};
          for (const col of activeCols) {
            record[col.header] = col.value(item as unknown as Record<string, unknown>);
          }
          return record;
        }),
        filenamePrefix: 'rfqs-export',
      });
    }

    if (normalized === 'XLSX') {
      return this.pdfExportService.exportToXLSX({
        headers,
        rows,
        filenamePrefix: 'rfqs-export',
      });
    }

    throw new BadRequestException(ERR.export.invalidFormatCsvPdfXlsx);
  }
}
