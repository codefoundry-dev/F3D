const mockApiClient = vi.hoisted(() => ({
  getPurchaseOrders: vi.fn(),
  getPurchaseOrder: vi.fn(),
  getProjects: vi.fn(),
  getProject: vi.fn(),
  getCompanyVendors: vi.fn(),
  createPurchaseOrder: vi.fn(),
  issuePurchaseOrder: vi.fn(),
}));

vi.mock('@forethread/api-client', () => mockApiClient);

vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ currentUser: { companyId: 'company-1' } }),
}));

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
} from './purchase-orders.service';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('purchase-orders.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('usePurchaseOrders', () => {
    it('calls getPurchaseOrders with params and returns data', async () => {
      const mockData = { items: [{ id: 'po-1' }], meta: { total: 1 } };
      mockApiClient.getPurchaseOrders.mockResolvedValue(mockData);

      const { result } = renderHook(() => usePurchaseOrders({ page: 1, limit: 25 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.getPurchaseOrders).toHaveBeenCalledWith(
        { page: 1, limit: 25 },
        { skipErrorHandler: true },
      );
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('usePurchaseOrder', () => {
    it('calls getPurchaseOrder with id and returns data', async () => {
      const mockPo = { id: 'po-1', projectName: 'Test' };
      mockApiClient.getPurchaseOrder.mockResolvedValue(mockPo);

      const { result } = renderHook(() => usePurchaseOrder('po-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.getPurchaseOrder).toHaveBeenCalledWith('po-1');
      expect(result.current.data).toEqual(mockPo);
    });

    it('does not call getPurchaseOrder when id is empty', () => {
      renderHook(() => usePurchaseOrder(''), { wrapper: createWrapper() });
      expect(mockApiClient.getPurchaseOrder).not.toHaveBeenCalled();
    });
  });

  describe('useProjectsList', () => {
    it('calls getProjects with limit 100', async () => {
      const mockData = { items: [{ id: 'p-1', name: 'Project 1' }] };
      mockApiClient.getProjects.mockResolvedValue(mockData);

      const { result } = renderHook(() => useProjectsList(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.getProjects).toHaveBeenCalledWith({ limit: 100 });
      expect(result.current.data).toEqual(mockData);
    });
  });

  describe('useProjectDetail', () => {
    it('calls getProject with id', async () => {
      const mockProject = { id: 'p-1', name: 'Test', locations: [] };
      mockApiClient.getProject.mockResolvedValue(mockProject);

      const { result } = renderHook(() => useProjectDetail('p-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.getProject).toHaveBeenCalledWith('p-1');
    });

    it('does not call getProject when id is empty', () => {
      renderHook(() => useProjectDetail(''), { wrapper: createWrapper() });
      expect(mockApiClient.getProject).not.toHaveBeenCalled();
    });
  });

  describe('useCompanyVendors', () => {
    it('calls getCompanyVendors with companyId', async () => {
      const mockVendors = [{ id: 'v-1', legalName: 'Vendor 1' }];
      mockApiClient.getCompanyVendors.mockResolvedValue(mockVendors);

      const { result } = renderHook(() => useCompanyVendors(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.getCompanyVendors).toHaveBeenCalledWith('company-1');
    });
  });

  describe('useCreatePurchaseOrder', () => {
    it('calls createPurchaseOrder and invalidates queries on success', async () => {
      mockApiClient.createPurchaseOrder.mockResolvedValue({ id: 'new-po' });

      const { result } = renderHook(() => useCreatePurchaseOrder(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate({ projectId: 'p-1', vendorId: 'v-1', lineItems: [] } as any);
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.createPurchaseOrder).toHaveBeenCalled();
    });
  });

  describe('useIssuePurchaseOrder', () => {
    it('calls issuePurchaseOrder and invalidates queries on success', async () => {
      mockApiClient.issuePurchaseOrder.mockResolvedValue({ id: 'po-1' });

      const { result } = renderHook(() => useIssuePurchaseOrder(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate('po-1');
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.issuePurchaseOrder).toHaveBeenCalledWith('po-1');
    });
  });
});
