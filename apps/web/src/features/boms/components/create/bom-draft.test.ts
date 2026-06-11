import { describe, expect, it } from 'vitest';

import {
  emptyRow,
  isRowEmpty,
  realRows,
  rowsFromExtraction,
  rowsToBomResult,
  rowsToCreateItems,
  unmatchedCount,
  type BomDraftRow,
} from './bom-draft';

const extraction = {
  title: 'Site BOM',
  projectName: 'Downtown',
  currency: 'AUD',
  notes: null,
  items: [
    {
      description: 'Portland Cement Type I',
      quantity: 50,
      unit: 'bag',
      targetPrice: null,
      notes: null,
      matchedMaterialId: 'mat-1',
      matchedMaterialName: 'Portland Cement Type I',
      matchConfidence: 0.86,
      matchCandidates: [{ materialId: 'mat-1', name: 'Portland Cement Type I', confidence: 0.86 }],
    },
    {
      description: 'Mystery widget',
      quantity: null,
      unit: null,
      targetPrice: null,
      notes: null,
      matchedMaterialId: null,
      matchedMaterialName: null,
      matchConfidence: null,
      matchCandidates: [],
    },
  ],
};

function matchedRow(overrides: Partial<BomDraftRow> = {}): BomDraftRow {
  return {
    ...emptyRow(),
    materialName: 'Cement',
    description: 'Cement 25kg',
    uom: 'bag',
    quantity: '50',
    matchedMaterialId: 'mat-1',
    matchedMaterialName: 'Portland Cement Type I',
    matchConfidence: 0.86,
    ...overrides,
  };
}

describe('bom-draft', () => {
  it('maps a completed extraction into editable rows', () => {
    const rows = rowsFromExtraction(extraction);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      materialName: 'Portland Cement Type I',
      description: 'Portland Cement Type I',
      uom: 'bag',
      quantity: '50',
      matchedMaterialId: 'mat-1',
      matchConfidence: 0.86,
    });
    expect(rows[1].matchedMaterialId).toBeNull();
    expect(rows[1].candidates).toEqual([]);
  });

  it('returns no rows for a malformed result', () => {
    expect(rowsFromExtraction({ nope: true })).toEqual([]);
    expect(rowsFromExtraction(null)).toEqual([]);
  });

  it('ignores the empty trailing row when counting unmatched lines', () => {
    const rows = [
      matchedRow(),
      matchedRow({ matchedMaterialId: null, matchedMaterialName: null }),
      emptyRow(),
    ];
    expect(unmatchedCount(rows)).toBe(1);
    expect(realRows(rows)).toHaveLength(2);
  });

  it('treats a row with only whitespace as empty', () => {
    const row = { ...emptyRow(), materialName: '   ' };
    expect(isRowEmpty(row)).toBe(true);
  });

  it('maps rows to the create payload, dropping empties and indexing sortOrder', () => {
    const rows = [
      matchedRow(),
      emptyRow(),
      matchedRow({ materialName: '', description: 'Fallback name', quantity: 'abc' }),
    ];
    const items = rowsToCreateItems(rows);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      materialName: 'Cement',
      matchedMaterialId: 'mat-1',
      quantity: 50,
      sortOrder: 0,
    });
    // Falls back to the description when the name is blank; invalid quantity is dropped.
    expect(items[1]).toMatchObject({
      materialName: 'Fallback name',
      quantity: undefined,
      sortOrder: 1,
    });
  });

  it('round-trips rows into the canonical extraction result for confirmation', () => {
    const rows = [matchedRow(), emptyRow()];
    const result = rowsToBomResult(rows, extraction);
    expect(result.title).toBe('Site BOM');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      description: 'Cement',
      quantity: 50,
      unit: 'bag',
      matchedMaterialId: 'mat-1',
    });
  });
});
