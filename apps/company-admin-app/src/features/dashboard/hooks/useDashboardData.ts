import { getPoCaDashboard } from '@forethread/api-client';
import { useQuery } from '@tanstack/react-query';

export function useDashboardData() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'po-ca'],
    queryFn: () => getPoCaDashboard(),
    staleTime: 30000,
  });

  return {
    kpiSummary: data?.kpiSummary ?? null,
    quoteResponses: data?.quoteResponses ?? [],
    recentOrders: data?.recentOrders ?? [],
    pendingPurchaseOrders: data?.pendingPurchaseOrders ?? [],
    invoicesPendingApproval: data?.invoicesPendingApproval ?? [],
    projectSuggestions: data?.projectSuggestions ?? [],
    isLoading,
    error,
  };
}
