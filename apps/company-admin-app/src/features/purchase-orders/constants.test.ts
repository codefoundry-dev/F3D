vi.mock('@forethread/api-client', () => ({}));

import {
  PAGE_SIZE_OPTIONS,
  PO_QUICK_FILTERS,
  GROUP_OPTIONS,
  PO_COLUMNS,
  TRUNCATE_COLUMNS,
} from './constants';

describe('purchase-orders/constants', () => {
  it('exports PAGE_SIZE_OPTIONS', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 25, 50]);
  });

  it('exports PO_QUICK_FILTERS', () => {
    expect(PO_QUICK_FILTERS).toContain('allOpen');
    expect(PO_QUICK_FILTERS).toContain('closed');
    expect(PO_QUICK_FILTERS.length).toBe(10);
  });

  it('exports GROUP_OPTIONS', () => {
    expect(GROUP_OPTIONS).toContain('groupByProject');
    expect(GROUP_OPTIONS).toContain('groupByStatus');
  });

  it('exports PO_COLUMNS with correct shape', () => {
    expect(PO_COLUMNS.length).toBe(9);
    expect(PO_COLUMNS[0]).toEqual({ field: 'poNumber', key: 'poNumber' });
    for (const col of PO_COLUMNS) {
      expect(col).toHaveProperty('field');
      expect(col).toHaveProperty('key');
    }
  });

  it('exports TRUNCATE_COLUMNS', () => {
    expect(TRUNCATE_COLUMNS).toEqual(['projectName', 'vendorName', 'deliveryLocationId']);
  });
});
