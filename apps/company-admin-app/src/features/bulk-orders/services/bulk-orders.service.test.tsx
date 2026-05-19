const mockApiClient = vi.hoisted(() => ({
  getBulkOrders: vi.fn(),
  getBulkOrder: vi.fn(),
  listChangeRequests: vi.fn(),
  proposeChange: vi.fn(),
  approveChangeRequest: vi.fn(),
  rejectChangeRequest: vi.fn(),
  cancelBulkOrder: vi.fn(),
}));

vi.mock('@forethread/api-client', () => mockApiClient);

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  useBulkOrders,
  useBulkOrder,
  useChangeRequests,
  useProposeChange,
  useApproveChange,
  useRejectChange,
  useCancelBulkOrder,
} from './bulk-orders.service';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('bulk-orders.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useBulkOrders', () => {
    it('calls getBulkOrders with params and returns data', async () => {
      const mockData = { items: [{ id: 'bo-1' }], meta: { total: 1 } };
      mockApiClient.getBulkOrders.mockResolvedValue(mockData);

      const { result } = renderHook(() => useBulkOrders({ page: 1, limit: 25 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.getBulkOrders).toHaveBeenCalledWith(
        { page: 1, limit: 25 },
        { skipErrorHandler: true },
      );
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useBulkOrder', () => {
    it('calls getBulkOrder with id and returns data', async () => {
      const mockBo = { bulkId: 'bo-1', projectName: 'Test' };
      mockApiClient.getBulkOrder.mockResolvedValue(mockBo);

      const { result } = renderHook(() => useBulkOrder('bo-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.getBulkOrder).toHaveBeenCalledWith('bo-1');
      expect(result.current.data).toEqual(mockBo);
    });

    it('does not call getBulkOrder when id is empty', () => {
      renderHook(() => useBulkOrder(''), { wrapper: createWrapper() });
      expect(mockApiClient.getBulkOrder).not.toHaveBeenCalled();
    });
  });

  describe('useChangeRequests', () => {
    it('fetches change requests for a bulk order', async () => {
      const mockCrs = [{ id: 'cr-1', status: 'PENDING' }];
      mockApiClient.listChangeRequests.mockResolvedValue(mockCrs);

      const { result } = renderHook(() => useChangeRequests('bo-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.listChangeRequests).toHaveBeenCalledWith('bo-1');
      expect(result.current.data).toEqual(mockCrs);
    });

    it('does not fetch when bulkOrderId is empty', () => {
      renderHook(() => useChangeRequests(''), { wrapper: createWrapper() });
      expect(mockApiClient.listChangeRequests).not.toHaveBeenCalled();
    });
  });

  describe('useProposeChange', () => {
    it('calls proposeChange and returns data', async () => {
      const mockCr = { id: 'cr-1', status: 'PENDING' };
      mockApiClient.proposeChange.mockResolvedValue(mockCr);

      const { result } = renderHook(() => useProposeChange(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          bulkOrderId: 'bo-1',
          input: { endDate: '2025-06-01', message: 'test' },
        });
      });

      expect(mockApiClient.proposeChange).toHaveBeenCalledWith('bo-1', {
        endDate: '2025-06-01',
        message: 'test',
      });
    });
  });

  describe('useApproveChange', () => {
    it('calls approveChangeRequest', async () => {
      mockApiClient.approveChangeRequest.mockResolvedValue(undefined);

      const { result } = renderHook(() => useApproveChange(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          bulkOrderId: 'bo-1',
          changeRequestId: 'cr-1',
        });
      });

      expect(mockApiClient.approveChangeRequest).toHaveBeenCalledWith('bo-1', 'cr-1');
    });
  });

  describe('useRejectChange', () => {
    it('calls rejectChangeRequest with reason', async () => {
      mockApiClient.rejectChangeRequest.mockResolvedValue(undefined);

      const { result } = renderHook(() => useRejectChange(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          bulkOrderId: 'bo-1',
          changeRequestId: 'cr-1',
          reason: 'Too expensive',
        });
      });

      expect(mockApiClient.rejectChangeRequest).toHaveBeenCalledWith(
        'bo-1',
        'cr-1',
        'Too expensive',
      );
    });
  });

  describe('useCancelBulkOrder', () => {
    it('calls cancelBulkOrder', async () => {
      mockApiClient.cancelBulkOrder.mockResolvedValue(undefined);

      const { result } = renderHook(() => useCancelBulkOrder(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync('bo-1');
      });

      expect(mockApiClient.cancelBulkOrder).toHaveBeenCalledWith('bo-1');
    });
  });
});
