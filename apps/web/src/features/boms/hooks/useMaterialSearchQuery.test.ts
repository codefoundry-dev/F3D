import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

const getMaterialsMock = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', () => ({
  getMaterials: getMaterialsMock,
  queryKeys: {
    materials: {
      list: (params: Record<string, unknown>) => ['materials', 'list', params],
    },
  },
}));

import { useMaterialSearchQuery } from './useMaterialSearchQuery';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

const MATERIAL = {
  id: 'm-1',
  name: 'Steel Beam',
  code: 'SB-1',
  description: 'A sturdy beam',
  categoryId: 'cat-1',
  categoryName: 'Structural',
  unitOfMeasure: 'EA',
  status: 'ACTIVE',
  imageUrl: 'https://example.com/beam.png',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('useMaterialSearchQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps API items to the MaterialItem shape', async () => {
    getMaterialsMock.mockResolvedValue({ items: [MATERIAL], meta: { total: 1 } });

    const { result } = renderHook(() => useMaterialSearchQuery(''), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.results).toEqual([
      {
        id: 'm-1',
        name: 'Steel Beam',
        category: 'Structural',
        unit: 'EA',
        description: 'A sturdy beam',
        imageUrl: 'https://example.com/beam.png',
      },
    ]);
    expect(result.current.totalCount).toBe(1);
    expect(getMaterialsMock).toHaveBeenCalledWith({ search: undefined, limit: 20 });
  });

  it('coerces null optional fields to undefined', async () => {
    getMaterialsMock.mockResolvedValue({
      items: [{ ...MATERIAL, categoryName: null, description: null, imageUrl: null }],
      meta: { total: 1 },
    });

    const { result } = renderHook(() => useMaterialSearchQuery(''), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.results.length).toBe(1));

    expect(result.current.results[0]).toEqual({
      id: 'm-1',
      name: 'Steel Beam',
      category: undefined,
      unit: 'EA',
      description: undefined,
      imageUrl: undefined,
    });
  });

  it('falls back to results length when meta is absent', async () => {
    getMaterialsMock.mockResolvedValue({ items: [MATERIAL, { ...MATERIAL, id: 'm-2' }] });

    const { result } = renderHook(() => useMaterialSearchQuery(''), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.results.length).toBe(2));

    expect(result.current.totalCount).toBe(2);
  });

  it('returns an empty list when the response has no items', async () => {
    getMaterialsMock.mockResolvedValue({} as never);

    const { result } = renderHook(() => useMaterialSearchQuery(''), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.results).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it('does not apply a changed search term before the debounce window elapses', async () => {
    vi.useFakeTimers();
    getMaterialsMock.mockResolvedValue({ items: [], meta: { total: 0 } });

    try {
      const { rerender } = renderHook((search: string) => useMaterialSearchQuery(search), {
        wrapper: createWrapper(),
        initialProps: '',
      });

      getMaterialsMock.mockClear();
      rerender('steel');

      // Within the debounce window the new term has not yet been applied.
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(getMaterialsMock).not.toHaveBeenCalledWith({ search: 'steel', limit: 20 });

      // Once the window fully elapses the debounced value is flushed and the
      // query re-fires with the new term.
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(getMaterialsMock).toHaveBeenCalledWith({ search: 'steel', limit: 20 });
    } finally {
      vi.useRealTimers();
    }
  });
});
