import { useBulkOrderSort } from './index';

describe('hooks barrel export', () => {
  it('re-exports useBulkOrderSort', () => {
    expect(typeof useBulkOrderSort).toBe('function');
  });
});
