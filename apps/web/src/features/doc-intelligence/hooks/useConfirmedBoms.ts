import {
  listDocExtractions,
  type DocExtractionResponse,
  type PaginatedDocExtractionsResponse,
  queryKeys,
} from '@forethread/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

export interface UseConfirmedBomsOptions {
  page?: number;
  limit?: number;
  /** Optional createdByUserId filter (e.g. for "my BOMs"). */
  createdByUserId?: string;
  enabled?: boolean;
}

/**
 * Lists confirmed BOM extractions, the set of BOMs that have been reviewed
 * by a user and are eligible to seed an RFQ (FOR-200 AC: "BOM available for
 * RFQ creation"). Thin wrapper around the existing list endpoint so the RFQ
 * creation flow does not have to know the exact filter combination.
 */
export function useConfirmedBoms(
  options: UseConfirmedBomsOptions = {},
): UseQueryResult<PaginatedDocExtractionsResponse> {
  const params = {
    type: 'BOM' as const,
    status: 'CONFIRMED' as const,
    page: options.page,
    limit: options.limit,
    createdByUserId: options.createdByUserId,
  };
  return useQuery<PaginatedDocExtractionsResponse>({
    queryKey: queryKeys.docExtractions.list(params),
    queryFn: () => listDocExtractions(params),
    enabled: options.enabled ?? true,
  });
}

export type ConfirmedBomSummary = DocExtractionResponse;
