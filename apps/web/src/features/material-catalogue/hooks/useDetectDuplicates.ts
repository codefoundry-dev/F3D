import {
  detectMaterialDuplicates,
  type DetectMaterialDuplicatesResponse,
  type DuplicateCandidateInput,
  type MaterialDuplicateMatch,
} from '@forethread/api-client';
import { useMutation, type UseMutationResult } from '@tanstack/react-query';

/**
 * Detect-duplicates plumbing for the upload wizard (US 4.01 Phase 3). A thin
 * mutation wrapper around `detectMaterialDuplicates`; the wizard fires it on a
 * debounce as the candidate rows change. Kept a mutation (not a query) because
 * the wizard owns the debounce + re-check trigger and we only ever want the
 * latest result, not a cached one keyed on the (potentially huge) row array.
 */
export function useDetectDuplicates(): UseMutationResult<
  DetectMaterialDuplicatesResponse,
  Error,
  DuplicateCandidateInput[]
> {
  return useMutation<DetectMaterialDuplicatesResponse, Error, DuplicateCandidateInput[]>({
    mutationFn: (candidates) => detectMaterialDuplicates(candidates, { skipErrorHandler: true }),
  });
}

/**
 * Reduce a detect-duplicates response into the two lookups the wizard renders
 * from: the set of duplicate row indexes (for orange highlighting) and a map of
 * index → matches (for the "View (CODE)" strip). Indexes are the candidate
 * positions echoed back by the backend, so they line up with the draft rows.
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
