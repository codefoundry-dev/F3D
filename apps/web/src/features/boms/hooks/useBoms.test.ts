import { getBom, getBoms, createBom } from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

vi.mock('@forethread/api-client', () => ({
  getBoms: vi.fn().mockResolvedValue([{ id: 'bom-1', bomNumber: 'BOM-001' }]),
  getBom: vi.fn().mockResolvedValue({ id: 'bom-1', bomNumber: 'BOM-001', items: [] }),
  createBom: vi.fn().mockResolvedValue({ id: 'bom-2', bomNumber: 'BOM-002', items: [] }),
  queryKeys: {
    boms: {
      all: () => ['boms'],
      byProject: (projectId: string) => ['boms', 'project', projectId],
      detail: (id: string) => ['boms', id],
    },
  },
}));

import { useProjectBoms, useBom, useCreateBom } from './useBoms';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useBoms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useProjectBoms', () => {
    it('fetches the BOM list for a project via getBoms', async () => {
      const { result } = renderHook(() => useProjectBoms('proj-1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(getBoms).toHaveBeenCalledWith('proj-1');
      expect(result.current.data).toEqual([{ id: 'bom-1', bomNumber: 'BOM-001' }]);
    });

    it('is disabled when projectId is empty', () => {
      const { result } = renderHook(() => useProjectBoms(''), { wrapper: createWrapper() });

      expect(result.current.fetchStatus).toBe('idle');
      expect(getBoms).not.toHaveBeenCalled();
    });
  });

  describe('useBom', () => {
    it('fetches a single BOM by id', async () => {
      const { result } = renderHook(() => useBom('bom-1'), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(getBom).toHaveBeenCalledWith('bom-1');
      expect(result.current.data).toEqual({ id: 'bom-1', bomNumber: 'BOM-001', items: [] });
    });

    it('stays disabled and does not call getBom when id is null', () => {
      const { result } = renderHook(() => useBom(null), { wrapper: createWrapper() });

      expect(result.current.fetchStatus).toBe('idle');
      expect(getBom).not.toHaveBeenCalled();
    });
  });

  describe('useCreateBom', () => {
    it('calls createBom and seeds + invalidates the cache on success', async () => {
      const { result } = renderHook(() => useCreateBom(), { wrapper: createWrapper() });

      result.current.mutate({ projectId: 'proj-1', items: [] });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(createBom).toHaveBeenCalledWith({ projectId: 'proj-1', items: [] });
      expect(result.current.data).toEqual({ id: 'bom-2', bomNumber: 'BOM-002', items: [] });
    });
  });
});
