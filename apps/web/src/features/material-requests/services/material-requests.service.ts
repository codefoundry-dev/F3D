import {
  getMaterialRequests,
  getMaterialRequest,
  createMaterialRequest,
  getProjects,
  getProject,
  getMaterialSuggestions,
  getBoms,
  getBom,
  queryKeys,
  type MrListParams,
  type CreateMaterialRequestInput,
  type ProjectListParams,
} from '@forethread/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/state/auth.store';

// ── Material Request queries ─────────────────────────────────────────────────

/** The current foreman's own material requests (My Requests list). */
export function useMaterialRequests(params?: MrListParams) {
  return useQuery({
    queryKey: queryKeys.materialRequests.list((params ?? {}) as Record<string, unknown>),
    queryFn: () => getMaterialRequests(params, { skipErrorHandler: true }),
  });
}

export function useMaterialRequest(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.materialRequests.detail(id ?? ''),
    queryFn: () => getMaterialRequest(id as string),
    enabled: !!id,
  });
}

export function useCreateMaterialRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateMaterialRequestInput) =>
      createMaterialRequest(input, { skipErrorHandler: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.materialRequests.all() });
    },
  });
}

// ── Data-source queries used by the wizard steps ─────────────────────────────

/** Projects (jobs) the foreman can raise requests against. */
export function useMrProjects(params?: ProjectListParams) {
  return useQuery({
    queryKey: ['projects', 'mr', params],
    queryFn: () => getProjects({ limit: 100, ...params }, { skipErrorHandler: true }),
    select: (data) => data.items,
  });
}

/** Full project detail for the selected job (Job Overview + delivery locations). */
export function useMrProjectDetail(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => getProject(projectId as string),
    enabled: !!projectId,
  });
}

/**
 * Catalogue material suggestions for the Catalog tab. Debounced search term is
 * supplied by the caller; an empty term returns the catalogue's default set.
 */
export function useMrMaterialSuggestions(search: string) {
  return useQuery({
    queryKey: ['material-suggestions', search],
    queryFn: () => getMaterialSuggestions(search),
  });
}

/** The active BOM for the selected project (BOM tab source). */
export function useMrProjectBoms(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.boms.byProject(projectId ?? ''),
    queryFn: () => getBoms(projectId as string),
    enabled: !!projectId,
  });
}

/** Line items of a single BOM (resolved once a BOM id is known). */
export function useMrBomDetail(bomId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.boms.detail(bomId ?? ''),
    queryFn: () => getBom(bomId as string),
    enabled: !!bomId,
  });
}

/** Convenience accessor for the signed-in user's company (for future scoping). */
export function useCurrentUserCompanyId() {
  return useAuthStore((s) => s.currentUser?.companyId ?? null);
}
