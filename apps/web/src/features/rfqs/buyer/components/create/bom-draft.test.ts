import { createRfqLineItemSchema, type BomLineItem } from '@forethread/shared-types/client';

import {
  bomLineToRfqDraftFields,
  deriveBomLineNameAndNotes,
  RFQ_MATERIAL_NAME_MAX,
} from './bom-draft';

function bomLine(description: string, notes: string | null = null) {
  return { description, quantity: null, unit: null, targetPrice: null, notes };
}

/** A BOM line matched to a catalogue material during review. */
function matchedBomLine(overrides: Partial<BomLineItem> & { description: string }): BomLineItem {
  return {
    quantity: 1,
    unit: 'ea',
    targetPrice: null,
    notes: null,
    matchedMaterialId: 'mat-1',
    matchedMaterialName: 'Catalogue Material',
    matchConfidence: 0.9,
    matchCandidates: [],
    ...overrides,
  };
}

describe('deriveBomLineNameAndNotes', () => {
  it('passes a short description straight through as the name', () => {
    expect(deriveBomLineNameAndNotes(bomLine('Plywood sheet', 'grade B'))).toEqual({
      materialName: 'Plywood sheet',
      notes: 'grade B',
    });
  });

  it('collapses blank/whitespace notes to undefined', () => {
    expect(deriveBomLineNameAndNotes(bomLine('Nails', '   ')).notes).toBeUndefined();
    expect(deriveBomLineNameAndNotes(bomLine('Nails', null)).notes).toBeUndefined();
  });

  it('truncates an over-long description to fit the 255-char material_name cap', () => {
    const long = 'A'.repeat(400);
    const { materialName } = deriveBomLineNameAndNotes(bomLine(long));
    expect(materialName.length).toBe(RFQ_MATERIAL_NAME_MAX);
    expect(materialName.endsWith('…')).toBe(true);
  });

  it('preserves the full description in notes when the name is truncated', () => {
    const long = 'B'.repeat(400);
    expect(deriveBomLineNameAndNotes(bomLine(long)).notes).toBe(long);
  });

  it('prepends the full description to existing notes when truncated', () => {
    const long = 'C'.repeat(400);
    expect(deriveBomLineNameAndNotes(bomLine(long, 'spec ref X')).notes).toBe(
      `${long}\n\nspec ref X`,
    );
  });

  it('produces a name that satisfies createRfqLineItemSchema (regression for FOR-204 max(255))', () => {
    const long = 'Galvanised steel bracket, '.repeat(20); // ~520 chars
    const { materialName } = deriveBomLineNameAndNotes(bomLine(long));
    const result = createRfqLineItemSchema.safeParse({
      source: 'BOM',
      materialName,
      quantity: 1,
      uom: 'unit',
    });
    expect(result.success).toBe(true);
  });
});

describe('bomLineToRfqDraftFields', () => {
  it('keeps an unmatched line as a free-text name with no materialId', () => {
    expect(bomLineToRfqDraftFields(bomLine('Plywood sheet', 'grade B') as BomLineItem)).toEqual({
      materialName: 'Plywood sheet',
      notes: 'grade B',
    });
  });

  it('links a matched line to its catalogue material and shows the catalogue name', () => {
    const fields = bomLineToRfqDraftFields(
      matchedBomLine({
        description: 'Cement 25kg',
        matchedMaterialId: 'mat-cement',
        matchedMaterialName: 'Cement Bag 50kg',
      }),
    );
    expect(fields.materialId).toBe('mat-cement');
    expect(fields.materialName).toBe('Cement Bag 50kg');
    // The BOM text differs from the catalogue name, so it is preserved in notes.
    expect(fields.notes).toBe('Cement 25kg');
  });

  it('does not duplicate the description into notes for an exact-name match', () => {
    expect(
      bomLineToRfqDraftFields(
        matchedBomLine({
          description: 'Steel Rebar 12mm',
          matchedMaterialId: 'mat-rebar',
          matchedMaterialName: 'Steel Rebar 12mm',
        }),
      ),
    ).toEqual({ materialId: 'mat-rebar', materialName: 'Steel Rebar 12mm', notes: undefined });
  });

  it('keeps existing notes alongside a differing description', () => {
    const fields = bomLineToRfqDraftFields(
      matchedBomLine({
        description: 'Cement 25kg sulphate-resistant',
        notes: 'spec ref X',
        matchedMaterialName: 'Cement Bag 50kg',
      }),
    );
    expect(fields.notes).toBe('Cement 25kg sulphate-resistant\n\nspec ref X');
  });

  it('produces a catalogue-linked line that satisfies createRfqLineItemSchema', () => {
    const fields = bomLineToRfqDraftFields(
      matchedBomLine({
        description: 'Cement 25kg',
        matchedMaterialId: '22222222-2222-4222-8222-222222222222',
        matchedMaterialName: 'Cement Bag 50kg',
      }),
    );
    const result = createRfqLineItemSchema.safeParse({
      source: 'BOM',
      materialId: fields.materialId,
      quantity: 1,
      uom: 'bag',
      notes: fields.notes,
    });
    expect(result.success).toBe(true);
  });
});
