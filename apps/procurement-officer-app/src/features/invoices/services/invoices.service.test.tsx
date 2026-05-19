vi.mock('@forethread/api-client', () => ({
  getInvoices: vi.fn(),
  getInvoice: vi.fn(),
  approveInvoice: vi.fn(),
  bulkApproveInvoices: vi.fn(),
  rejectInvoice: vi.fn(),
  exportInvoices: vi.fn(),
}));

import {
  getInvoices,
  getInvoice,
  approveInvoice,
  bulkApproveInvoices,
  rejectInvoice,
  exportInvoices,
} from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  useInvoices,
  useInvoice,
  useApproveInvoice,
  useBulkApproveInvoices,
  useRejectInvoice,
  useExportInvoices,
} from './invoices.service';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('invoices.service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('useInvoices calls getInvoices', async () => {
    vi.mocked(getInvoices).mockResolvedValue({ items: [], meta: { total: 0 } } as never);
    const { result } = renderHook(() => useInvoices(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getInvoices).toHaveBeenCalled();
  });

  it('useApproveInvoice calls approveInvoice', async () => {
    vi.mocked(approveInvoice).mockResolvedValue({} as never);
    const { result } = renderHook(() => useApproveInvoice(), { wrapper: createWrapper() });
    act(() => result.current.mutate('inv-1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(approveInvoice).toHaveBeenCalledWith('inv-1');
  });

  it('useBulkApproveInvoices calls bulkApproveInvoices', async () => {
    vi.mocked(bulkApproveInvoices).mockResolvedValue({} as never);
    const { result } = renderHook(() => useBulkApproveInvoices(), { wrapper: createWrapper() });
    act(() => result.current.mutate(['inv-1', 'inv-2']));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(bulkApproveInvoices).toHaveBeenCalledWith(['inv-1', 'inv-2']);
  });

  it('useInvoice calls getInvoice with id', async () => {
    vi.mocked(getInvoice).mockResolvedValue({ id: 'inv-1' } as never);
    const { result } = renderHook(() => useInvoice('inv-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getInvoice).toHaveBeenCalledWith('inv-1');
  });

  it('useRejectInvoice calls rejectInvoice', async () => {
    vi.mocked(rejectInvoice).mockResolvedValue({} as never);
    const { result } = renderHook(() => useRejectInvoice(), { wrapper: createWrapper() });
    act(() => result.current.mutate('inv-1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rejectInvoice).toHaveBeenCalledWith('inv-1');
  });

  it('useExportInvoices calls exportInvoices', async () => {
    vi.mocked(exportInvoices).mockResolvedValue({ url: 'http://export.url' } as never);
    const { result } = renderHook(() => useExportInvoices(), { wrapper: createWrapper() });
    act(() => result.current.mutate({ format: 'csv' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(exportInvoices).toHaveBeenCalledWith('csv', undefined);
  });
});
