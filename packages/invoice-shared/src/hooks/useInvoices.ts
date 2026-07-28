import {
  getInvoices,
  getInvoice,
  getInvoiceIntakeAddress,
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
 * Create invoice mutation hooks with optional extra cache invalidation keys.
 * FO app passes `extraInvalidateKeys: [['dashboard', 'finance']]`
 */
export function useApproveInvoice(extraInvalidateKeys?: string[][]) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => approveInvoice(id),
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
    mutationFn: (id: string) => rejectInvoice(id),
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
