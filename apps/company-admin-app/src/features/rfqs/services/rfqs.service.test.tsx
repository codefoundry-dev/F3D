const mockApiClient = vi.hoisted(() => ({
  getRfqs: vi.fn(),
  getRfq: vi.fn(),
}));

vi.mock('@forethread/api-client', () => mockApiClient);

import { useRfqs, useRfq } from '@forethread/rfq-shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('rfqs.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useRfqs', () => {
    it('calls getRfqs with params and returns data', async () => {
      const mockData = { items: [{ id: 'rfq-1' }], meta: { total: 1 } };
      mockApiClient.getRfqs.mockResolvedValue(mockData);

      const { result } = renderHook(() => useRfqs({ page: 1, limit: 25 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.getRfqs).toHaveBeenCalledWith(
        { page: 1, limit: 25 },
        { skipErrorHandler: true },
      );
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useRfq', () => {
    it('calls getRfq with id and returns data', async () => {
      const mockRfq = { id: 'rfq-1', projectName: 'Test' };
      mockApiClient.getRfq.mockResolvedValue(mockRfq);

      const { result } = renderHook(() => useRfq('rfq-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.getRfq).toHaveBeenCalledWith('rfq-1');
      expect(result.current.data).toEqual(mockRfq);
    });

    it('does not call getRfq when id is empty', () => {
      renderHook(() => useRfq(''), { wrapper: createWrapper() });
      expect(mockApiClient.getRfq).not.toHaveBeenCalled();
    });
  });
});
