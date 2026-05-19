import { COLUMNS, PAGE_SIZE_OPTIONS } from './constants';

describe('bulk-orders constants', () => {
  it('re-exports COLUMNS as a non-empty array', () => {
    expect(Array.isArray(COLUMNS)).toBe(true);
    expect(COLUMNS.length).toBeGreaterThan(0);
  });

  it('re-exports PAGE_SIZE_OPTIONS', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([10, 25, 50]);
  });
});
