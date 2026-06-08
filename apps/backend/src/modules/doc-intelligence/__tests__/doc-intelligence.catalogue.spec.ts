import {
  normalizeCatalogueResult,
  spreadsheetToCatalogue,
} from '../doc-intelligence.catalogue';

// exceljs is CommonJS; require keeps it consistent with the parser under test.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ExcelJS = require('exceljs');

/** Build a small in-memory .xlsx buffer from a header row + data rows. */
async function makeXlsx(
  rows: Array<Array<string | number>>,
  sheetName = 'Sheet1',
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  rows.forEach((row) => sheet.addRow(row));
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe('spreadsheetToCatalogue', () => {
  it('maps header synonyms to catalogue fields', async () => {
    const buffer = await makeXlsx([
      ['Name', 'SKU', 'BrandName', 'Manufacturer Part Numbr', 'UPC', 'UOM', 'Main Category', 'Sub Category'],
      ['Cable Tie', 'CT-100', 'Acme', 'MPN-1', '012345678905', 'ea', 'Electrical', 'Fixings'],
    ]);

    const result = await spreadsheetToCatalogue(buffer);

    expect(result.sourceName).toBe('Sheet1');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      name: 'Cable Tie',
      sku: 'CT-100',
      brand: 'Acme',
      manufacturerPartNumber: 'MPN-1',
      upc: '012345678905',
      uom: 'ea',
      description: null,
      mainCategory: 'Electrical',
      subCategory: 'Fixings',
      imageUrl: null,
      confidence: 1,
    });
  });

  it('treats "Material Description" as the name and a separate "description" as the long blurb', async () => {
    const buffer = await makeXlsx([
      ['Material Description', 'Description', 'SKU'],
      ['Short Name', 'A much longer descriptive blurb', 'SK-1'],
    ]);

    const result = await spreadsheetToCatalogue(buffer);

    expect(result.items[0].name).toBe('Short Name');
    expect(result.items[0].description).toBe('A much longer descriptive blurb');
  });

  it('skips rows whose status is OBSOLETE/INACTIVE/ARCHIVED (case-insensitive)', async () => {
    const buffer = await makeXlsx([
      ['Name', 'Status'],
      ['Active Item', 'ACTIVE'],
      ['Dead Item', 'Obsolete'],
      ['Gone Item', 'inactive'],
      ['Old Item', 'ARCHIVED'],
    ]);

    const result = await spreadsheetToCatalogue(buffer);

    expect(result.items.map((i) => i.name)).toEqual(['Active Item']);
  });

  it('canonicalises the uom column', async () => {
    const buffer = await makeXlsx([
      ['Name', 'Unit'],
      ['Wire', 'EA'],
      ['Pipe', 'LM'],
      ['Bolt', 'pcs'],
    ]);

    const result = await spreadsheetToCatalogue(buffer);

    expect(result.items.map((i) => i.uom)).toEqual(['ea', 'm', 'ea']);
  });

  it('skips rows with an empty name', async () => {
    const buffer = await makeXlsx([
      ['Name', 'SKU'],
      ['Real', 'S-1'],
      ['', 'S-2'],
      ['   ', 'S-3'],
    ]);

    const result = await spreadsheetToCatalogue(buffer);

    expect(result.items.map((i) => i.sku)).toEqual(['S-1']);
  });

  it('returns an empty result when the workbook has no rows', async () => {
    const buffer = await makeXlsx([]);
    const result = await spreadsheetToCatalogue(buffer);
    expect(result.items).toEqual([]);
  });
});

describe('normalizeCatalogueResult', () => {
  it('returns the empty result when input is not an object', () => {
    expect(normalizeCatalogueResult(null)).toMatchObject({ items: [] });
    expect(normalizeCatalogueResult('nope')).toMatchObject({ items: [] });
    expect(normalizeCatalogueResult(42)).toMatchObject({ items: [] });
  });

  it('normalizes items defensively and drops rows with no name', () => {
    const result = normalizeCatalogueResult({
      sourceName: '  Rexel Catalogue ',
      items: [
        {
          name: '  Switch 1G ',
          sku: ' SW-1 ',
          brandName: 'Acme',
          mpn: 'MPN-9',
          barcode: '111',
          unit: 'EACH',
          longDescription: 'A long blurb',
          category: 'Electrical',
          subcategory: 'Switches',
          confidence: 0.9,
        },
        { sku: 'no-name' },
        null,
      ],
      notes: ' top notes ',
    });

    expect(result.sourceName).toBe('Rexel Catalogue');
    expect(result.notes).toBe('top notes');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      name: 'Switch 1G',
      sku: 'SW-1',
      brand: 'Acme',
      manufacturerPartNumber: 'MPN-9',
      upc: '111',
      uom: 'ea',
      description: 'A long blurb',
      mainCategory: 'Electrical',
      subCategory: 'Switches',
      imageUrl: null,
      confidence: 0.9,
    });
  });

  it('reads from `lineItems` when `items` is absent and defaults confidence to null', () => {
    const result = normalizeCatalogueResult({ lineItems: [{ name: 'X' }] });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].confidence).toBeNull();
  });
});
