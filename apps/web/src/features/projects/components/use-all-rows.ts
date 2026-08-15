import { useQuery } from '@tanstack/react-query';

/** Backend list endpoints validate `limit` at max 100, so wider reads must page. */
export const PAGE_SIZE = 100;

/**
 * Safety valve so a pathological project can't fan out unbounded requests:
 * at most 20 pages (2,000 rows) per section. TruncationNote still reports the
 * shortfall if a project ever exceeds it.
 */
const MAX_PAGES = 20;

interface ListPage<T> {
  items: T[];
  meta: { total: number; totalPages: number };
}

export interface AllRowsResult<T> {
  items: T[];
  total: number;
}

/**
 * Fetches every page of a paginated list endpoint (page 1 first for the count,
 * the rest in parallel) so the project tabs see the whole project — the tables,
 * the derived vendor set and the Financials budget math were all silently
 * truncated at the first 100 rows before.
 *
 * Keep `queryKey[0]` equal to the resource's list-hook prefix (e.g. 'rfqs')
 * so the existing mutation invalidations reach these queries too.
 */
export function useAllRows<T>(
  queryKey: readonly unknown[],
  fetchPage: (page: number) => Promise<ListPage<T>>,
) {
  return useQuery<AllRowsResult<T>>({
    queryKey,
    queryFn: async () => {
      const first = await fetchPage(1);
      const totalPages = Math.min(first.meta.totalPages ?? 1, MAX_PAGES);
      const rest = await Promise.all(
        Array.from({ length: Math.max(totalPages - 1, 0) }, (_, i) => fetchPage(i + 2)),
      );
      return {
        items: [first, ...rest].flatMap((page) => page.items),
        total: first.meta.total,
      };
    },
  });
}
