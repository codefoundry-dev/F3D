/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';

import { StorageService } from '../storage/storage.service';

import { PDF_COMPANY, PDF_STYLES, PDF_TABLE } from './pdf-styles.const';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');

export interface PdfTableColumn {
  header: string;
  width: number;
}

export interface PdfTableRow {
  [key: string]: string;
}

export interface PdfExportOptions {
  title: string;
  subtitle?: string;
  columns: PdfTableColumn[];
  rows: PdfTableRow[];
  filenamePrefix: string;
  landscape?: boolean;
}

export interface InvoiceInfoBlock {
  label: string;
  lines: string[];
}

export interface InvoiceTableItem {
  [key: string]: string;
}

export interface InvoiceExportOptions {
  /** Heading displayed top-right (e.g. "Invoice", "Company Profile") */
  heading: string;
  /** Date string displayed under the heading */
  date: string;
  /** Left info block (e.g. "From" / company details) */
  infoLeft?: InvoiceInfoBlock;
  /** Right info block (e.g. "To" / contact details) */
  infoRight?: InvoiceInfoBlock;
  /** Table columns */
  columns: PdfTableColumn[];
  /** Table data rows */
  rows: InvoiceTableItem[];
  /** Optional total row (label + value) */
  totalRow?: { label: string; value: string };
  filenamePrefix: string;
}

export interface CsvExportOptions {
  headers: string[];
  rows: string[][];
  filenamePrefix: string;
}

@Injectable()
export class PdfExportService {
  constructor(private readonly storageService: StorageService) {}

  async exportToPDF(options: PdfExportOptions): Promise<{ url: string }> {
    const { title, subtitle, columns, rows, filenamePrefix, landscape } = options;

    const doc = new PDFDocument({
      size: 'A4',
      layout: landscape ? 'landscape' : 'portrait',
      margins: { top: 50, bottom: 50, left: 40, right: 40 },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    return new Promise<{ url: string }>((resolve, reject) => {
      doc.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const filename = `${filenamePrefix}_${timestamp}.pdf`;

          const result = await this.storageService.uploadBuffer({
            buffer: pdfBuffer,
            filename,
            contentType: 'application/pdf',
            folder: 'exports',
          });

          const url = await this.storageService.getSignedUrl(result.key);
          resolve({ url });
        } catch (error: unknown) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });

      doc.on('error', (error: Error) => {
        reject(error);
      });

      // ── Title ──────────────────────────────────────────────────────────────
      const leftMargin = 40;
      const rightEdge = doc.page.width - 40;

      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor(PDF_STYLES.text.primary)
        .text(PDF_COMPANY.name, leftMargin, 50, { width: rightEdge - leftMargin });

      doc.moveDown(0.3);

      doc
        .fontSize(12)
        .font('Helvetica')
        .text(title, { width: rightEdge - leftMargin });

      if (subtitle) {
        doc
          .fontSize(9)
          .fillColor(PDF_STYLES.text.secondary)
          .text(subtitle, { width: rightEdge - leftMargin });
      }

      doc.moveDown(1);

      // ── Table ──────────────────────────────────────────────────────────────
      if (rows.length === 0) {
        doc.fontSize(10).fillColor(PDF_STYLES.text.secondary).text('No data found.');
      } else {
        const tableTop = doc.y;
        const rowHeight = PDF_TABLE.rowHeight;
        const colSpacing = 8;
        const availableWidth = rightEdge - leftMargin;
        const rawTableWidth =
          columns.reduce((sum, col) => sum + col.width, 0) + colSpacing * (columns.length - 1);

        // Scale columns proportionally if they exceed the available page width
        if (rawTableWidth > availableWidth) {
          const totalColWidth = columns.reduce((sum, col) => sum + col.width, 0);
          const targetColWidth = availableWidth - colSpacing * (columns.length - 1);
          const scale = targetColWidth / totalColWidth;
          for (const col of columns) {
            col.width = Math.floor(col.width * scale);
          }
        }

        const tableWidth =
          columns.reduce((sum, col) => sum + col.width, 0) + colSpacing * (columns.length - 1);

        // Header row
        doc
          .rect(leftMargin, tableTop, tableWidth, rowHeight)
          .fillColor(PDF_STYLES.layer.header)
          .fill()
          .fillColor(PDF_STYLES.text.primary);

        doc.fontSize(9).font('Helvetica-Bold');
        let xPos = leftMargin + 4;
        columns.forEach((col, i) => {
          doc.text(col.header, xPos, tableTop + PDF_TABLE.textPadding, { width: col.width });
          if (i < columns.length - 1) xPos += col.width + colSpacing;
        });

        // Data rows
        let currentY = tableTop + rowHeight;
        doc.font('Helvetica').fontSize(8);

        rows.forEach((row, index) => {
          if (currentY + rowHeight > doc.page.height - 50) {
            doc.addPage();
            currentY = 50;
          }

          if (index % 2 === 0) {
            doc
              .rect(leftMargin, currentY, tableWidth, rowHeight)
              .fillColor(PDF_STYLES.layer.rowAlt)
              .fill()
              .fillColor(PDF_STYLES.text.primary);
          }

          xPos = leftMargin + 4;
          columns.forEach((col, i) => {
            doc.text(row[col.header] ?? '', xPos, currentY + PDF_TABLE.textPadding, {
              width: col.width,
              ellipsis: true,
            });
            if (i < columns.length - 1) xPos += col.width + colSpacing;
          });

          currentY += rowHeight;
        });

        // Footer
        if (currentY + 20 > doc.page.height - 50) {
          doc.addPage();
          currentY = 50;
        }

        doc
          .fontSize(8)
          .fillColor(PDF_STYLES.text.secondary)
          .text(
            `Generated on ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`,
            leftMargin,
            currentY + 20,
            { align: 'left' },
          );
      }

      doc.end();
    });
  }

  async exportInvoicePDF(options: InvoiceExportOptions): Promise<{ url: string }> {
    const { heading, date, infoLeft, infoRight, columns, rows, totalRow, filenamePrefix } = options;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc: any = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 40, right: 40 },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    return new Promise<{ url: string }>((resolve, reject) => {
      doc.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const filename = `${filenamePrefix}_${ts}.pdf`;

          const result = await this.storageService.uploadBuffer({
            buffer: pdfBuffer,
            filename,
            contentType: 'application/pdf',
            folder: 'exports',
          });

          const url = await this.storageService.getSignedUrl(result.key);
          resolve({ url });
        } catch (error: unknown) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });

      doc.on('error', (error: Error) => reject(error));

      const leftMargin = 40;
      const rightEdge = doc.page.width - 40;

      // ── Header row: Company name (left) + Heading (right) ──────────────
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .fillColor(PDF_STYLES.text.primary)
        .text(PDF_COMPANY.name, leftMargin, 50, { width: rightEdge - leftMargin });

      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text(heading, rightEdge - 200, 50, { width: 200, align: 'right' });

      let currentY = 90;

      // ── Date ───────────────────────────────────────────────────────────
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor(PDF_STYLES.text.secondary)
        .text(`Date: ${date}`, rightEdge - 200, currentY, { width: 200, align: 'right' });

      currentY += 30;

      // ── Info blocks ────────────────────────────────────────────────────
      const renderInfoBlock = (block: InvoiceInfoBlock, x: number, startY: number): number => {
        let y = startY;
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor(PDF_STYLES.text.primary)
          .text(`${block.label}:`, x, y, { width: 220 });
        y += 15;

        doc.font('Helvetica');
        for (const line of block.lines) {
          if (line) {
            doc.text(line, x, y, { width: 220 });
            y += 12;
          }
        }
        return y;
      };

      const infoStartY = currentY;
      let leftEndY = currentY;
      let rightEndY = currentY;

      if (infoLeft) {
        leftEndY = renderInfoBlock(infoLeft, leftMargin, infoStartY);
      }

      if (infoRight) {
        rightEndY = renderInfoBlock(infoRight, rightEdge - 220, infoStartY);
      }

      currentY = Math.max(leftEndY, rightEndY) + 20;

      // ── Table ──────────────────────────────────────────────────────────
      if (rows.length > 0) {
        const rowHeight = PDF_TABLE.rowHeight;
        const colSpacing = 12;
        const tableWidth =
          columns.reduce((sum, col) => sum + col.width, 0) + colSpacing * (columns.length - 1);

        // Header
        doc
          .rect(leftMargin, currentY, tableWidth, rowHeight)
          .fillColor(PDF_STYLES.layer.header)
          .fill()
          .fillColor(PDF_STYLES.text.primary);

        doc.fontSize(10).font('Helvetica-Bold');
        let xPos = leftMargin + 6;
        columns.forEach((col, i) => {
          doc.text(col.header, xPos, currentY + PDF_TABLE.textPadding, { width: col.width });
          if (i < columns.length - 1) xPos += col.width + colSpacing;
        });

        currentY += rowHeight;

        // Rows
        doc.font('Helvetica').fontSize(9);
        rows.forEach((row, index) => {
          if (currentY + rowHeight > doc.page.height - 50) {
            doc.addPage();
            currentY = 50;
          }

          doc
            .rect(leftMargin, currentY, tableWidth, rowHeight)
            .fillColor(index % 2 === 0 ? PDF_STYLES.background.cell : PDF_STYLES.layer.rowAlt)
            .fill()
            .fillColor(PDF_STYLES.text.primary);

          xPos = leftMargin + 6;
          columns.forEach((col, i) => {
            doc.text(row[col.header] ?? '', xPos, currentY + PDF_TABLE.textPadding, {
              width: col.width,
              ellipsis: true,
            });
            if (i < columns.length - 1) xPos += col.width + colSpacing;
          });

          currentY += rowHeight;
        });

        // Total row
        if (totalRow) {
          if (currentY + rowHeight > doc.page.height - 50) {
            doc.addPage();
            currentY = 50;
          }

          doc
            .rect(leftMargin, currentY, tableWidth, rowHeight)
            .fillColor(PDF_STYLES.layer.totalRow)
            .fill()
            .fillColor(PDF_STYLES.text.primary);

          doc.font('Helvetica-Bold').fontSize(10);

          const lastCol = columns[columns.length - 1];
          const labelWidth = tableWidth - lastCol.width - colSpacing;
          doc.text(totalRow.label, leftMargin + 6, currentY + PDF_TABLE.textPadding, {
            width: labelWidth,
          });
          doc.text(
            totalRow.value,
            leftMargin + 6 + labelWidth + colSpacing,
            currentY + PDF_TABLE.textPadding,
            {
              width: lastCol.width,
            },
          );

          currentY += rowHeight;
        }
      } else {
        doc
          .fontSize(10)
          .fillColor(PDF_STYLES.text.secondary)
          .text('No data found.', leftMargin, currentY);
        currentY += 20;
      }

      // ── Footer ─────────────────────────────────────────────────────────
      if (currentY + 30 > doc.page.height - 50) {
        doc.addPage();
        currentY = 50;
      }

      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor(PDF_STYLES.text.secondary)
        .text(
          `Generated on ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`,
          leftMargin,
          currentY + 24,
          { align: 'left' },
        );

      doc.end();
    });
  }

  /** Same as exportInvoicePDF but returns raw Buffer (for email attachments) */
  async generateInvoicePDFBuffer(options: InvoiceExportOptions): Promise<Buffer> {
    const { url } = await this.exportInvoicePDF(options);
    // Extract storage key from signed URL and download back as buffer
    const key = decodeURIComponent(url.split('?')[0].split('/').slice(-2).join('/'));
    const { body } = await this.storageService.getObject(key);
    if (!body) throw new Error('Failed to retrieve generated PDF');
    return body;
  }

  async exportToCSV(options: CsvExportOptions): Promise<{ url: string }> {
    const { headers, rows, filenamePrefix } = options;

    const escapeCSV = (value: string | null | undefined): string => {
      if (value === null || value === undefined) return '""';
      return `"${String(value).replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, '')}"`;
    };

    const csvRows = rows.map((row) => row.map((v) => escapeCSV(v)).join(';'));
    const csvContent = [headers.map((h) => escapeCSV(h)).join(';'), ...csvRows].join('\r\n');

    const BOM = '\uFEFF';
    const buffer = Buffer.from(BOM + csvContent, 'utf-8');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${filenamePrefix}_${timestamp}.csv`;

    const result = await this.storageService.uploadBuffer({
      buffer,
      filename,
      contentType: 'text/csv;charset=utf-8',
      folder: 'exports',
    });

    const url = await this.storageService.getSignedUrl(result.key);
    return { url };
  }

  async exportToXLSX(options: CsvExportOptions): Promise<{ url: string }> {
    const { headers, rows, filenamePrefix } = options;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Export');

    // Header row — bold + background
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell: { font: unknown; fill: unknown; border: unknown }) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F2F2' },
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE5E5E5' } },
      };
    });

    // Data rows
    for (const row of rows) {
      sheet.addRow(row);
    }

    // Auto-fit column widths (min 10, max 40)
    for (let i = 0; i < headers.length; i++) {
      let maxLen = headers[i].length;
      for (const row of rows) {
        const val = row[i];
        if (val && String(val).length > maxLen) maxLen = String(val).length;
      }
      sheet.getColumn(i + 1).width = Math.min(Math.max(maxLen + 2, 10), 40);
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${filenamePrefix}_${timestamp}.xlsx`;

    const result = await this.storageService.uploadBuffer({
      buffer,
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      folder: 'exports',
    });

    const url = await this.storageService.getSignedUrl(result.key);
    return { url };
  }
}
