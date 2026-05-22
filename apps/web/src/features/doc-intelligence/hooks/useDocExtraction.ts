import {
  confirmDocExtraction,
  createDocExtraction,
  deleteDocExtraction,
  type DocExtractionResponse,
  type DocExtractionType,
  getDocExtraction,
  queryKeys,
  updateDocExtraction,
} from '@forethread/api-client';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

const TERMINAL_STATUSES: ReadonlySet<DocExtractionResponse['status']> = new Set([
  'COMPLETED',
  'CONFIRMED',
  'FAILED',
]);

const POLL_INTERVAL_MS = 1500;

/**
 * Subscribe to a single extraction job. While the job is PENDING or PROCESSING
 * the query polls every {@link POLL_INTERVAL_MS}ms; once it reaches a terminal
 * state (COMPLETED / CONFIRMED / FAILED) polling stops.
 */
export function useDocExtractionQuery(
  id: string | null,
): UseQueryResult<DocExtractionResponse> {
  return useQuery<DocExtractionResponse>({
    queryKey: queryKeys.docExtractions.detail(id ?? ''),
    queryFn: () => getDocExtraction(id as string),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return POLL_INTERVAL_MS;
      return TERMINAL_STATUSES.has(data.status) ? false : POLL_INTERVAL_MS;
    },
  });
}

export function useCreateDocExtraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: DocExtractionType; file: File; promptHint?: string }) =>
      createDocExtraction(input.type, input.file, input.promptHint),
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
