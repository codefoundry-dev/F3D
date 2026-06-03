vi.mock('@forethread/api-client', () => ({
  getPurchaseOrders: vi.fn(),
  getPurchaseOrder: vi.fn(),
  createPurchaseOrder: vi.fn(),
  issuePurchaseOrder: vi.fn(),
  getProjects: vi.fn(),
  getProject: vi.fn(),
  getCompanyVendors: vi.fn(),
  getMe: vi.fn(),
}));

vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ currentUser: { companyId: 'comp-1' } }),
}));

import {
  getPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  issuePurchaseOrder,
  getProjects,
  getProject,
  getCompanyVendors,
  getMe,
} from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  usePurchaseOrders,
  usePurchaseOrder,
  useProjectsList,
  useProjectDetail,
  useCompanyVendors,
  useCreatePurchaseOrder,
  useIssuePurchaseOrder,
  useMe,
} from './purchase-orders.service';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('purchase-orders.service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usePurchaseOrders calls getPurchaseOrders', async () => {
    vi.mocked(getPurchaseOrders).mockResolvedValue({ items: [], meta: { total: 0 } } as never);
    const { result } = renderHook(() => usePurchaseOrders(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getPurchaseOrders).toHaveBeenCalled();
  });

  it('usePurchaseOrder calls getPurchaseOrder', async () => {
    vi.mocked(getPurchaseOrder).mockResolvedValue({ id: 'po-1' } as never);
    const { result } = renderHook(() => usePurchaseOrder('po-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getPurchaseOrder).toHaveBeenCalledWith('po-1');
  });

  it('usePurchaseOrder disabled when id is empty', () => {
    const { result } = renderHook(() => usePurchaseOrder(''), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
  });

  it('useProjectsList calls getProjects', async () => {
    vi.mocked(getProjects).mockResolvedValue({ items: [] } as never);
    const { result } = renderHook(() => useProjectsList(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getProjects).toHaveBeenCalledWith({ limit: 100 });
  });

  it('useProjectDetail calls getProject when id provided', async () => {
    vi.mocked(getProject).mockResolvedValue({ id: 'prj-1' } as never);
    const { result } = renderHook(() => useProjectDetail('prj-1'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getProject).toHaveBeenCalledWith('prj-1');
  });

  it('useProjectDetail disabled when id is empty', () => {
    const { result } = renderHook(() => useProjectDetail(''), { wrapper: createWrapper() });
    expect(result.current.isFetching).toBe(false);
  });

  it('useCompanyVendors calls getCompanyVendors', async () => {
    vi.mocked(getCompanyVendors).mockResolvedValue([] as never);
    const { result } = renderHook(() => useCompanyVendors(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCompanyVendors).toHaveBeenCalledWith('comp-1');
  });

  it('useCreatePurchaseOrder calls createPurchaseOrder', async () => {
    vi.mocked(createPurchaseOrder).mockResolvedValue({ id: 'po-new' } as never);
    const { result } = renderHook(() => useCreatePurchaseOrder(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate({ projectId: 'p1', vendorId: 'v1' } as never);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createPurchaseOrder).toHaveBeenCalled();
  });

  it('useMe calls getMe and exposes poApprovalThreshold', async () => {
    vi.mocked(getMe).mockResolvedValue({ id: 'u-1', poApprovalThreshold: 5000 } as never);
    const { result } = renderHook(() => useMe(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMe).toHaveBeenCalled();
    expect(result.current.data?.poApprovalThreshold).toBe(5000);
  });

  it('useIssuePurchaseOrder calls issuePurchaseOrder', async () => {
    vi.mocked(issuePurchaseOrder).mockResolvedValue({} as never);
    const { result } = renderHook(() => useIssuePurchaseOrder(), { wrapper: createWrapper() });
    act(() => {
      result.current.mutate('po-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(issuePurchaseOrder).toHaveBeenCalledWith('po-1');
  });
});
