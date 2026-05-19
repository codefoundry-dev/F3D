import {
  PAGE_SIZE_OPTIONS,
  PO_QUICK_FILTERS,
  GROUP_OPTIONS,
  PO_COLUMNS,
  TRUNCATE_COLUMNS,
} from './constants';

describe('purchase-orders constants', () => {
  it('exports PAGE_SIZE_OPTIONS', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 25, 50]);
  });

  it('exports PO_QUICK_FILTERS', () => {
    expect(PO_QUICK_FILTERS).toContain('allOpen');
    expect(PO_QUICK_FILTERS).toContain('closed');
    expect(PO_QUICK_FILTERS.length).toBe(10);
  });

  it('exports GROUP_OPTIONS', () => {
    expect(GROUP_OPTIONS).toEqual(['groupByProject', 'groupByStatus']);
  });

  it('exports PO_COLUMNS with expected fields', () => {
    expect(PO_COLUMNS.length).toBeGreaterThan(0);
    expect(PO_COLUMNS[0]).toEqual({ field: 'poNumber', key: 'poNumber' });
  });

  it('exports TRUNCATE_COLUMNS', () => {
    expect(TRUNCATE_COLUMNS).toContain('projectName');
    expect(TRUNCATE_COLUMNS).toContain('vendorName');
  });
});
