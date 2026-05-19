import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';

const mockGetInvoices = vi.hoisted(() => vi.fn());
const mockGetInvoice = vi.hoisted(() => vi.fn());
const mockApproveInvoice = vi.hoisted(() => vi.fn());
const mockRejectInvoice = vi.hoisted(() => vi.fn());
const mockBulkApproveInvoices = vi.hoisted(() => vi.fn());
const mockExportInvoices = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', () => ({
  getInvoices: mockGetInvoices,
  getInvoice: mockGetInvoice,
  approveInvoice: mockApproveInvoice,
  rejectInvoice: mockRejectInvoice,
  bulkApproveInvoices: mockBulkApproveInvoices,
  exportInvoices: mockExportInvoices,
}));

import {
  useInvoices,
  useInvoice,
  useApproveInvoice,
  useRejectInvoice,
  useBulkApproveInvoices,
  useExportInvoices,
} from './invoices.service';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('invoices.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useInvoices', () => {
    it('fetches invoices', async () => {
      const mockData = { items: [{ id: '1' }], total: 1 };
      mockGetInvoices.mockResolvedValue(mockData);

      const { result } = renderHook(() => useInvoices(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useInvoice', () => {
    it('fetches single invoice when id provided', async () => {
      const mockData = { id: '1', vendorName: 'Acme' };
      mockGetInvoice.mockResolvedValue(mockData);

      const { result } = renderHook(() => useInvoice('1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });

    it('does not fetch when id is undefined', () => {
      const { result } = renderHook(() => useInvoice(undefined), { wrapper: createWrapper() });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useApproveInvoice', () => {
    it('calls approveInvoice mutation', async () => {
      mockApproveInvoice.mockResolvedValue({});
      const { result } = renderHook(() => useApproveInvoice(), { wrapper: createWrapper() });

      result.current.mutate('1');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApproveInvoice).toHaveBeenCalledWith('1');
    });
  });

  describe('useRejectInvoice', () => {
    it('calls rejectInvoice mutation', async () => {
      mockRejectInvoice.mockResolvedValue({});
      const { result } = renderHook(() => useRejectInvoice(), { wrapper: createWrapper() });

      result.current.mutate('1');
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockRejectInvoice).toHaveBeenCalledWith('1');
    });
  });

  describe('useBulkApproveInvoices', () => {
    it('calls bulkApproveInvoices mutation', async () => {
      mockBulkApproveInvoices.mockResolvedValue({});
      const { result } = renderHook(() => useBulkApproveInvoices(), { wrapper: createWrapper() });

      result.current.mutate(['1', '2']);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockBulkApproveInvoices).toHaveBeenCalledWith(['1', '2']);
    });
  });

  describe('useExportInvoices', () => {
    it('calls exportInvoices mutation', async () => {
      mockExportInvoices.mockResolvedValue(new Blob());
      const { result } = renderHook(() => useExportInvoices(), { wrapper: createWrapper() });

      result.current.mutate({ format: 'csv' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockExportInvoices).toHaveBeenCalledWith('csv', undefined);
    });
  });
});
