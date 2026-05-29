/**
 * Spreadsheet → text adapter for the document-intelligence pipeline.
 *
 * Gemini's document API only accepts PDFs and images, so an uploaded Excel
 * workbook can't be attached as inline data. A spreadsheet is already
 * structured tabular data, though, so we parse it with exceljs and serialise
 * every sheet to tab-separated rows. That text is folded into the Gemini
 * prompt, giving the model the full grid to extract from.
 *
 * Only the OpenXML (`.xlsx`) format is supported — exceljs cannot read the
 * legacy binary `.xls` format.
 */

interface ExcelCellValue {
  text?: string;
  result?: unknown;
  error?: unknown;
  hyperlink?: string;
  richText?: Array<{ text?: string }>;
}

interface ExcelRow {
  values?: unknown[];
}

interface ExcelWorksheet {
  name: string;
  eachRow(
    opts: { includeEmpty: boolean },
    cb: (row: ExcelRow) => void,
  ): void;
}

interface ExcelWorkbook {
  xlsx: { load(buffer: Buffer): Promise<ExcelWorkbook> };
  eachSheet(cb: (sheet: ExcelWorksheet) => void): void;
}

interface ExcelJsModule {
  Workbook: new () => ExcelWorkbook;
}

/**
 * Flatten a single exceljs cell value into a plain string. Handles the richer
 * shapes exceljs returns: dates, formula results, rich text, hyperlinks and
 * error cells.
 */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const v = value as ExcelCellValue;
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text ?? '').join('');
    if (typeof v.text === 'string') return v.text; // hyperlink label
    if ('result' in v) return cellToString(v.result); // formula → computed value
    if (typeof v.error === 'string') return v.error;
    if (typeof v.hyperlink === 'string') return v.hyperlink;
  }
  return '';
}

/**
 * Parse an `.xlsx` buffer and return its contents as tab-separated text, one
 * section per worksheet. Empty rows are skipped. Returns an empty string for a
 * workbook with no rows.
 */
export async function spreadsheetToText(buffer: Buffer): Promise<string> {
  // exceljs is a CommonJS module; require keeps it consistent with the rest of
  // the backend (see pdf-export.service.ts) and sidesteps ESM interop issues.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ExcelJS = require('exceljs') as ExcelJsModule;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sections: string[] = [];
  workbook.eachSheet((sheet) => {
    const lines: string[] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      // row.values is 1-based — index 0 is always empty. join() turns any
      // interior gaps (sparse holes) back into empty cells, keeping columns aligned.
      const cells = (row.values ?? []).slice(1).map(cellToString);
      lines.push(cells.join('\t'));
    });
    if (lines.length > 0) {
      sections.push(`# Sheet: ${sheet.name}\n${lines.join('\n')}`);
    }
  });

  return sections.join('\n\n');
}
