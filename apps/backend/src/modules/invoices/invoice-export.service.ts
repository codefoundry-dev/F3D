import { InvoiceListQueryDto } from '@forethread/shared-types';
import { BadRequestException, Injectable } from '@nestjs/common';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { formatEnum } from '../../common/utils/format-enum';
import { PdfExportService } from '../export/pdf-export.service';

import { InvoicesService } from './invoices.service';

@Injectable()
export class InvoiceExportService {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly pdfExportService: PdfExportService,
  ) {}

  async exportInvoices(
    format: string,
    query: InvoiceListQueryDto & { ids?: string },
    user: AuthenticatedUser,
  ): Promise<{ url: string }> {
    const normalized = format.toUpperCase();

    // Fetch all matching invoices (up to 10 000)
    const overrideQuery = Object.assign(new InvoiceListQueryDto(), query, {
      page: 1,
      limit: 10000,
    });
    let { items } = await this.invoicesService.listInvoices(overrideQuery, user);

    // Filter by specific ids if provided (for selected-row export)
    if (query.ids) {
      const idSet = new Set(query.ids.split(',').map((id) => id.trim()));
      items = items.filter((item) => idSet.has(item.id));
    }

    const headers = [
      'Invoice ID',
      'Project Name',
      'Project ID',
      'Vendor Name',
      'Status',
      'Related PO',
      'Total Amount',
      'Due Date',
    ];

    const rows = items.map((item) => [
      item.id,
      item.projectName,
      item.projectId,
      item.vendorName,
      formatEnum(item.status),
      item.relatedPo ?? '',
      String(item.totalAmount),
      item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-US') : '',
    ]);

    if (normalized === 'CSV') {
      return this.pdfExportService.exportToCSV({
        headers,
        rows,
        filenamePrefix: 'invoices-export',
      });
    }

    if (normalized === 'XLSX') {
      return this.pdfExportService.exportToXLSX({
        headers,
        rows,
        filenamePrefix: 'invoices-export',
      });
    }

    if (normalized === 'PDF') {
      return this.pdfExportService.exportToPDF({
        title: `Invoice Export (${items.length} invoice${items.length === 1 ? '' : 's'})`,
        landscape: true,
        columns: [
          { header: 'Invoice ID', width: 80 },
          { header: 'Project Name', width: 120 },
          { header: 'Vendor Name', width: 100 },
          { header: 'Status', width: 70 },
          { header: 'Related PO', width: 80 },
          { header: 'Total Amount', width: 70 },
          { header: 'Due Date', width: 70 },
        ],
        rows: items.map((item) => ({
          'Invoice ID': item.id,
          'Project Name': item.projectName,
          'Vendor Name': item.vendorName,
          Status: formatEnum(item.status),
          'Related PO': item.relatedPo ?? '',
          'Total Amount': `$${Number(item.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          'Due Date': item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-US') : '',
        })),
        filenamePrefix: 'invoices-export',
      });
    }

    throw new BadRequestException(ERR.export.invalidFormatCsvPdfXlsx);
  }

  async exportSingleInvoice(
    id: string,
    format: string,
    user: AuthenticatedUser,
  ): Promise<{ url: string }> {
    const normalized = format.toUpperCase();
    const invoice = await this.invoicesService.getInvoice(id, user);

    const formattedAmount = `$${Number(invoice.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const formattedDate = invoice.dueDate
      ? new Date(invoice.dueDate).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : '—';
    const createdDate = new Date(invoice.createdAt).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    if (normalized === 'PDF') {
      return this.pdfExportService.exportInvoicePDF({
        heading: 'Invoice',
        date: createdDate,
        infoLeft: {
          label: 'Invoice Details',
          lines: [
            `Invoice ID: ${invoice.id.slice(0, 8).toUpperCase()}`,
            `Project: ${invoice.projectName}`,
            `Status: ${invoice.status}`,
            `Due Date: ${formattedDate}`,
          ],
        },
        infoRight: {
          label: 'Vendor',
          lines: [
            invoice.vendorName,
            ...(invoice.relatedPo
              ? [`Related PO: ${invoice.relatedPo.slice(0, 8).toUpperCase()}`]
              : []),
          ],
        },
        columns: [
          { header: 'Description', width: 280 },
          { header: 'Amount', width: 120 },
        ],
        rows: [
          {
            Description: `Invoice for project "${invoice.projectName}"`,
            Amount: formattedAmount,
          },
        ],
        totalRow: {
          label: 'Total',
          value: formattedAmount,
        },
        filenamePrefix: `invoice-${invoice.id.slice(0, 8)}`,
      });
    }

    // CSV / XLSX for single invoice
    const headers = [
      'Invoice ID',
      'Project Name',
      'Vendor Name',
      'Status',
      'Related PO',
      'Total Amount',
      'Due Date',
      'Created At',
    ];

    const rows = [
      [
        invoice.id,
        invoice.projectName,
        invoice.vendorName,
        invoice.status,
        invoice.relatedPo ?? '',
        String(invoice.totalAmount),
        invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-US') : '',
        createdDate,
      ],
    ];

    if (normalized === 'CSV') {
      return this.pdfExportService.exportToCSV({
        headers,
        rows,
        filenamePrefix: `invoice-${invoice.id.slice(0, 8)}`,
      });
    }

    if (normalized === 'XLSX') {
      return this.pdfExportService.exportToXLSX({
        headers,
        rows,
        filenamePrefix: `invoice-${invoice.id.slice(0, 8)}`,
      });
    }

    throw new BadRequestException(ERR.export.invalidFormatCsvPdfXlsx);
  }
}
