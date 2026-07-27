import {
  applyDocExtractionItemOps,
  confirmDocExtraction,
  createDocExtraction,
  deleteDocExtraction,
  type DocExtractionItemOp,
  type DocExtractionItemOpsResult,
  type DocExtractionItemsResponse,
  type DocExtractionResponse,
  type DocExtractionType,
  getDocExtraction,
  getDocExtractionItems,
  getDocExtractionSummary,
  queryKeys,
  updateDocExtraction,
} from '@forethread/api-client';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

const TERMINAL_STATUSES: ReadonlySet<DocExtractionResponse['status']> = new Set([
  'COMPLETED',
  'CONFIRMED',
  'FAILED',
]);

const POLL_INTERVAL_MS = 1500;

// While the job is PENDING/PROCESSING the poll responses are tiny (no result
// yet). But the poll that catches the COMPLETED transition returns the full
// editedResult, which for a catalogue spreadsheet is a multi-MB payload (a real
// Rexel export is ~62k rows). On a small backend that single response can take
// well past the api-client's default 30s timeout to serialise + transfer, which
// aborts the poll (XHR "canceled") and leaves the modal stuck. Give the poll
// generous headroom so the completing fetch lands instead of being canceled.
const RESULT_FETCH_TIMEOUT_MS = 120_000;

/**
 * Subscribe to a single extraction job. While the job is PENDING or PROCESSING
 * the query polls every {@link POLL_INTERVAL_MS}ms; once it reaches a terminal
 * state (COMPLETED / CONFIRMED / FAILED) polling stops.
 */
export function useDocExtractionQuery(id: string | null): UseQueryResult<DocExtractionResponse> {
  return useQuery<DocExtractionResponse>({
    queryKey: queryKeys.docExtractions.detail(id ?? ''),
    queryFn: () => getDocExtraction(id as string, { timeout: RESULT_FETCH_TIMEOUT_MS }),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return POLL_INTERVAL_MS;
      return TERMINAL_STATUSES.has(data.status) ? false : POLL_INTERVAL_MS;
    },
    // The poll interval owns freshness. A window-focus refetch would re-download
    // the terminal payload — tens of MB for a large catalogue — and re-diff it
    // on the main thread, janking the page every time the tab regains focus.
    refetchOnWindowFocus: false,
  });
}

/**
 * Poll variant for flows that must never download the result payload — the
 * COMPLETED response for a 62k-row catalogue is ~50MB while the summary view
 * stays a few hundred bytes. Same polling cadence as {@link useDocExtractionQuery}.
 */
export function useDocExtractionSummaryQuery(
  id: string | null,
): UseQueryResult<DocExtractionResponse> {
  return useQuery<DocExtractionResponse>({
    queryKey: queryKeys.docExtractions.summary(id ?? ''),
    queryFn: () => getDocExtractionSummary(id as string),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return POLL_INTERVAL_MS;
      return TERMINAL_STATUSES.has(data.status) ? false : POLL_INTERVAL_MS;
    },
    refetchOnWindowFocus: false,
  });
}

/**
 * One window of a stored result's items, sliced server-side. `indexes` mode
 * fetches scattered absolute positions (the duplicates-only filter); page mode
 * a contiguous slice. Disabled until `enabled` so Step 1 never fetches.
 */
export function useDocExtractionItemsQuery<TItem = Record<string, unknown>>(
  id: string | null,
  params: { page?: number; limit?: number; indexes?: number[] },
  enabled: boolean,
): UseQueryResult<DocExtractionItemsResponse<TItem>> {
  return useQuery<DocExtractionItemsResponse<TItem>>({
    queryKey: queryKeys.docExtractions.items(id ?? '', params),
    queryFn: () => getDocExtractionItems<TItem>(id as string, params),
    enabled: Boolean(id) && enabled,
    // Keep the previous window on screen while the next page loads.
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

/**
 * Sparse row edits applied server-side (see applyDocExtractionItemOps). The
 * caller owns cache invalidation — a flush of buffered cell edits must NOT
 * refetch (the client already shows the edited values), while structural ops
 * (remove/duplicate) must.
 */
export function useApplyDocExtractionItemOps(
  id: string | null,
): UseMutationResult<DocExtractionItemOpsResult, Error, DocExtractionItemOp[]> {
  return useMutation<DocExtractionItemOpsResult, Error, DocExtractionItemOp[]>({
    mutationFn: (ops) =>
      applyDocExtractionItemOps(id as string, ops, { skipErrorHandler: true, timeout: 120_000 }),
  });
}

export function useCreateDocExtraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      type: DocExtractionType;
      file: File;
      promptHint?: string;
      sheetNames?: string[];
    }) => createDocExtraction(input.type, input.file, input.promptHint, input.sheetNames),
    onSuccess: (job) => {
      qc.setQueryData(queryKeys.docExtractions.detail(job.id), job);
      void qc.invalidateQueries({ queryKey: queryKeys.docExtractions.all() });
    },
  });
}

export function useUpdateDocExtraction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (editedResult: Record<string, unknown>) => updateDocExtraction(id, editedResult),
    onSuccess: (job) => {
      qc.setQueryData(queryKeys.docExtractions.detail(job.id), job);
    },
  });
}

export function useConfirmDocExtraction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (editedResult?: Record<string, unknown>) => confirmDocExtraction(id, editedResult),
    onSuccess: (job) => {
      qc.setQueryData(queryKeys.docExtractions.detail(job.id), job);
      void qc.invalidateQueries({ queryKey: queryKeys.docExtractions.all() });
    },
  });
}

export function useDeleteDocExtraction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteDocExtraction(id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: queryKeys.docExtractions.detail(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.docExtractions.all() });
    },
  });
}
