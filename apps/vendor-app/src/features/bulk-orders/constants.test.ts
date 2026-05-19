vi.mock('@forethread/bulk-order-shared', () => ({
  COLUMNS: [
    { field: 'id', key: 'bulkOrderId' },
    { field: 'projectName', key: 'projectName' },
  ],
  PAGE_SIZE_OPTIONS: [10, 25, 50],
}));

import { COLUMNS, PAGE_SIZE_OPTIONS } from './constants';

describe('bulk-orders/constants', () => {
  it('re-exports PAGE_SIZE_OPTIONS from shared package', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 25, 50]);
  });

  it('re-exports COLUMNS from shared package', () => {
    expect(COLUMNS).toBeDefined();
    expect(Array.isArray(COLUMNS)).toBe(true);
    expect(COLUMNS.length).toBeGreaterThan(0);
    for (const col of COLUMNS) {
      expect(col).toHaveProperty('field');
      expect(col).toHaveProperty('key');
    }
  });
});
