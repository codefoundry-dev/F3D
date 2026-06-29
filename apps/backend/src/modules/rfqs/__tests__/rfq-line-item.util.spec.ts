import type { CreateRfqLineItemDto } from '@forethread/shared-types';

import {
  catalogMaterialIds,
  isValidRfqLineItemInput,
  normalizeRfqLineItem,
  resolveRfqLineItemMaterialName,
} from '../rfq-line-item.util';

const CATALOG: CreateRfqLineItemDto = {
  source: 'CATALOG' as never,
  materialId: '11111111-1111-1111-1111-111111111111',
  quantity: 10,
  uom: 'bag',
  costCode: 'CC-100',
  notes: 'handle with care',
  pickUp: true,
};

const BOM: CreateRfqLineItemDto = {
  source: 'BOM' as never,
  materialName: 'Portland Cement 42.5N',
  quantity: 5,
  uom: 'ea',
};

describe('normalizeRfqLineItem', () => {
  it('normalizes a catalog line item, mapping uom→unit and notes→notes (US 5.05)', () => {
    expect(normalizeRfqLineItem(CATALOG)).toEqual({
      materialId: '11111111-1111-1111-1111-111111111111',
      materialName: null,
      quantity: 10,
      unit: 'bag',
      costCode: 'CC-100',
      upc: null,
      manufacturerPartNumber: null,
      taxCode: null,
      description: null,
      notes: 'handle with care',
      pickUp: true,
      projectId: null,
      deliveryLocationId: null,
      expectedDeliveryDate: null,
    });
  });

  it('normalizes a BOM line item, keeping the free-text name and no materialId', () => {
    expect(normalizeRfqLineItem(BOM)).toEqual({
      materialId: null,
      materialName: 'Portland Cement 42.5N',
      quantity: 5,
      unit: 'ea',
      costCode: null,
      upc: null,
      manufacturerPartNumber: null,
      taxCode: null,
      description: null,
      notes: null,
      pickUp: false,
      projectId: null,
      deliveryLocationId: null,
      expectedDeliveryDate: null,
    });
  });

  it('carries the per-line project/location/date fields (US 5.05)', () => {
    const result = normalizeRfqLineItem({
      ...BOM,
      projectId: '22222222-2222-2222-2222-222222222222',
      deliveryLocationId: '33333333-3333-3333-3333-333333333333',
      expectedDeliveryDate: '2026-07-01T00:00:00.000Z',
    });
    expect(result.projectId).toBe('22222222-2222-2222-2222-222222222222');
    expect(result.deliveryLocationId).toBe('33333333-3333-3333-3333-333333333333');
    expect(result.expectedDeliveryDate).toEqual(new Date('2026-07-01T00:00:00.000Z'));
  });

  it('produces the same shape regardless of source (single normalized schema)', () => {
    expect(Object.keys(normalizeRfqLineItem(CATALOG)).sort()).toEqual(
      Object.keys(normalizeRfqLineItem(BOM)).sort(),
    );
  });

  it('drops the materialName when a catalog materialId is present', () => {
    const result = normalizeRfqLineItem({ ...CATALOG, materialName: 'should be ignored' });
    expect(result.materialId).toBe(CATALOG.materialId);
    expect(result.materialName).toBeNull();
  });

  it('trims and nullifies blank optional fields', () => {
    const result = normalizeRfqLineItem({
      materialName: '  Rebar 12mm  ',
      quantity: 1,
      uom: 'm',
      costCode: '   ',
      notes: '   ',
    });
    expect(result.materialName).toBe('Rebar 12mm');
    expect(result.costCode).toBeNull();
    expect(result.notes).toBeNull();
  });
});

describe('isValidRfqLineItemInput', () => {
  it('accepts a catalog material id', () => {
    expect(isValidRfqLineItemInput(CATALOG)).toBe(true);
  });

  it('accepts a free-text material name', () => {
    expect(isValidRfqLineItemInput(BOM)).toBe(true);
  });

  it('rejects a line item with neither id nor name', () => {
    expect(isValidRfqLineItemInput({ quantity: 1, uom: 'ea' } as CreateRfqLineItemDto)).toBe(false);
  });

  it('rejects a whitespace-only material name', () => {
    expect(
      isValidRfqLineItemInput({
        materialName: '   ',
        quantity: 1,
        uom: 'ea',
      } as CreateRfqLineItemDto),
    ).toBe(false);
  });
});

describe('resolveRfqLineItemMaterialName', () => {
  it('prefers the catalog material name', () => {
    expect(
      resolveRfqLineItemMaterialName({ material: { name: 'Cement' }, materialName: 'BOM name' }),
    ).toBe('Cement');
  });

  it('falls back to the BOM materialName when no catalog material', () => {
    expect(resolveRfqLineItemMaterialName({ material: null, materialName: 'BOM name' })).toBe(
      'BOM name',
    );
  });

  it('falls back to a placeholder when nothing is available', () => {
    expect(resolveRfqLineItemMaterialName({ material: null, materialName: null })).toBe('Material');
  });
});

describe('catalogMaterialIds', () => {
  it('returns only the catalog material ids, skipping BOM lines', () => {
    expect(catalogMaterialIds([CATALOG, BOM])).toEqual([CATALOG.materialId]);
  });

  it('returns an empty array when there are no catalog lines', () => {
    expect(catalogMaterialIds([BOM])).toEqual([]);
  });
});
