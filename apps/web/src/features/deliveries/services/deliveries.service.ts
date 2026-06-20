import {
  getDeliveryReports,
  getDeliveryReport,
  createDeliveryReport,
  approveDeliveryReport,
  rejectDeliveryReport,
  uploadDeliveryReportAttachment,
  uploadDeliveryLinePhoto,
  createPoDeliveryLink,
  getProjects,
  getCompanyVendors,
  queryKeys,
  type DeliveryListParams,
  type ProjectListParams,
} from '@forethread/api-client';
import type { CreateDeliveryReportInput } from '@forethread/shared-types/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/state/auth.store';

// ── Queries ──────────────────────────────────────────────────────────────────

/** Delivery reports raised against the current company's purchase orders. */
export function useDeliveryReports(params?: DeliveryListParams) {
  return useQuery({
    queryKey: queryKeys.deliveries.list((params ?? {}) as Record<string, unknown>),
    queryFn: () => getDeliveryReports(params, { skipErrorHandler: true }),
  });
}

export function useDeliveryReport(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.deliveries.detail(id ?? ''),
    queryFn: () => getDeliveryReport(id as string),
    enabled: !!id,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────
//
// Each review mutation invalidates the whole delivery key space so the list and
// the detail both refetch the new state (mirrors material-requests.service.ts).

/** Invalidate every delivery query (list + detail). */
function useInvalidateDeliveries() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all() });
}

export function useCreateDeliveryReport() {
  const invalidate = useInvalidateDeliveries();
  return useMutation({
    mutationFn: (input: CreateDeliveryReportInput) =>
      createDeliveryReport(input, { skipErrorHandler: true }),
    onSuccess: invalidate,
  });
}

/** Approve a SUBMITTED delivery report (flows received quantities onto the PO). */
export function useApproveDeliveryReport() {
  const invalidate = useInvalidateDeliveries();
  return useMutation({
    mutationFn: (id: string) => approveDeliveryReport(id),
    onSuccess: invalidate,
  });
}

/** Reject a SUBMITTED delivery report (reason is required; PO is untouched). */
export function useRejectDeliveryReport() {
  const invalidate = useInvalidateDeliveries();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectDeliveryReport(id, { reason }),
    onSuccess: invalidate,
  });
}

/** Upload a report-level supporting attachment. */
export function useUploadDeliveryAttachment() {
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      uploadDeliveryReportAttachment(id, file, { skipErrorHandler: true }),
  });
}

/** Upload a damage-evidence photo against a delivery line. */
export function useUploadDeliveryLinePhoto() {
  return useMutation({
    mutationFn: ({ id, lineId, file }: { id: string; lineId: string; file: File }) =>
      uploadDeliveryLinePhoto(id, lineId, file, { skipErrorHandler: true }),
  });
}

/** Mint / fetch the public delivery-portal link for a PO (QR code). */
export function useCreatePoDeliveryLink() {
  return useMutation({
    mutationFn: (poId: string) => createPoDeliveryLink(poId, { skipErrorHandler: true }),
  });
}

// ── Data-source queries (filters + create-page seed) ───────────────────────────

/** Projects for the list "Project" filter and the create-page line-item seed. */
export function useDeliveryProjects(params?: ProjectListParams) {
  return useQuery({
    queryKey: ['projects', 'deliveries', params],
    queryFn: () => getProjects({ limit: 100, ...params }, { skipErrorHandler: true }),
    select: (data) => data.items,
  });
}

/** Vendors assigned to the current user's company — feeds the "Vendor" filter. */
export function useDeliveryVendors() {
  const companyId = useAuthStore((s) => s.currentUser?.companyId ?? null);
  return useQuery({
    queryKey: ['companies', companyId, 'vendors'],
    queryFn: () => getCompanyVendors(companyId as string),
    enabled: !!companyId,
  });
}
