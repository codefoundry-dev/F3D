import {
  getInvoices,
  getInvoice,
  approveInvoice,
  rejectInvoice,
  bulkApproveInvoices,
  exportInvoices,
  exportSingleInvoice,
  type InvoiceListParams,
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
