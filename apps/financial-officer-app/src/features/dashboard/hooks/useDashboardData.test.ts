import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';

const mockGetFinanceDashboard = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', () => ({
  getFinanceDashboard: mockGetFinanceDashboard,
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

describe('useDashboardData (finance)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns default values while loading', () => {
    mockGetFinanceDashboard.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    expect(result.current.totalPendingAmount).toBe(0);
    expect(result.current.invoicesPendingApproval).toEqual([]);
    expect(result.current.disputedInvoices).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('returns data after successful fetch', async () => {
    const mockData = {
      totalPendingAmount: 50000,
      pendingInvoiceCount: 12,
      invoicesDueThisWeek: 5,
      invoicesDueAmount: 15000,
      disputedInvoiceCount: 3,
      disputedTrend: 2,
      invoicesPendingApproval: [{ id: '1' }],
      disputedInvoices: [],
    };
    mockGetFinanceDashboard.mockResolvedValue(mockData);

    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.totalPendingAmount).toBe(50000);
    expect(result.current.invoicesPendingApproval).toEqual(mockData.invoicesPendingApproval);
  });
});
