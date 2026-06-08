import { createRfqLineItemSchema } from '@forethread/shared-types/client';

import { deriveBomLineNameAndNotes, RFQ_MATERIAL_NAME_MAX } from './bom-draft';

function bomLine(description: string, notes: string | null = null) {
  return { description, quantity: null, unit: null, targetPrice: null, notes };
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
