import { describe, it, expect } from 'vitest';

import {
  mapDeliveriesToPayload,
  isEmptyDeliveryRow,
  formSchema,
  EMPTY_LINE_ITEM,
} from './create-po.schema';

describe('isEmptyDeliveryRow (FOR-210)', () => {
  it('is empty when it has neither location nor date', () => {
    expect(isEmptyDeliveryRow({ deliveryLocationId: '', deliveryDate: '', notes: '' })).toBe(true);
    expect(isEmptyDeliveryRow({})).toBe(true);
    // notes alone does not make a row meaningful
    expect(isEmptyDeliveryRow({ notes: 'just a note' })).toBe(true);
  });

  it('is non-empty when it has a location or a date', () => {
    expect(isEmptyDeliveryRow({ deliveryLocationId: 'loc-1' })).toBe(false);
    expect(isEmptyDeliveryRow({ deliveryDate: '2026-07-01' })).toBe(false);
  });
});

describe('mapDeliveriesToPayload (FOR-210)', () => {
  it('returns undefined when given undefined', () => {
    expect(mapDeliveriesToPayload(undefined)).toBeUndefined();
  });

  it('returns undefined when all rows are empty (e.g. trailing blank row)', () => {
    expect(
      mapDeliveriesToPayload([{ deliveryLocationId: '', deliveryDate: '', notes: '' }]),
    ).toBeUndefined();
  });

  it('strips fully-empty rows and keeps populated ones', () => {
    const result = mapDeliveriesToPayload([
      { deliveryLocationId: 'loc-1', deliveryDate: '2026-07-01', notes: 'first drop' },
      { deliveryLocationId: '', deliveryDate: '', notes: '' },
    ]);
    expect(result).toHaveLength(1);
    expect(result?.[0].deliveryLocationId).toBe('loc-1');
    expect(result?.[0].notes).toBe('first drop');
  });

  it('converts the delivery date to an ISO-8601 string', () => {
    const result = mapDeliveriesToPayload([{ deliveryDate: '2026-07-01' }]);
    expect(result?.[0].deliveryDate).toBe(new Date('2026-07-01').toISOString());
  });

  it('keeps a row with only a date (location omitted)', () => {
    const result = mapDeliveriesToPayload([{ deliveryDate: '2026-07-01' }]);
    expect(result).toHaveLength(1);
    expect(result?.[0].deliveryLocationId).toBeUndefined();
    expect(result?.[0].deliveryDate).toBeDefined();
  });

  it('keeps a row with only a location (date omitted)', () => {
    const result = mapDeliveriesToPayload([{ deliveryLocationId: 'loc-2' }]);
    expect(result).toHaveLength(1);
    expect(result?.[0].deliveryLocationId).toBe('loc-2');
    expect(result?.[0].deliveryDate).toBeUndefined();
  });

  it('maps empty notes to undefined', () => {
    const result = mapDeliveriesToPayload([{ deliveryLocationId: 'loc-1', notes: '' }]);
    expect(result?.[0].notes).toBeUndefined();
  });
});

describe('formSchema deliveries validation (FOR-210)', () => {
  const validBase = {
    documentName: 'Doc',
    projectId: 'prj-1',
    deliveryLocationId: 'loc-1',
    plannedDeliveryDate: '2026-07-01',
    lineItems: [
      {
        ...EMPTY_LINE_ITEM,
        materialName: 'Steel',
        unitOfMeasure: 'EA',
        unitPrice: 10,
        quantityOrdered: 2,
      },
    ],
  };

  it('accepts a form with an empty trailing delivery row (stripped before validation)', () => {
    const result = formSchema.safeParse({
      ...validBase,
      deliveries: [{ deliveryLocationId: '', deliveryDate: '', notes: '' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a populated delivery row', () => {
    const result = formSchema.safeParse({
      ...validBase,
      deliveries: [{ deliveryLocationId: 'loc-1', deliveryDate: '2026-07-01' }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts when deliveries is omitted entirely', () => {
    const result = formSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });
});
