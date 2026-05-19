import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';

const mockGetVendorDashboard = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', () => ({
  getVendorDashboard: mockGetVendorDashboard,
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

describe('useDashboardData (vendor)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty arrays while loading', () => {
    mockGetVendorDashboard.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    expect(result.current.rfqsWaiting).toEqual([]);
    expect(result.current.invoices).toEqual([]);
    expect(result.current.activePOs).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('returns data after successful fetch', async () => {
    const mockData = {
      rfqsWaiting: [{ id: '1', companyName: 'Test' }],
      invoices: [],
      activePOs: [],
    };
    mockGetVendorDashboard.mockResolvedValue(mockData);

    const { result } = renderHook(() => useDashboardData(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.rfqsWaiting).toEqual(mockData.rfqsWaiting);
  });
});
