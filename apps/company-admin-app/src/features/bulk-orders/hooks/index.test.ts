vi.mock('@forethread/bulk-order-shared', () => ({
  useBulkOrderSort: vi.fn(),
  useBulkOrderListState: vi.fn(),
}));

import { useBulkOrderSort, useBulkOrderListState } from './index';

describe('bulk-orders/hooks re-exports', () => {
  it('re-exports useBulkOrderSort', () => {
    expect(useBulkOrderSort).toBeDefined();
  });

  it('re-exports useBulkOrderListState', () => {
    expect(useBulkOrderListState).toBeDefined();
  });
});
