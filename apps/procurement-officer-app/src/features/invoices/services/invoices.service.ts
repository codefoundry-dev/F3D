import {
  getInvoices,
  getInvoice,
  approveInvoice,
  rejectInvoice,
  bulkApproveInvoices,
  exportInvoices,
  type InvoiceListParams,
} from '@forethread/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useInvoices(params?: InvoiceListParams) {
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: () => getInvoices(params, { skipErrorHandler: true }),
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => getInvoice(id as string),
    enabled: !!id,
  });
}

export function useApproveInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => approveInvoice(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useRejectInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => rejectInvoice(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useBulkApproveInvoices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => bulkApproveInvoices(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useExportInvoices() {
  return useMutation({
    mutationFn: ({
      format,
      params,
    }: {
      format: 'csv' | 'xlsx' | 'pdf';
      params?: InvoiceListParams;
    }) => exportInvoices(format, params),
  });
}
