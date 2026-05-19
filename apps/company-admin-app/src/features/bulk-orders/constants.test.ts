vi.mock('@forethread/api-client', () => ({}));

import { PAGE_SIZE_OPTIONS, COLUMNS } from './constants';

describe('bulk-orders/constants', () => {
  it('exports PAGE_SIZE_OPTIONS', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 25, 50]);
  });

  it('exports COLUMNS with correct shape', () => {
    expect(COLUMNS.length).toBe(9);
    expect(COLUMNS[0]).toEqual({ field: 'id', key: 'bulkOrderId' });
    for (const col of COLUMNS) {
      expect(col).toHaveProperty('field');
      expect(col).toHaveProperty('key');
    }
  });
});
