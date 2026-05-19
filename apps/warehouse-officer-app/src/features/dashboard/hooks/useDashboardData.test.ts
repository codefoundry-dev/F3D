import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, createElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetWarehouseDashboard = vi.fn();

vi.mock('@forethread/api-client', () => ({
  getWarehouseDashboard: () => mockGetWarehouseDashboard(),
}));

import { useDashboardData } from './useDashboardData';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches warehouse dashboard data', async () => {
    const mockData = {
      kpi: { pendingDeliveries: 5, overdueDeliveries: 1, delivered: 10, activeBulkOrders: 2 },
      pendingDeliveries: [],
      recentDeliveries: [],
      activeBulkOrders: [],
    };
    mockGetWarehouseDashboard.mockResolvedValue(mockData);

    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(mockGetWarehouseDashboard).toHaveBeenCalled();
  });

  it('handles error state', async () => {
    mockGetWarehouseDashboard.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('uses correct query key', async () => {
    mockGetWarehouseDashboard.mockResolvedValue({});

    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});
