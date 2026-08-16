import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { useAllRows } from './use-all-rows';

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const page = (items: string[], total: number, totalPages: number) => ({
  items,
  meta: { total, totalPages },
});

describe('useAllRows', () => {
  it('fetches a single page once when everything fits', async () => {
    const fetchPage = vi.fn().mockResolvedValue(page(['a', 'b'], 2, 1));
    const { result } = renderHook(() => useAllRows(['rfqs', 'test-1'], fetchPage), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(1);
    expect(result.current.data).toEqual({ items: ['a', 'b'], total: 2 });
  });

  it('fetches every remaining page and concatenates in page order', async () => {
    const fetchPage = vi.fn((p: number) => Promise.resolve(page([`p${p}-1`, `p${p}-2`], 6, 3)));
    const { result } = renderHook(() => useAllRows(['rfqs', 'test-2'], fetchPage), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
    expect(result.current.data).toEqual({
      items: ['p1-1', 'p1-2', 'p2-1', 'p2-2', 'p3-1', 'p3-2'],
      total: 6,
    });
  });

  it('stops at the 20-page safety cap and reports the real total', async () => {
    const fetchPage = vi.fn((p: number) => Promise.resolve(page([`p${p}`], 5000, 50)));
    const { result } = renderHook(() => useAllRows(['rfqs', 'test-3'], fetchPage), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchPage).toHaveBeenCalledTimes(20);
    expect(result.current.data?.items).toHaveLength(20);
    // total stays the backend's count so TruncationNote can surface the gap.
    expect(result.current.data?.total).toBe(5000);
  });

  it('surfaces an error when any page fails', async () => {
    const fetchPage = vi.fn((p: number) =>
      p === 2 ? Promise.reject(new Error('boom')) : Promise.resolve(page(['x'], 3, 3)),
    );
    const { result } = renderHook(() => useAllRows(['rfqs', 'test-4'], fetchPage), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
