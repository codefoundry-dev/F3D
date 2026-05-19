import { PAGE_SIZE_OPTIONS, VENDOR_COLUMNS } from './constants';

describe('purchase-orders constants', () => {
  it('exports PAGE_SIZE_OPTIONS', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 25, 50]);
  });

  it('exports VENDOR_COLUMNS with expected fields', () => {
    expect(VENDOR_COLUMNS.length).toBeGreaterThan(0);
    expect(VENDOR_COLUMNS[0]).toHaveProperty('field');
    expect(VENDOR_COLUMNS[0]).toHaveProperty('key');
  });
});
