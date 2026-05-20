import { getVendorDashboard } from '@forethread/api-client';
import { useQuery } from '@tanstack/react-query';

export function useDashboardData() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'vendor'],
    queryFn: () => getVendorDashboard(),
    staleTime: 30000,
  });

  return {
    rfqsWaiting: data?.rfqsWaiting ?? [],
    invoices: data?.invoices ?? [],
    activePOs: data?.activePOs ?? [],
    isLoading,
    error,
  };
}
