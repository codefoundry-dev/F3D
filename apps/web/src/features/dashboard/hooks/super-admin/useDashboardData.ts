import { getAuditLogs, getSuperAdminDashboard } from '@forethread/api-client';
import { useQuery } from '@tanstack/react-query';

export function useDashboardData() {
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['dashboard', 'super-admin'],
    queryFn: () => getSuperAdminDashboard(),
    staleTime: 30_000,
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-logs', { limit: 5 }],
    queryFn: () => getAuditLogs({ limit: 5 }),
  });

  return {
    dashboard: dashboardData ?? null,
    dashboardLoading,
    recentLogs: auditData?.items ?? [],
    auditLoading,
  };
}
