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
      matchCandidates: [
        {
          materialId: 'mat-1',
          name: 'Portland Cement Type I',
          confidence: 0.86,
          category: 'Cement & Concrete',
          subCategory: 'Bagged',
        },
      ],
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
      // Auto-matched line inherits the matched catalogue material's category and
      // material type (its sub-category).
      category: 'Cement & Concrete',
      materialType: 'Bagged',
    });
    expect(rows[1].matchedMaterialId).toBeNull();
    expect(rows[1].candidates).toEqual([]);
    // An unmatched line has no catalogue material to draw attributes from.
    expect(rows[1].category).toBe('');
    expect(rows[1].materialType).toBe('');
  });

  it('fills an auto-matched row category and material type from the matched candidate, not the top one', () => {
    const [row] = rowsFromExtraction({
      ...extraction,
      items: [
        {
          description: 'Rebar 12mm',
          quantity: 200,
          unit: 'm',
          targetPrice: null,
          notes: null,
          matchedMaterialId: 'mat-steel',
          matchedMaterialName: 'Reinforcing Bar 12mm',
          matchConfidence: 0.9,
          matchCandidates: [
            // Highest-confidence candidate is NOT the matched one — the row must
            // take the attributes of the candidate keyed by matchedMaterialId.
            {
              materialId: 'mat-other',
              name: 'Rebar Tie Wire',
              confidence: 0.95,
              category: 'Fixings',
              subCategory: 'Wire',
            },
            {
              materialId: 'mat-steel',
              name: 'Reinforcing Bar 12mm',
              confidence: 0.9,
              category: 'Steel',
              subCategory: 'Reinforcement',
            },
          ],
        },
      ],
    });
    expect(row.category).toBe('Steel');
    expect(row.materialType).toBe('Reinforcement');
  });

  it('auto-accepts the top suggestion (kept flagged) when the line is not high-confidence matched', () => {
    const [row] = rowsFromExtraction({
      ...extraction,
      items: [
        {
          description: '90 bend',
          quantity: 10,
          unit: null,
          targetPrice: null,
          notes: null,
          // Below the auto-match threshold: the extractor leaves it unmatched
          // with ranked suggestions. We accept the top one so the row counts as
          // matched (wizard can proceed), while matchConfidence keeps it flagged.
          matchedMaterialId: null,
          matchedMaterialName: null,
          matchConfidence: null,
          matchCandidates: [
            {
              materialId: 'mat-bend',
              name: '12B Bend 90 150W SS316',
              confidence: 0.62,
              category: 'Pipe Fittings',
              subCategory: 'Bends',
            },
            {
              materialId: 'mat-2',
              name: 'Other',
              confidence: 0.5,
              category: 'Misc',
              subCategory: 'X',
            },
          ],
        },
      ],
    });
    expect(row.matchedMaterialId).toBe('mat-bend');
    expect(row.matchedMaterialName).toBe('12B Bend 90 150W SS316');
    expect(row.matchConfidence).toBe(0.62);
    expect(row.category).toBe('Pipe Fittings');
    expect(row.materialType).toBe('Bends');
  });

  it('leaves a line with no candidates unmatched so it still blocks the wizard', () => {
    const [row] = rowsFromExtraction({
      ...extraction,
      items: [
        {
          description: 'Mystery widget',
          quantity: 1,
          unit: null,
          targetPrice: null,
          notes: null,
          matchedMaterialId: null,
          matchedMaterialName: null,
          matchConfidence: null,
          matchCandidates: [],
        },
      ],
    });
    expect(row.matchedMaterialId).toBeNull();
    expect(row.category).toBe('');
    expect(row.materialType).toBe('');
  });

  it('leaves category and material type blank when the matched candidate carries neither', () => {
    const [row] = rowsFromExtraction({
      ...extraction,
      items: [
        {
          description: 'Generic widget',
          quantity: 1,
          unit: 'ea',
          targetPrice: null,
          notes: null,
          matchedMaterialId: 'mat-x',
          matchedMaterialName: 'Widget',
          matchConfidence: 0.88,
          matchCandidates: [{ materialId: 'mat-x', name: 'Widget', confidence: 0.88 }],
        },
      ],
    });
    expect(row.category).toBe('');
    expect(row.materialType).toBe('');
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
