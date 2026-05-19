vi.mock('@forethread/api-client', () => ({
  getBulkOrders: vi.fn(),
  getBulkOrder: vi.fn(),
}));

import { getBulkOrders, getBulkOrder } from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { useBulkOrders, useBulkOrder } from './bulk-orders.service';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('bulk-orders.service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('useBulkOrders calls getBulkOrders', async () => {
    vi.mocked(getBulkOrders).mockResolvedValue({ items: [], meta: { total: 0 } } as never);
    const { result } = renderHook(() => useBulkOrders(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getBulkOrders).toHaveBeenCalled();
  });

  it('useBulkOrder calls getBulkOrder', async () => {
    vi.mocked(getBulkOrder).mockResolvedValue({ id: 'bo-1' } as never);
    const { result } = renderHook(() => useBulkOrder('bo-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getBulkOrder).toHaveBeenCalledWith('bo-1');
  });

  it('useBulkOrder disabled when id is empty', () => {
    const { result } = renderHook(() => useBulkOrder(''), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
  });
});
