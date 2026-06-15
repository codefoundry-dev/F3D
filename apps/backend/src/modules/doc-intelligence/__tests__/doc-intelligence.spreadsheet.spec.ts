import { listSpreadsheetSheets, spreadsheetToText } from '../doc-intelligence.spreadsheet';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ExcelJS = require('exceljs');

async function toBuffer(workbook: {
  xlsx: { writeBuffer(): Promise<ArrayBuffer> };
}): Promise<Buffer> {
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('spreadsheetToText', () => {
  it('serialises a single sheet to tab-separated rows under a sheet marker', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('BOM');
    sheet.addRow(['Description', 'Qty', 'Unit', 'Target Price']);
    sheet.addRow(['Cement 25kg bag', 50, 'bag', 12.5]);
    sheet.addRow(['Rebar #4', 1200, 'm', 2.15]);

    const text = await spreadsheetToText(await toBuffer(workbook));

    expect(text).toContain('# Sheet: BOM');
    expect(text).toContain('Description\tQty\tUnit\tTarget Price');
    expect(text).toContain('Cement 25kg bag\t50\tbag\t12.5');
    expect(text).toContain('Rebar #4\t1200\tm\t2.15');
  });

  it('serialises multiple worksheets into separate sections', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('First').addRow(['a', 'b']);
    workbook.addWorksheet('Second').addRow(['c', 'd']);

    const text = await spreadsheetToText(await toBuffer(workbook));

    expect(text).toContain('# Sheet: First');
    expect(text).toContain('a\tb');
    expect(text).toContain('# Sheet: Second');
    expect(text).toContain('c\td');
  });

  it('serialises only the requested sheets when `only` is provided', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Sheet1').addRow(['scratch', 'data']);
    workbook.addWorksheet('HDPE').addRow(['real', 'bom']);

    const text = await spreadsheetToText(await toBuffer(workbook), ['HDPE']);

    expect(text).toContain('# Sheet: HDPE');
    expect(text).toContain('real\tbom');
    expect(text).not.toContain('# Sheet: Sheet1');
    expect(text).not.toContain('scratch\tdata');
  });

  it('serialises every sheet when `only` is an empty list', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('First').addRow(['a', 'b']);
    workbook.addWorksheet('Second').addRow(['c', 'd']);

    const text = await spreadsheetToText(await toBuffer(workbook), []);

    expect(text).toContain('# Sheet: First');
    expect(text).toContain('# Sheet: Second');
  });

  it('flattens formula results and hyperlinks to plain cell text', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Mixed');
    sheet.addRow([
      { formula: 'SUM(40,2)', result: 42 },
      { text: 'Acme', hyperlink: 'https://acme.test' },
    ]);

    const text = await spreadsheetToText(await toBuffer(workbook));

    expect(text).toContain('42\tAcme');
  });

  it('returns an empty string for a workbook with no rows', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Empty');

    const text = await spreadsheetToText(await toBuffer(workbook));

    expect(text).toBe('');
  });
});

describe('listSpreadsheetSheets', () => {
  it('returns the names of sheets that carry data, in workbook order', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Sheet1').addRow(['scratch']);
    workbook.addWorksheet('HDPE').addRow(['real']);

    const names = await listSpreadsheetSheets(await toBuffer(workbook));

    expect(names).toEqual(['Sheet1', 'HDPE']);
  });

  it('omits empty sheets so the picker only offers sheets with rows', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Empty');
    workbook.addWorksheet('Data').addRow(['x']);

    const names = await listSpreadsheetSheets(await toBuffer(workbook));

    expect(names).toEqual(['Data']);
  });
});
