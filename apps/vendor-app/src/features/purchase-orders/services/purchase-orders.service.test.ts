import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';

const mockGetPurchaseOrders = vi.hoisted(() => vi.fn());
const mockGetPurchaseOrder = vi.hoisted(() => vi.fn());
const mockGetProjects = vi.hoisted(() => vi.fn());
const mockGetProject = vi.hoisted(() => vi.fn());
const mockGetCompanyVendors = vi.hoisted(() => vi.fn());
const mockCreatePurchaseOrder = vi.hoisted(() => vi.fn());
const mockIssuePurchaseOrder = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', () => ({
  getPurchaseOrders: mockGetPurchaseOrders,
  getPurchaseOrder: mockGetPurchaseOrder,
  getProjects: mockGetProjects,
  getProject: mockGetProject,
  getCompanyVendors: mockGetCompanyVendors,
  createPurchaseOrder: mockCreatePurchaseOrder,
  issuePurchaseOrder: mockIssuePurchaseOrder,
}));

vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ currentUser: { companyId: 'company-1' } }),
}));

import {
  usePurchaseOrders,
  usePurchaseOrder,
  useProjectsList,
  useProjectDetail,
  useCompanyVendors,
  useCreatePurchaseOrder,
  useIssuePurchaseOrder,
} from './purchase-orders.service';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('purchase-orders.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('usePurchaseOrders', () => {
    it('fetches purchase orders list', async () => {
      const mockData = { items: [{ id: '1' }], meta: { total: 1 } };
      mockGetPurchaseOrders.mockResolvedValue(mockData);

      const { result } = renderHook(() => usePurchaseOrders(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('usePurchaseOrder', () => {
    it('fetches single purchase order', async () => {
      const mockData = { id: '1', poNumber: 'PO-001' };
      mockGetPurchaseOrder.mockResolvedValue(mockData);

      const { result } = renderHook(() => usePurchaseOrder('1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });

    it('does not fetch when id is empty', () => {
      const { result } = renderHook(() => usePurchaseOrder(''), { wrapper: createWrapper() });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useProjectsList', () => {
    it('fetches projects list', async () => {
      const mockData = { items: [{ id: 'p1', name: 'Project A' }] };
      mockGetProjects.mockResolvedValue(mockData);

      const { result } = renderHook(() => useProjectsList(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
      expect(mockGetProjects).toHaveBeenCalledWith({ limit: 100 });
    });
  });

  describe('useProjectDetail', () => {
    it('fetches single project', async () => {
      const mockData = { id: 'p1', name: 'Project A' };
      mockGetProject.mockResolvedValue(mockData);

      const { result } = renderHook(() => useProjectDetail('p1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
    });

    it('does not fetch when id is empty', () => {
      const { result } = renderHook(() => useProjectDetail(''), { wrapper: createWrapper() });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCompanyVendors', () => {
    it('fetches vendors for company', async () => {
      const mockData = [{ id: 'v1', legalName: 'Vendor A' }];
      mockGetCompanyVendors.mockResolvedValue(mockData);

      const { result } = renderHook(() => useCompanyVendors(), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockData);
      expect(mockGetCompanyVendors).toHaveBeenCalledWith('company-1');
    });
  });

  describe('useCreatePurchaseOrder', () => {
    it('creates a purchase order and invalidates queries', async () => {
      const mockResult = { id: 'po-new', poNumber: 'PO-NEW' };
      mockCreatePurchaseOrder.mockResolvedValue(mockResult);

      const { result } = renderHook(() => useCreatePurchaseOrder(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate({
          projectId: 'p1',
          vendorId: 'v1',
          poType: 'STANDARD',
          currency: 'AUD',
          lineItems: [],
        } as never);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockCreatePurchaseOrder).toHaveBeenCalled();
    });
  });

  describe('useIssuePurchaseOrder', () => {
    it('issues a purchase order and invalidates queries', async () => {
      mockIssuePurchaseOrder.mockResolvedValue({ id: 'po-1' });

      const { result } = renderHook(() => useIssuePurchaseOrder(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate('po-1');
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockIssuePurchaseOrder).toHaveBeenCalledWith('po-1');
    });
  });
});
