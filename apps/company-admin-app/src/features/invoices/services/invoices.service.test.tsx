const mockApiClient = vi.hoisted(() => ({
  getInvoices: vi.fn(),
  getInvoice: vi.fn(),
  approveInvoice: vi.fn(),
  rejectInvoice: vi.fn(),
  bulkApproveInvoices: vi.fn(),
  exportInvoices: vi.fn(),
}));

vi.mock('@forethread/api-client', () => mockApiClient);

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  useInvoices,
  useInvoice,
  useExportInvoices,
  useApproveInvoice,
  useRejectInvoice,
  useBulkApproveInvoices,
} from './invoices.service';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('invoices.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useInvoices', () => {
    it('calls getInvoices with params and returns data', async () => {
      const mockData = { items: [{ id: 'inv-1' }], meta: { total: 1 } };
      mockApiClient.getInvoices.mockResolvedValue(mockData);

      const { result } = renderHook(() => useInvoices({ page: 1, limit: 25 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.getInvoices).toHaveBeenCalledWith(
        { page: 1, limit: 25 },
        { skipErrorHandler: true },
      );
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useApproveInvoice', () => {
    it('calls approveInvoice with id', async () => {
      mockApiClient.approveInvoice.mockResolvedValue(undefined);

      const { result } = renderHook(() => useApproveInvoice(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('inv-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.approveInvoice).toHaveBeenCalledWith('inv-1');
    });
  });

  describe('useBulkApproveInvoices', () => {
    it('calls bulkApproveInvoices with ids', async () => {
      mockApiClient.bulkApproveInvoices.mockResolvedValue(undefined);

      const { result } = renderHook(() => useBulkApproveInvoices(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(['inv-1', 'inv-2']);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.bulkApproveInvoices).toHaveBeenCalledWith(['inv-1', 'inv-2']);
    });
  });

  describe('useInvoice', () => {
    it('calls getInvoice with id when enabled', async () => {
      const mockData = { id: 'inv-1', amount: 100 };
      mockApiClient.getInvoice.mockResolvedValue(mockData);

      const { result } = renderHook(() => useInvoice('inv-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.getInvoice).toHaveBeenCalledWith('inv-1');
      expect(result.current.data).toEqual(mockData);
    });

    it('does not fetch when id is undefined', () => {
      const { result } = renderHook(() => useInvoice(undefined), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockApiClient.getInvoice).not.toHaveBeenCalled();
    });
  });

  describe('useExportInvoices', () => {
    it('calls exportInvoices with format and params', async () => {
      mockApiClient.exportInvoices.mockResolvedValue({ url: 'http://example.com/file.csv' });

      const { result } = renderHook(() => useExportInvoices(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ format: 'csv', params: { page: 1, limit: 25 } });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.exportInvoices).toHaveBeenCalledWith('csv', { page: 1, limit: 25 });
    });
  });

  describe('useRejectInvoice', () => {
    it('calls rejectInvoice with id', async () => {
      mockApiClient.rejectInvoice.mockResolvedValue(undefined);

      const { result } = renderHook(() => useRejectInvoice(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('inv-1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.rejectInvoice).toHaveBeenCalledWith('inv-1');
    });
  });
});
