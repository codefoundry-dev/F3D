import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';

const mockGetBulkOrders = vi.hoisted(() => vi.fn());
const mockGetBulkOrder = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', () => ({
  getBulkOrders: mockGetBulkOrders,
  getBulkOrder: mockGetBulkOrder,
}));

import { useBulkOrders, useBulkOrder } from './bulk-orders.service';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('bulk-orders.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useBulkOrders', () => {
    it('fetches bulk orders list', async () => {
      const mockData = { items: [{ id: '1' }], meta: { total: 1 } };
      mockGetBulkOrders.mockResolvedValue(mockData);

      const { result } = renderHook(() => useBulkOrders(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useBulkOrder', () => {
    it('fetches single bulk order', async () => {
      const mockData = { id: '1', bulkId: 'BO-001' };
      mockGetBulkOrder.mockResolvedValue(mockData);

      const { result } = renderHook(() => useBulkOrder('1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });

    it('does not fetch when id is empty', () => {
      const { result } = renderHook(() => useBulkOrder(''), { wrapper: createWrapper() });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});
