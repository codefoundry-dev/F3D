import { getFinanceDashboard } from '@forethread/api-client';
import { useQuery } from '@tanstack/react-query';

export function useDashboardData() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'finance'],
    queryFn: () => getFinanceDashboard(),
    staleTime: 30000,
  });

  return {
    totalPendingAmount: data?.totalPendingAmount ?? 0,
    pendingInvoiceCount: data?.pendingInvoiceCount ?? 0,
    invoicesDueThisWeek: data?.invoicesDueThisWeek ?? 0,
    invoicesDueAmount: data?.invoicesDueAmount ?? 0,
    disputedInvoiceCount: data?.disputedInvoiceCount ?? 0,
    disputedTrend: data?.disputedTrend ?? 0,
    invoicesPendingApproval: data?.invoicesPendingApproval ?? [],
    disputedInvoices: data?.disputedInvoices ?? [],
    isLoading,
    error,
  };
}
