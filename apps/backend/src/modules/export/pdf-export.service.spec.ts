/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports, import/order */
const EventEmitter = require('events');

jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => {
    const doc = new EventEmitter();
    doc.page = { width: 595, height: 842, margins: { top: 50, bottom: 50, left: 40, right: 40 } };
    doc.y = 100;
    doc.fontSize = jest.fn().mockReturnThis();
    doc.font = jest.fn().mockReturnThis();
    doc.fillColor = jest.fn().mockReturnThis();
    doc.text = jest.fn().mockReturnThis();
    doc.moveDown = jest.fn().mockReturnThis();
    doc.rect = jest.fn().mockReturnThis();
    doc.fill = jest.fn().mockReturnThis();
    doc.addPage = jest.fn().mockReturnThis();
    doc.heightOfString = jest.fn().mockReturnValue(10);
    doc.bufferedPageRange = jest.fn().mockReturnValue({ start: 0, count: 1 });
    doc.switchToPage = jest.fn().mockReturnThis();
    doc.end = jest.fn(() => {
      process.nextTick(() => {
        doc.emit('data', Buffer.from('fake-pdf'));
        doc.emit('end');
      });
    });
    return doc;
  });
});

const mockAddRow = jest.fn().mockReturnValue({
  eachCell: jest.fn((cb: (cell: { font: unknown; fill: unknown; border: unknown }) => void) =>
    cb({ font: null, fill: null, border: null }),
  ),
});
const mockGetColumn = jest.fn().mockReturnValue({ width: 10 });
const mockWriteBuffer = jest.fn().mockResolvedValue(Buffer.from('fake-xlsx'));

jest.mock('exceljs', () => ({
  Workbook: jest.fn().mockImplementation(() => ({
    addWorksheet: jest.fn().mockReturnValue({
      addRow: mockAddRow,
      getColumn: mockGetColumn,
    }),
    xlsx: { writeBuffer: mockWriteBuffer },
  })),
}));

import { PdfExportService } from './pdf-export.service';
import type {
  PdfExportOptions,
  InvoiceExportOptions,
  CsvExportOptions,
} from './pdf-export.service';

/** Build a mocked pdfkit doc, merging in any extra method overrides (e.g. image). */
function mockDocWith(extra = {}) {
  const doc = new EventEmitter();
  doc.page = { width: 595, height: 842, margins: { top: 50, bottom: 50, left: 40, right: 40 } };
  doc.y = 100;
  doc.fontSize = jest.fn().mockReturnThis();
  doc.font = jest.fn().mockReturnThis();
  doc.fillColor = jest.fn().mockReturnThis();
  doc.text = jest.fn().mockReturnThis();
  doc.moveDown = jest.fn().mockReturnThis();
  doc.rect = jest.fn().mockReturnThis();
  doc.fill = jest.fn().mockReturnThis();
  doc.addPage = jest.fn().mockReturnThis();
  doc.heightOfString = jest.fn().mockReturnValue(10);
  doc.bufferedPageRange = jest.fn().mockReturnValue({ start: 0, count: 1 });
  doc.switchToPage = jest.fn().mockReturnThis();
  doc.end = jest.fn(() => {
    process.nextTick(() => {
      doc.emit('data', Buffer.from('fake-pdf'));
      doc.emit('end');
    });
  });
  return Object.assign(doc, extra);
}

describe('PdfExportService', () => {
  let service: PdfExportService;
  const mockUploadBuffer = jest.fn().mockResolvedValue({ key: 'exports/test.pdf', bucket: 'test' });
  const mockGetSignedUrl = jest.fn().mockResolvedValue('https://signed.url/exports/test.pdf');
  const mockStorageService = {
    uploadBuffer: mockUploadBuffer,
    getSignedUrl: mockGetSignedUrl,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PdfExportService(mockStorageService as never);
  });

  describe('exportToPDF', () => {
    const baseOptions: PdfExportOptions = {
      title: 'Test Report',
      columns: [
        { header: 'Name', width: 200 },
        { header: 'Value', width: 100 },
      ],
      rows: [
        { Name: 'Item 1', Value: '100' },
        { Name: 'Item 2', Value: '200' },
      ],
      filenamePrefix: 'test-report',
    };

    it('generates a PDF, uploads it, and returns a signed URL', async () => {
      const result = await service.exportToPDF(baseOptions);

      expect(mockUploadBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          buffer: expect.any(Buffer),
          filename: expect.stringContaining('test-report_'),
          contentType: 'application/pdf',
          folder: 'exports',
        }),
      );
      expect(mockGetSignedUrl).toHaveBeenCalledWith('exports/test.pdf');
      expect(result).toEqual({ url: 'https://signed.url/exports/test.pdf' });
    });

    it('handles empty rows (no data case)', async () => {
      const options: PdfExportOptions = { ...baseOptions, rows: [] };
      const result = await service.exportToPDF(options);

      expect(result).toEqual({ url: 'https://signed.url/exports/test.pdf' });
      expect(mockUploadBuffer).toHaveBeenCalled();
    });

    it('draws the company logo + name in the header when a brand is provided (FOR-267)', async () => {
      const PDFDocument = require('pdfkit');
      const imageFn = jest.fn().mockReturnThis();
      PDFDocument.mockImplementationOnce(() => mockDocWith({ image: imageFn }));

      await service.exportToPDF({
        ...baseOptions,
        brand: { name: 'Acme Builders', logo: Buffer.from('png-bytes') },
      } as PdfExportOptions);

      expect(imageFn).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({ fit: [120, 36] }),
      );
    });

    it('falls back to the wordmark when the logo image fails to render (FOR-267)', async () => {
      const PDFDocument = require('pdfkit');
      const imageFn = jest.fn(() => {
        throw new Error('unsupported image');
      });
      PDFDocument.mockImplementationOnce(() => mockDocWith({ image: imageFn }));

      const result = await service.exportToPDF({
        ...baseOptions,
        brand: { name: 'Acme Builders', logo: Buffer.from('bad') },
      } as PdfExportOptions);

      expect(imageFn).toHaveBeenCalled();
      expect(result).toEqual({ url: 'https://signed.url/exports/test.pdf' });
    });

    it('renders subtitle when provided', async () => {
      const options: PdfExportOptions = { ...baseOptions, subtitle: 'Sub title text' };
      const result = await service.exportToPDF(options);

      expect(result).toEqual({ url: 'https://signed.url/exports/test.pdf' });
    });

    it('passes landscape layout option', async () => {
      const PDFDocument = require('pdfkit');
      const options: PdfExportOptions = { ...baseOptions, landscape: true };
      await service.exportToPDF(options);

      expect(PDFDocument).toHaveBeenCalledWith(expect.objectContaining({ layout: 'landscape' }));
    });

    it('passes portrait layout when landscape is falsy', async () => {
      const PDFDocument = require('pdfkit');
      await service.exportToPDF(baseOptions);

      expect(PDFDocument).toHaveBeenCalledWith(expect.objectContaining({ layout: 'portrait' }));
    });

    it('adds pages when rows exceed page height', async () => {
      const manyRows = Array.from({ length: 50 }, (_, i) => ({
        Name: `Item ${i}`,
        Value: `${i * 100}`,
      }));

      const PDFDocument = require('pdfkit');
      PDFDocument.mockImplementationOnce(() => {
        const doc = new EventEmitter();
        doc.page = {
          width: 595,
          height: 200,
          margins: { top: 50, bottom: 50, left: 40, right: 40 },
        };
        doc.y = 100;
        doc.fontSize = jest.fn().mockReturnThis();
        doc.font = jest.fn().mockReturnThis();
        doc.fillColor = jest.fn().mockReturnThis();
        doc.text = jest.fn().mockReturnThis();
        doc.moveDown = jest.fn().mockReturnThis();
        doc.rect = jest.fn().mockReturnThis();
        doc.fill = jest.fn().mockReturnThis();
        doc.addPage = jest.fn().mockReturnThis();
        doc.heightOfString = jest.fn().mockReturnValue(10);
        doc.bufferedPageRange = jest.fn().mockReturnValue({ start: 0, count: 1 });
        doc.switchToPage = jest.fn().mockReturnThis();
        doc.end = jest.fn(() => {
          process.nextTick(() => {
            doc.emit('data', Buffer.from('fake-pdf'));
            doc.emit('end');
          });
        });
        return doc;
      });

      const options: PdfExportOptions = { ...baseOptions, rows: manyRows };
      const result = await service.exportToPDF(options);

      expect(result).toEqual({ url: 'https://signed.url/exports/test.pdf' });
    });

    it('stamps the "Generated by Forethread" footer on every page (FOR-389)', async () => {
      const PDFDocument = require('pdfkit');
      const doc = mockDocWith({
        bufferedPageRange: jest.fn().mockReturnValue({ start: 0, count: 3 }),
      });
      PDFDocument.mockImplementationOnce(() => doc);

      await service.exportToPDF(baseOptions);

      expect(PDFDocument).toHaveBeenLastCalledWith(expect.objectContaining({ bufferPages: true }));
      expect(doc.switchToPage.mock.calls.map((c: number[]) => c[0])).toEqual([0, 1, 2]);
      const texts = doc.text.mock.calls.map((c: unknown[]) => c[0]);
      expect(texts.filter((t: string) => t.startsWith('Generated by Forethread'))).toHaveLength(3);
      expect(texts).toEqual(expect.arrayContaining(['Page 1 of 3', 'Page 2 of 3', 'Page 3 of 3']));
      // The bottom margin is restored after each footer is drawn.
      expect(doc.page.margins.bottom).toBe(50);
    });

    it('scales columns when total width exceeds page width', async () => {
      const wideOptions: PdfExportOptions = {
        title: 'Wide Report',
        columns: [
          { header: 'A', width: 200 },
          { header: 'B', width: 200 },
          { header: 'C', width: 200 },
          { header: 'D', width: 200 },
        ],
        rows: [{ A: '1', B: '2', C: '3', D: '4' }],
        filenamePrefix: 'wide-report',
      };
      const result = await service.exportToPDF(wideOptions);
      expect(result).toEqual({ url: 'https://signed.url/exports/test.pdf' });
    });

    it('handles rows with missing column keys (falls back to empty string)', async () => {
      const options: PdfExportOptions = {
        ...baseOptions,
        rows: [{ Name: 'Item 1' }], // Missing 'Value' key
      };
      const result = await service.exportToPDF(options);
      expect(result).toEqual({ url: 'https://signed.url/exports/test.pdf' });
    });

    it('rejects on upload error', async () => {
      mockUploadBuffer.mockRejectedValueOnce(new Error('Upload failed'));
      await expect(service.exportToPDF(baseOptions)).rejects.toThrow('Upload failed');
    });

    it('wraps non-Error rejection in Error', async () => {
      mockUploadBuffer.mockRejectedValueOnce('string-error');
      await expect(service.exportToPDF(baseOptions)).rejects.toThrow('string-error');
    });

    it('rejects on PDFDocument error event', async () => {
      const PDFDocument = require('pdfkit');
      PDFDocument.mockImplementationOnce(() => {
        const doc = new EventEmitter();
        doc.page = {
          width: 595,
          height: 842,
          margins: { top: 50, bottom: 50, left: 40, right: 40 },
        };
        doc.y = 100;
        doc.fontSize = jest.fn().mockReturnThis();
        doc.font = jest.fn().mockReturnThis();
        doc.fillColor = jest.fn().mockReturnThis();
        doc.text = jest.fn().mockReturnThis();
        doc.moveDown = jest.fn().mockReturnThis();
        doc.rect = jest.fn().mockReturnThis();
        doc.fill = jest.fn().mockReturnThis();
        doc.addPage = jest.fn().mockReturnThis();
        doc.heightOfString = jest.fn().mockReturnValue(10);
        doc.bufferedPageRange = jest.fn().mockReturnValue({ start: 0, count: 1 });
        doc.switchToPage = jest.fn().mockReturnThis();
        doc.end = jest.fn(() => {
          process.nextTick(() => {
            doc.emit('error', new Error('PDF generation failed'));
          });
        });
        return doc;
      });

      await expect(service.exportToPDF(baseOptions)).rejects.toThrow('PDF generation failed');
    });
  });

  describe('exportInvoicePDF', () => {
    const baseOptions: InvoiceExportOptions = {
      heading: 'Invoice',
      date: '01/01/2026',
      columns: [
        { header: 'Description', width: 250 },
        { header: 'Amount', width: 100 },
      ],
      rows: [
        { Description: 'Service A', Amount: '$100' },
        { Description: 'Service B', Amount: '$200' },
      ],
      filenamePrefix: 'invoice-test',
    };

    it('generates an invoice PDF and returns a signed URL', async () => {
      const result = await service.exportInvoicePDF(baseOptions);

      expect(mockUploadBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          buffer: expect.any(Buffer),
          filename: expect.stringContaining('invoice-test_'),
          contentType: 'application/pdf',
          folder: 'exports',
        }),
      );
      expect(result).toEqual({ url: 'https://signed.url/exports/test.pdf' });
    });

    it('renders with infoLeft and infoRight blocks', async () => {
      const options: InvoiceExportOptions = {
        ...baseOptions,
        infoLeft: { label: 'From', lines: ['Company A', '123 Street', ''] },
        infoRight: { label: 'To', lines: ['Company B', '456 Avenue'] },
      };

      const result = await service.exportInvoicePDF(options);
      expect(result).toEqual({ url: 'https://signed.url/exports/test.pdf' });
    });

    it('draws the company logo in the document header when a brand is provided (FOR-267)', async () => {
      const PDFDocument = require('pdfkit');
      const imageFn = jest.fn().mockReturnThis();
      PDFDocument.mockImplementationOnce(() => mockDocWith({ image: imageFn }));

      await service.exportInvoicePDF({
        ...baseOptions,
        brand: { name: 'Acme Builders', logo: Buffer.from('png-bytes') },
      } as InvoiceExportOptions);

      expect(imageFn).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({ fit: [120, 36] }),
      );
    });

    it('renders without infoLeft and infoRight', async () => {
      const options: InvoiceExportOptions = {
        ...baseOptions,
        infoLeft: undefined,
        infoRight: undefined,
      };

      const result = await service.exportInvoicePDF(options);
      expect(result).toEqual({ url: 'https://signed.url/exports/test.pdf' });
    });

    it('renders totalRow when provided', async () => {
      const options: InvoiceExportOptions = {
        ...baseOptions,
        totalRow: { label: 'Total', value: '$300' },
      };

      const result = await service.exportInvoicePDF(options);
      expect(result).toEqual({ url: 'https://signed.url/exports/test.pdf' });
    });

    it('handles empty rows', async () => {
      const options: InvoiceExportOptions = { ...baseOptions, rows: [] };
      const result = await service.exportInvoicePDF(options);
      expect(result).toEqual({ url: 'https://signed.url/exports/test.pdf' });
    });

    it('handles invoice rows with missing column keys', async () => {
      const options: InvoiceExportOptions = {
        ...baseOptions,
        rows: [{ Description: 'Service A' }], // Missing 'Amount' key
      };
      const result = await service.exportInvoicePDF(options);
      expect(result).toEqual({ url: 'https://signed.url/exports/test.pdf' });
    });

    it('rejects on upload error', async () => {
      mockUploadBuffer.mockRejectedValueOnce(new Error('Upload failed'));
      await expect(service.exportInvoicePDF(baseOptions)).rejects.toThrow('Upload failed');
    });

    it('wraps non-Error rejection in Error', async () => {
      mockUploadBuffer.mockRejectedValueOnce('string-error');
      await expect(service.exportInvoicePDF(baseOptions)).rejects.toThrow('string-error');
    });

    it('rejects on PDFDocument error event', async () => {
      const PDFDocument = require('pdfkit');
      PDFDocument.mockImplementationOnce(() => {
        const doc = new EventEmitter();
        doc.page = {
          width: 595,
          height: 842,
          margins: { top: 50, bottom: 50, left: 40, right: 40 },
        };
        doc.y = 100;
        doc.fontSize = jest.fn().mockReturnThis();
        doc.font = jest.fn().mockReturnThis();
        doc.fillColor = jest.fn().mockReturnThis();
        doc.text = jest.fn().mockReturnThis();
        doc.moveDown = jest.fn().mockReturnThis();
        doc.rect = jest.fn().mockReturnThis();
        doc.fill = jest.fn().mockReturnThis();
        doc.addPage = jest.fn().mockReturnThis();
        doc.heightOfString = jest.fn().mockReturnValue(10);
        doc.bufferedPageRange = jest.fn().mockReturnValue({ start: 0, count: 1 });
        doc.switchToPage = jest.fn().mockReturnThis();
        doc.end = jest.fn(() => {
          process.nextTick(() => {
            doc.emit('error', new Error('PDF error'));
          });
        });
        return doc;
      });

      await expect(service.exportInvoicePDF(baseOptions)).rejects.toThrow('PDF error');
    });

    it('adds pages when rows and totalRow overflow page height', async () => {
      const PDFDocument = require('pdfkit');
      PDFDocument.mockImplementationOnce(() => {
        const doc = new EventEmitter();
        doc.page = {
          width: 595,
          height: 200,
          margins: { top: 50, bottom: 50, left: 40, right: 40 },
        };
        doc.y = 100;
        doc.fontSize = jest.fn().mockReturnThis();
        doc.font = jest.fn().mockReturnThis();
        doc.fillColor = jest.fn().mockReturnThis();
        doc.text = jest.fn().mockReturnThis();
        doc.moveDown = jest.fn().mockReturnThis();
        doc.rect = jest.fn().mockReturnThis();
        doc.fill = jest.fn().mockReturnThis();
        doc.addPage = jest.fn().mockReturnThis();
        doc.heightOfString = jest.fn().mockReturnValue(10);
        doc.bufferedPageRange = jest.fn().mockReturnValue({ start: 0, count: 1 });
        doc.switchToPage = jest.fn().mockReturnThis();
        doc.end = jest.fn(() => {
          process.nextTick(() => {
            doc.emit('data', Buffer.from('fake-pdf'));
            doc.emit('end');
          });
        });
        return doc;
      });

      const manyRows = Array.from({ length: 30 }, (_, i) => ({
        Description: `Service ${i}`,
        Amount: `$${i * 100}`,
      }));

      const options: InvoiceExportOptions = {
        ...baseOptions,
        rows: manyRows,
        totalRow: { label: 'Total', value: '$10000' },
      };

      const result = await service.exportInvoicePDF(options);
      expect(result).toEqual({ url: 'https://signed.url/exports/test.pdf' });
    });

    it('stamps the "Generated by Forethread" footer on every page (FOR-389)', async () => {
      const PDFDocument = require('pdfkit');
      const doc = mockDocWith({
        bufferedPageRange: jest.fn().mockReturnValue({ start: 0, count: 2 }),
      });
      PDFDocument.mockImplementationOnce(() => doc);

      await service.exportInvoicePDF(baseOptions);

      expect(PDFDocument).toHaveBeenLastCalledWith(expect.objectContaining({ bufferPages: true }));
      const texts = doc.text.mock.calls.map((c: unknown[]) => c[0]);
      expect(texts.filter((t: string) => t.startsWith('Generated by Forethread'))).toHaveLength(2);
      expect(texts).toEqual(expect.arrayContaining(['Page 1 of 2', 'Page 2 of 2']));
    });

    describe('A4 table layout (FOR-388)', () => {
      const PRINTABLE_RIGHT = 595 - 40;
      // The pre-fix PO line table: 520pt of columns + gaps = 568pt, past the page edge.
      const wideColumns = [
        { header: 'Item', width: 200 },
        { header: 'Qty', width: 60, align: 'right' as const },
        { header: 'Unit', width: 60 },
        { header: 'Unit Price', width: 100, align: 'right' as const },
        { header: 'Total', width: 100, align: 'right' as const },
      ];
      const wideRow = {
        Item: 'Item',
        Qty: '1',
        Unit: 'ea',
        'Unit Price': '$1.00',
        Total: '$1.00',
      };

      async function renderWith(options: Partial<InvoiceExportOptions>, extra = {}) {
        const PDFDocument = require('pdfkit');
        const doc = mockDocWith(extra);
        PDFDocument.mockImplementationOnce(() => doc);
        await service.exportInvoicePDF({ ...baseOptions, ...options });
        return doc;
      }

      it('keeps every table cell and row background inside the printable width', async () => {
        const doc = await renderWith({
          columns: wideColumns,
          rows: [wideRow],
          totalRow: { label: 'Total Amount', value: '$1.00' },
          sections: [
            {
              label: 'Delivery Schedule',
              columns: [
                { header: '#', width: 30 },
                { header: 'Location', width: 200 },
                { header: 'Date', width: 130 },
                { header: 'Notes', width: 150 },
              ],
              rows: [{ '#': '1', Location: 'Site', Date: 'Today', Notes: '' }],
            },
          ],
        });

        for (const [x, , width] of doc.rect.mock.calls as number[][]) {
          expect(x + width).toBeLessThanOrEqual(PRINTABLE_RIGHT);
        }
        for (const [, x, , opts] of doc.text.mock.calls as [
          string,
          number,
          number,
          { width?: number },
        ][]) {
          if (opts?.width) expect(x + opts.width).toBeLessThanOrEqual(PRINTABLE_RIGHT);
        }
      });

      it('right-aligns numeric columns, header and cells alike', async () => {
        const doc = await renderWith({ columns: wideColumns, rows: [wideRow] });
        const alignOf = (text: string) =>
          doc.text.mock.calls
            .filter((c: unknown[]) => c[0] === text)
            .map((c: [string, number, number, { align?: string }]) => c[3]?.align);

        expect(alignOf('Unit Price')).toEqual(['right']);
        expect(alignOf('$1.00')).toEqual(['right', 'right']);
        expect(alignOf('Item')).toEqual(['left', 'left']);
      });

      it('grows the row to fit wrapped text instead of overlapping the next row', async () => {
        const doc = await renderWith(
          { columns: wideColumns, rows: [{ ...wideRow, Item: 'A very long material name' }] },
          {
            heightOfString: jest.fn((text: string) => (text.startsWith('A very long') ? 60 : 10)),
          },
        );
        // Row backgrounds: header (min height), then the data row sized to 60 + padding.
        const heights = doc.rect.mock.calls.map((c: number[]) => c[3]);
        expect(heights).toContain(60 + 16);
      });

      it('repeats the header row on every page the table spills onto', async () => {
        const rows = Array.from({ length: 40 }, (_, i) => ({ ...wideRow, Item: `Item ${i}` }));
        const doc = await renderWith({ columns: wideColumns, rows });

        const headerDraws = doc.text.mock.calls.filter((c: unknown[]) => c[0] === 'Unit Price');
        expect(doc.addPage).toHaveBeenCalled();
        expect(headerDraws).toHaveLength(doc.addPage.mock.calls.length + 1);
      });

      it('does not mutate the caller column widths', async () => {
        const columns = wideColumns.map((c) => ({ ...c }));
        await renderWith({ columns, rows: [wideRow] });
        expect(columns).toEqual(wideColumns);
      });
    });

    it('advances info-block lines by their measured (wrapped) height', async () => {
      const PDFDocument = require('pdfkit');
      const doc = mockDocWith({
        heightOfString: jest.fn((text: string) => (text === 'Long wrapped line' ? 36 : 10)),
      });
      PDFDocument.mockImplementationOnce(() => doc);

      await service.exportInvoicePDF({
        ...baseOptions,
        infoLeft: { label: 'From', lines: ['Long wrapped line', 'Next line'] },
      });

      const yOf = (text: string) =>
        doc.text.mock.calls.find((c: unknown[]) => c[0] === text)[2] as number;
      expect(yOf('Next line') - yOf('Long wrapped line')).toBe(36);
    });
  });

  describe('exportToCSV', () => {
    const baseOptions: CsvExportOptions = {
      headers: ['Name', 'Value'],
      rows: [
        ['Item 1', '100'],
        ['Item 2', '200'],
      ],
      filenamePrefix: 'test-csv',
    };

    it('generates CSV and returns a signed URL', async () => {
      const result = await service.exportToCSV(baseOptions);

      expect(mockUploadBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          buffer: expect.any(Buffer),
          filename: expect.stringContaining('test-csv_'),
          contentType: 'text/csv;charset=utf-8',
          folder: 'exports',
        }),
      );
      expect(mockGetSignedUrl).toHaveBeenCalledWith('exports/test.pdf');
      expect(result).toEqual({ url: 'https://signed.url/exports/test.pdf' });
    });

    it('includes BOM in CSV buffer', async () => {
      await service.exportToCSV(baseOptions);

      const uploadCall = mockUploadBuffer.mock.calls[0][0];
      const csvContent = (uploadCall.buffer as Buffer).toString('utf-8');
      expect(csvContent.startsWith('\uFEFF')).toBe(true);
    });

    it('uses semicolon as delimiter', async () => {
      await service.exportToCSV(baseOptions);

      const uploadCall = mockUploadBuffer.mock.calls[0][0];
      const csvContent = (uploadCall.buffer as Buffer).toString('utf-8');
      expect(csvContent).toContain('"Name";"Value"');
    });

    it('escapes values containing double quotes', async () => {
      const options: CsvExportOptions = {
        ...baseOptions,
        rows: [['Item "quoted"', '100']],
      };
      await service.exportToCSV(options);

      const uploadCall = mockUploadBuffer.mock.calls[0][0];
      const csvContent = (uploadCall.buffer as Buffer).toString('utf-8');
      expect(csvContent).toContain('"Item ""quoted"""');
    });

    it('replaces newlines in values', async () => {
      const options: CsvExportOptions = {
        ...baseOptions,
        rows: [['Line1\nLine2\rLine3', '100']],
      };
      await service.exportToCSV(options);

      const uploadCall = mockUploadBuffer.mock.calls[0][0];
      const csvContent = (uploadCall.buffer as Buffer).toString('utf-8');
      expect(csvContent).toContain('"Line1 Line2Line3"');
    });

    it('handles null and undefined values', async () => {
      const options: CsvExportOptions = {
        ...baseOptions,
        rows: [[null as unknown as string, undefined as unknown as string]],
      };
      await service.exportToCSV(options);

      const uploadCall = mockUploadBuffer.mock.calls[0][0];
      const csvContent = (uploadCall.buffer as Buffer).toString('utf-8');
      // The data row contains two empty quoted strings separated by semicolon
      expect(csvContent).toContain('"";""');
    });

    it('handles empty rows array', async () => {
      const options: CsvExportOptions = { ...baseOptions, rows: [] };
      const result = await service.exportToCSV(options);

      expect(result).toEqual({ url: 'https://signed.url/exports/test.pdf' });
    });
  });

  describe('exportToXLSX', () => {
    const baseOptions: CsvExportOptions = {
      headers: ['Name', 'Value'],
      rows: [
        ['Item 1', '100'],
        ['Item 2', '200'],
      ],
      filenamePrefix: 'test-xlsx',
    };

    it('generates XLSX and returns a signed URL', async () => {
      const result = await service.exportToXLSX(baseOptions);

      expect(mockUploadBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          buffer: expect.any(Buffer),
          filename: expect.stringContaining('test-xlsx_'),
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          folder: 'exports',
        }),
      );
      expect(result).toEqual({ url: 'https://signed.url/exports/test.pdf' });
    });

    it('creates a worksheet named Export', async () => {
      const ExcelJS = require('exceljs');
      await service.exportToXLSX(baseOptions);

      const workbookInstance = ExcelJS.Workbook.mock.results[0].value;
      expect(workbookInstance.addWorksheet).toHaveBeenCalledWith('Export');
    });

    it('adds header row and data rows', async () => {
      await service.exportToXLSX(baseOptions);

      // header + 2 data rows = 3 addRow calls
      expect(mockAddRow).toHaveBeenCalledTimes(3);
      expect(mockAddRow).toHaveBeenCalledWith(['Name', 'Value']);
      expect(mockAddRow).toHaveBeenCalledWith(['Item 1', '100']);
      expect(mockAddRow).toHaveBeenCalledWith(['Item 2', '200']);
    });

    it('sets column widths based on content', async () => {
      await service.exportToXLSX(baseOptions);

      expect(mockGetColumn).toHaveBeenCalledWith(1);
      expect(mockGetColumn).toHaveBeenCalledWith(2);
    });

    it('handles empty rows array', async () => {
      const options: CsvExportOptions = { ...baseOptions, rows: [] };
      const result = await service.exportToXLSX(options);

      expect(result).toEqual({ url: 'https://signed.url/exports/test.pdf' });
      // Only header row
      expect(mockAddRow).toHaveBeenCalledTimes(1);
    });

    it('applies styling to header cells', async () => {
      await service.exportToXLSX(baseOptions);

      const headerRowResult = mockAddRow.mock.results[0].value;
      expect(headerRowResult.eachCell).toHaveBeenCalled();
    });
  });
});
