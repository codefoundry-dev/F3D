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

/**
 * Issuing-company branding rendered in a document header (FOR-267). When set, the
 * company logo + name replace the plain "Forethread" wordmark.
 */
export interface PdfBrand {
  /** Company display name shown beside the logo. */
  name: string;
  /** Logo image bytes — pdfkit only supports PNG and JPEG. */
  logo: Buffer;
}

export interface PdfExportOptions {
  title: string;
  subtitle?: string;
  columns: PdfTableColumn[];
  rows: PdfTableRow[];
  filenamePrefix: string;
  landscape?: boolean;
  /** Issuing-company brand mark for the header (defaults to the Forethread wordmark). */
  brand?: PdfBrand;
}

export interface InvoiceInfoBlock {
  label: string;
  lines: string[];
}

export interface InvoiceTableItem {
  [key: string]: string;
}

/** An extra labelled table rendered after the main line-item table (e.g. a PO delivery schedule). */
export interface InvoiceSection {
  label: string;
  columns: PdfTableColumn[];
  rows: InvoiceTableItem[];
  /** Message shown when there are no rows (defaults to "None"). */
  emptyText?: string;
}

/** A signature line rendered near the bottom of the document. */
export interface InvoiceSignatureBlock {
  /** Caption under the signature line, e.g. "Authorised by (Buyer)". */
  label: string;
  /** Optional pre-filled name printed above the caption. */
  name?: string;
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
  /** Optional extra tables rendered after the main table (e.g. delivery schedule). */
  sections?: InvoiceSection[];
  /** Optional terms / notes block rendered before the signature lines. */
  terms?: InvoiceInfoBlock;
  /** Optional signature lines rendered at the bottom. */
  signatures?: InvoiceSignatureBlock[];
  /** Issuing-company brand mark for the header (defaults to the Forethread wordmark). */
  brand?: PdfBrand;
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

      // ── Header: brand mark + report title ────────────────────────────────────
      const leftMargin = 40;
      const rightEdge = doc.page.width - 40;

      this.drawBrandMark(doc, leftMargin, 50, options.brand, 16);

      // Drop the title below the brand mark — lower when a logo is present so it
      // never collides with the rendered image.
      const titleY = options.brand?.logo ? 96 : 78;
      doc
        .fontSize(12)
        .font('Helvetica')
        .fillColor(PDF_STYLES.text.primary)
        .text(title, leftMargin, titleY, { width: rightEdge - leftMargin });

      if (subtitle) {
        doc
          .fontSize(9)
          .fillColor(PDF_STYLES.text.secondary)
          .text(subtitle, leftMargin, doc.y, { width: rightEdge - leftMargin });
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
    const pdfBuffer = await this.renderInvoiceBuffer(options);

    try {
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `${options.filenamePrefix}_${ts}.pdf`;

      const result = await this.storageService.uploadBuffer({
        buffer: pdfBuffer,
        filename,
        contentType: 'application/pdf',
        folder: 'exports',
      });

      const url = await this.storageService.getSignedUrl(result.key);
      return { url };
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /** Same as exportInvoicePDF but returns the raw Buffer directly (for email attachments). */
  async generateInvoicePDFBuffer(options: InvoiceExportOptions): Promise<Buffer> {
    return this.renderInvoiceBuffer(options);
  }

  /** Render an invoice-style document to a PDF Buffer in-process (no storage I/O). */
  private renderInvoiceBuffer(options: InvoiceExportOptions): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc: any = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 40, right: 40 },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (error: unknown) =>
        reject(error instanceof Error ? error : new Error(String(error))),
      );

      try {
        this.buildInvoiceDoc(doc, options);
      } catch (error: unknown) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }

      doc.end();
    });
  }

  /** Draw the full invoice document onto an open PDFKit doc (does not call doc.end). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildInvoiceDoc(doc: any, options: InvoiceExportOptions): void {
    const { heading, date, infoLeft, infoRight, columns, rows, totalRow, sections, terms } =
      options;

    const leftMargin = 40;
    const rightEdge = doc.page.width - 40;

    // ── Header row: brand mark (left) + heading (right) ────────────────
    this.drawBrandMark(doc, leftMargin, 50, options.brand, 18);

    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .fillColor(PDF_STYLES.text.primary)
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
    const infoStartY = currentY;
    let leftEndY = currentY;
    let rightEndY = currentY;

    if (infoLeft) {
      leftEndY = this.drawInfoBlock(doc, infoLeft, leftMargin, infoStartY);
    }

    if (infoRight) {
      rightEndY = this.drawInfoBlock(doc, infoRight, rightEdge - 220, infoStartY);
    }

    currentY = Math.max(leftEndY, rightEndY) + 20;

    // ── Main line-item table ───────────────────────────────────────────
    currentY = this.drawTable(doc, leftMargin, currentY, columns, rows, totalRow);

    // ── Extra sections (e.g. delivery schedule) ────────────────────────
    for (const section of sections ?? []) {
      currentY = this.drawSectionHeading(doc, leftMargin, currentY, section.label);
      if (section.rows.length > 0) {
        currentY = this.drawTable(doc, leftMargin, currentY, section.columns, section.rows);
      } else {
        if (currentY + 20 > doc.page.height - 50) {
          doc.addPage();
          currentY = 50;
        }
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor(PDF_STYLES.text.secondary)
          .text(section.emptyText ?? 'None', leftMargin, currentY);
        currentY += 24;
      }
    }

    // ── Terms / notes ──────────────────────────────────────────────────
    if (terms?.lines.some((l) => l)) {
      if (currentY + 40 > doc.page.height - 50) {
        doc.addPage();
        currentY = 50;
      }
      currentY = this.drawInfoBlock(doc, terms, leftMargin, currentY, rightEdge - leftMargin) + 10;
    }

    // ── Signatures ─────────────────────────────────────────────────────
    if (options.signatures && options.signatures.length > 0) {
      currentY = this.drawSignatures(doc, leftMargin, rightEdge, currentY, options.signatures);
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
  }

  /**
   * Draw the document's brand mark at (x, y): the issuing company's logo + name
   * (FOR-267) when available, otherwise the plain "Forethread" wordmark. The image
   * draw is guarded so an unsupported or corrupt logo can never break the
   * surrounding document — it simply falls back to the text wordmark.
   */
  private drawBrandMark(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc: any,
    x: number,
    y: number,
    brand: PdfBrand | undefined,
    nameFontSize: number,
  ): void {
    if (brand?.logo) {
      try {
        doc.image(brand.logo, x, y, { fit: [120, 36] });
        doc
          .fontSize(nameFontSize)
          .font('Helvetica-Bold')
          .fillColor(PDF_STYLES.text.primary)
          .text(brand.name, x + 132, y + 10, { width: 170, lineBreak: false, ellipsis: true });
        return;
      } catch {
        // Unsupported/corrupt image — fall through to the text wordmark.
      }
    }

    doc
      .fontSize(nameFontSize)
      .font('Helvetica-Bold')
      .fillColor(PDF_STYLES.text.primary)
      .text(brand?.name ?? PDF_COMPANY.name, x, y, { width: 300 });
  }

  /** Render a label + lines block; returns the Y after the last line. */
  private drawInfoBlock(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc: any,
    block: InvoiceInfoBlock,
    x: number,
    startY: number,
    width = 220,
  ): number {
    let y = startY;
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(PDF_STYLES.text.primary)
      .text(`${block.label}:`, x, y, { width });
    y += 15;

    doc.font('Helvetica');
    for (const line of block.lines) {
      if (line) {
        doc.text(line, x, y, { width });
        y += 12;
      }
    }
    return y;
  }

  /** Render a small bold section heading; returns the Y below it. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private drawSectionHeading(doc: any, leftMargin: number, startY: number, label: string): number {
    let currentY = startY + 8;
    if (currentY + 24 > doc.page.height - 50) {
      doc.addPage();
      currentY = 50;
    }
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor(PDF_STYLES.text.primary)
      .text(label, leftMargin, currentY);
    return currentY + 18;
  }

  /** Render a table (header + rows + optional total); returns the Y below it. */
  private drawTable(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc: any,
    leftMargin: number,
    startY: number,
    columns: PdfTableColumn[],
    rows: InvoiceTableItem[],
    totalRow?: { label: string; value: string },
  ): number {
    let currentY = startY;
    const rowHeight = PDF_TABLE.rowHeight;
    const colSpacing = 12;

    if (rows.length === 0 && !totalRow) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor(PDF_STYLES.text.secondary)
        .text('No data found.', leftMargin, currentY);
      return currentY + 20;
    }

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
        { width: lastCol.width },
      );

      currentY += rowHeight;
    }

    return currentY;
  }

  /** Render signature lines side by side; returns the Y below them. */
  private drawSignatures(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc: any,
    leftMargin: number,
    rightEdge: number,
    startY: number,
    signatures: InvoiceSignatureBlock[],
  ): number {
    const blockHeight = 56;
    let currentY = startY + 24;

    if (currentY + blockHeight > doc.page.height - 50) {
      doc.addPage();
      currentY = 50;
    }

    const gap = 24;
    const slotWidth = (rightEdge - leftMargin - gap) / 2;

    signatures.slice(0, 2).forEach((sig, i) => {
      const x = leftMargin + i * (slotWidth + gap);
      const lineY = currentY + 26;

      // Name (printed above the line, if provided)
      if (sig.name) {
        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor(PDF_STYLES.text.primary)
          .text(sig.name, x, lineY - 14, { width: slotWidth });
      }

      // Signature line (thin filled rect — avoids needing vector path APIs)
      doc.rect(x, lineY, slotWidth, 0.75).fillColor(PDF_STYLES.text.secondary).fill();

      // Caption
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(PDF_STYLES.text.secondary)
        .text(sig.label, x, lineY + 4, { width: slotWidth });
    });

    return currentY + blockHeight;
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
