vi.mock('@forethread/api-client', () => ({
  getPoCaDashboard: vi.fn(),
}));

import { getPoCaDashboard } from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { useDashboardData } from './useDashboardData';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useDashboardData', () => {
  it('returns defaults when loading', () => {
    vi.mocked(getPoCaDashboard).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDashboardData(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.quoteResponses).toEqual([]);
    expect(result.current.recentOrders).toEqual([]);
    expect(result.current.pendingPurchaseOrders).toEqual([]);
    expect(result.current.invoicesPendingApproval).toEqual([]);
    expect(result.current.kpiSummary).toBeNull();
  });

  it('returns data when resolved', async () => {
    const mockData = {
      kpiSummary: { rfqs: { pending: 5, overdue: 1 } },
      quoteResponses: [{ id: 'q1' }],
      recentOrders: [{ id: 'o1' }],
      pendingPurchaseOrders: [{ id: 'p1' }],
      invoicesPendingApproval: [{ id: 'i1' }],
    };
    vi.mocked(getPoCaDashboard).mockResolvedValue(mockData as never);

    const { result } = renderHook(() => useDashboardData(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.quoteResponses).toEqual([{ id: 'q1' }]);
    expect(result.current.recentOrders).toEqual([{ id: 'o1' }]);
    expect(result.current.pendingPurchaseOrders).toEqual([{ id: 'p1' }]);
    expect(result.current.invoicesPendingApproval).toEqual([{ id: 'i1' }]);
  });
});
