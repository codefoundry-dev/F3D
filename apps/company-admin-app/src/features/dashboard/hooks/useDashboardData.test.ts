import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';

const mockGetPoCaDashboard = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', () => ({
  getPoCaDashboard: mockGetPoCaDashboard,
}));

import { useDashboardData } from './useDashboardData';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty arrays while loading', () => {
    mockGetPoCaDashboard.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    expect(result.current.quoteResponses).toEqual([]);
    expect(result.current.recentOrders).toEqual([]);
    expect(result.current.pendingPurchaseOrders).toEqual([]);
    expect(result.current.invoicesPendingApproval).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('returns data after successful fetch', async () => {
    const mockData = {
      quoteResponses: [{ id: '1', vendorName: 'Test' }],
      recentOrders: [],
      pendingPurchaseOrders: [],
      invoicesPendingApproval: [],
    };
    mockGetPoCaDashboard.mockResolvedValue(mockData);

    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.quoteResponses).toEqual(mockData.quoteResponses);
  });

  it('uses correct query key', () => {
    mockGetPoCaDashboard.mockResolvedValue({
      quoteResponses: [],
      recentOrders: [],
      pendingPurchaseOrders: [],
      invoicesPendingApproval: [],
    });

    renderHook(() => useDashboardData(), { wrapper: createWrapper() });
    expect(mockGetPoCaDashboard).toHaveBeenCalledTimes(1);
  });
});
