import { getWarehouseDashboard } from '@forethread/api-client';
import { useQuery } from '@tanstack/react-query';

export function useDashboardData() {
  return useQuery({
    queryKey: ['dashboard', 'warehouse'],
    queryFn: () => getWarehouseDashboard(),
    staleTime: 30_000,
  });
}
