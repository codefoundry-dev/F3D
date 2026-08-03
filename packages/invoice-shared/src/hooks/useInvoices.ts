import {
  getInvoices,
  getInvoice,
  getInvoiceAuditTrail,
  getInvoiceIntakeAddress,
  getInvoicePoMatch,
  approveInvoice,
  rejectInvoice,
  reviewInvoice,
  bulkApproveInvoices,
  exportInvoices,
  exportSingleInvoice,
  uploadInvoice,
  type InvoiceListParams,
  type ReviewInvoicePayload,
} from '@forethread/api-client';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';

export function useInvoices(params?: InvoiceListParams) {
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: () => getInvoices(params, { skipErrorHandler: true }),
    placeholderData: keepPreviousData,
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => getInvoice(id as string),
    enabled: !!id,
    // While the intake extraction is still reading the document (FOR-291),
    // poll until it completes or fails so the review form fills itself in.
    refetchInterval: (query) => {
      const status = query.state.data?.extraction?.status;
      return status === 'PENDING' || status === 'PROCESSING' ? 3000 : false;
    },
  });
}

/**
 * Invoice ↔ PO reconciliation report (FOR-293): PO resolution plus per-line
 * price/quantity variance flags, recomputed from the saved invoice lines.
 * Lives under the ['invoices'] key so review/approve saves refresh it.
 */
export function useInvoicePoMatch(id: string | undefined) {
  return useQuery({
    queryKey: ['invoices', id, 'po-match'],
    queryFn: () => getInvoicePoMatch(id as string),
    enabled: !!id,
  });
}

/** Persist the reviewer's confirmed/corrected invoice fields (FOR-291). */
export function useReviewInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReviewInvoicePayload }) =>
      reviewInvoice(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

/** Upload an invoice file, creating a new Pending invoice (FOR-290). */
export function useUploadInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => uploadInvoice(file, { skipErrorHandler: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

/** The company's invoice-intake email address; email is null when not configured. */
export function useInvoiceIntakeAddress() {
  return useQuery({
    queryKey: ['invoices', 'intake-address'],
    queryFn: () => getInvoiceIntakeAddress(),
    staleTime: Infinity,
  });
}

export function useExportInvoices() {
  return useMutation({
    mutationFn: ({
      format,
      params,
    }: {
      format: 'csv' | 'xlsx' | 'pdf';
      params?: InvoiceListParams & { ids?: string };
    }) => exportInvoices(format, params),
  });
}

export function useExportSingleInvoice() {
  return useMutation({
    mutationFn: ({ id, format }: { id: string; format: 'csv' | 'xlsx' | 'pdf' }) =>
      exportSingleInvoice(id, format),
  });
}

/**
 * State history for an invoice (FOR-294): transitions with reasons, oldest
 * first. Keyed under ['invoices'] so the approve/reject invalidations below
 * refresh it too.
 */
export function useInvoiceAuditTrail(id: string | undefined) {
  return useQuery({
    queryKey: ['invoices', id, 'audit'],
    queryFn: () => getInvoiceAuditTrail(id as string),
    enabled: !!id,
  });
}

/**
 * Create invoice mutation hooks with optional extra cache invalidation keys.
 * FO app passes `extraInvalidateKeys: [['dashboard', 'finance']]`
 * The optional reason is recorded on the invoice's audit trail (FOR-294);
 * a reject reason is additionally quoted in the vendor's rejection email.
 */
export function useApproveInvoice(extraInvalidateKeys?: string[][]) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => approveInvoice(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      extraInvalidateKeys?.forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
}

export function useRejectInvoice(extraInvalidateKeys?: string[][]) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => rejectInvoice(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      extraInvalidateKeys?.forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
}

export function useBulkApproveInvoices(extraInvalidateKeys?: string[][]) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => bulkApproveInvoices(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      extraInvalidateKeys?.forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
}
