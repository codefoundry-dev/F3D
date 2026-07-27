import {
  detectMaterialDuplicates,
  type DetectMaterialDuplicatesResponse,
  type DuplicateCandidateInput,
  type MaterialDuplicateMatch,
} from '@forethread/api-client';
import { useMutation, type UseMutationResult } from '@tanstack/react-query';

/** Inline candidate rows, or a stored extraction to check entirely server-side. */
export type DetectDuplicatesInput = DuplicateCandidateInput[] | { extractionId: string };

/**
 * Detect-duplicates plumbing for the upload wizard (US 4.01 Phase 3). A thin
 * mutation wrapper around `detectMaterialDuplicates`; the wizard fires it on a
 * debounce as the candidate rows change. Kept a mutation (not a query) because
 * the wizard owns the re-check trigger and we only ever want the latest result.
 * The wizard passes `{ extractionId }` so a 60k-row draft never round-trips —
 * the backend reads the identity fields straight from the stored result.
 */
export function useDetectDuplicates(): UseMutationResult<
  DetectMaterialDuplicatesResponse,
  Error,
  DetectDuplicatesInput
> {
  return useMutation<DetectMaterialDuplicatesResponse, Error, DetectDuplicatesInput>({
    // The extractionId variant answers with one big IN query over the whole
    // result — give it the same headroom as the other catalogue-scale calls
    // instead of the api-client's 30s default.
    mutationFn: (input) =>
      detectMaterialDuplicates(input, { skipErrorHandler: true, timeout: 120_000 }),
  });
}

/**
 * Reduce a detect-duplicates response into the two lookups the wizard renders
 * from: the set of duplicate row indexes (for orange highlighting) and a map of
 * index → matches (for the "View (CODE)" strip). Indexes are absolute positions
 * in the stored result, so they line up with the wizard's windowed rows.
 */
export function mapDuplicateResults(response: DetectMaterialDuplicatesResponse | undefined): {
  duplicateIndexes: Set<number>;
  matchesByIndex: Map<number, MaterialDuplicateMatch[]>;
} {
  const duplicateIndexes = new Set<number>();
  const matchesByIndex = new Map<number, MaterialDuplicateMatch[]>();
  for (const result of response?.results ?? []) {
    if (result.matches.length > 0) {
      duplicateIndexes.add(result.index);
      matchesByIndex.set(result.index, result.matches);
    }
  }
  return { duplicateIndexes, matchesByIndex };
}
