import {
  saveRfqDraft,
  updateRfq,
  sendRfq,
  getRfq,
  getProjects,
  getProject,
  getMaterials,
  getVendors,
  type ProjectListParams,
  type MaterialListQueryParams,
  type VendorListParams,
} from '@forethread/api-client';
import type { SaveRfqDraftValues, UpdateRfqValues } from '@forethread/shared-types/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ── RFQ draft mutations (save-as-you-go, FOR-202) ────────────────────────────

export function useSaveRfqDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    // SaveRfqDraftValues (zod) types `lineItems[].source` as a 'CATALOG' | 'BOM'
    // string union, whereas the api-client DTO types it as the RfqLineItemSource
    // enum. The runtime values are identical; the cast bridges the nominal gap
    // without importing the swagger-laden root barrel into the Vite bundle.
    mutationFn: (dto: SaveRfqDraftValues) =>
      saveRfqDraft(dto as Parameters<typeof saveRfqDraft>[0], { skipErrorHandler: true }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      queryClient.setQueryData(['rfqs', data.id], data);
    },
  });
}

export function useUpdateRfq() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateRfqValues }) =>
      updateRfq(id, dto as Parameters<typeof updateRfq>[1], { skipErrorHandler: true }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      queryClient.setQueryData(['rfqs', data.id], data);
    },
  });
}

/**
 * Send a DRAFT RFQ to its invited vendors (FOR-202): flips the RFQ to OPEN and
 * triggers tokenized invitation emails server-side. `cc` is an optional list of
 * extra email recipients. Errors are surfaced inline (skipErrorHandler) so the
 * send dialog can show them rather than a global toast.
 */
export function useSendRfq() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, cc }: { id: string; cc?: string[] }) =>
      sendRfq(id, cc && cc.length > 0 ? { cc } : undefined, { skipErrorHandler: true }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      queryClient.setQueryData(['rfqs', data.id], data);
    },
  });
}

export function useRfq(id: string | undefined) {
  return useQuery({
    queryKey: ['rfqs', id],
    queryFn: () => getRfq(id as string),
    enabled: !!id,
  });
}

// ── Data-source queries used by the create-RFQ steps ─────────────────────────

export function useRfqProjects(params?: ProjectListParams) {
  return useQuery({
    queryKey: ['projects', params],
    queryFn: () => getProjects({ limit: 100, ...params }, { skipErrorHandler: true }),
    select: (data) => data.items,
  });
}

/** Delivery locations for the selected project (step 4 options). */
export function useProjectDeliveryLocations(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projects', projectId, 'delivery-locations'],
    queryFn: () => getProject(projectId as string),
    enabled: !!projectId,
    select: (project) => project.locations.filter((l) => l.type === 'DELIVERY'),
  });
}

export function useRfqMaterials(params?: MaterialListQueryParams) {
  return useQuery({
    queryKey: ['materials', params],
    queryFn: () => getMaterials({ limit: 50, ...params }),
    select: (data) => data.items,
  });
}

/** Vendors assigned to the contractor (step 3 options). */
export function useAssignedVendors(params?: VendorListParams) {
  return useQuery({
    queryKey: ['vendors', params],
    queryFn: () => getVendors({ limit: 100, ...params }),
    select: (data) => data.items,
  });
}
