import { useTranslation } from '@forethread/i18n';
import { Spinner } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import ClockIcon from '@forethread/ui-components/assets/icons/clock.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import DashboardIcon from '@forethread/ui-components/assets/icons/dashboard.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import NoteIcon from '@forethread/ui-components/assets/icons/note.svg?react';
import SettingsIcon from '@forethread/ui-components/assets/icons/settings.svg?react';
import SuppliersIcon from '@forethread/ui-components/assets/icons/suppliers.svg?react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { useDashboardData } from '../../hooks/super-admin/useDashboardData';
import { KpiCard } from '../../ui/super-admin/KpiCard';
import { PlatformStateTable } from '../../ui/super-admin/PlatformStateTable';
import { RecentChangesTimeline } from '../../ui/super-admin/RecentChangesTimeline';

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const { dashboard, dashboardLoading, recentLogs, auditLoading } = useDashboardData();

  const quickActions = [
    {
      label: t('quickActions.userManagement'),
      icon: <NewUserIcon className="w-4 h-4" />,
      onClick: () => navigate(ROUTES.users),
    },
    {
      label: t('quickActions.companyManagement'),
      icon: <SuppliersIcon className="w-4 h-4" />,
      onClick: () => navigate(ROUTES.users),
    },
    {
      label: t('quickActions.materialCatalogue'),
      icon: <DashboardIcon className="w-4 h-4" />,
      disabled: true,
    },
    {
      label: t('quickActions.adminPanel'),
      icon: <SettingsIcon className="w-4 h-4" />,
      onClick: () => navigate(ROUTES.adminPanel),
    },
  ];

  const systemHealthy = dashboard?.system.status === 'healthy';

  return (
    <div className="p-4 space-y-4 overflow-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<NoteIcon className="w-6 h-6 text-muted-foreground" />}
          title={t('kpi.platformStatus')}
          value={
            dashboardLoading
              ? '...'
              : systemHealthy
                ? t('kpi.allOperational')
                : t('kpi.degraded', { defaultValue: 'Degraded' })
          }
          valueClassName="text-sm font-medium"
          statusIcon={
            dashboardLoading ? (
              <Spinner size="sm" />
            ) : systemHealthy ? (
              <CheckCircleIcon className="w-4 h-4 text-[hsl(var(--success))]" />
            ) : (
              <CrossInCircleIcon className="w-4 h-4 text-[hsl(var(--destructive))]" />
            )
          }
        />
        <KpiCard
          icon={<NewUserIcon className="w-6 h-6 text-muted-foreground" />}
          title={t('kpi.activeUsers')}
          value={dashboardLoading ? '...' : String(dashboard?.users.active ?? 0)}
          valueClassName="text-2xl font-bold text-foreground"
          trend={dashboard ? `+${dashboard.users.newThisWeek} ${t('kpi.thisWeek')}` : undefined}
          trendUp
        />
        <KpiCard
          icon={<SuppliersIcon className="w-6 h-6 text-muted-foreground" />}
          title={t('kpi.totalCompanies')}
          value={dashboardLoading ? '...' : String(dashboard?.companies.total ?? 0)}
          valueClassName="text-2xl font-bold text-foreground"
          trend={dashboard ? `+${dashboard.companies.newThisWeek} ${t('kpi.thisWeek')}` : undefined}
          trendUp
        />
        <KpiCard
          icon={<ClockIcon className="w-6 h-6 text-muted-foreground" />}
          title={t('kpi.dbPerformance')}
          value={dashboardLoading ? '...' : `${dashboard?.system.dbResponseMs ?? 0} ms`}
          valueClassName="text-2xl font-bold text-foreground"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            disabled={'disabled' in action && action.disabled}
            className="flex items-center gap-2 px-5 py-3 rounded-lg bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      {dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={t('overview.projects', { defaultValue: 'Projects' })}
            value={dashboard.projects.total}
            breakdown={Object.entries(dashboard.projects.byStatus).map(([k, v]) => ({
              label: k,
              count: v,
            }))}
          />
          <StatCard
            title={t('overview.rfqs', { defaultValue: 'RFQs' })}
            value={dashboard.procurement.totalRfqs}
            breakdown={[{ label: 'Open', count: dashboard.procurement.openRfqs }]}
          />
          <StatCard
            title={t('overview.purchaseOrders', { defaultValue: 'Purchase Orders' })}
            value={dashboard.procurement.totalPos}
          />
          <StatCard
            title={t('overview.invoices', { defaultValue: 'Invoices' })}
            value={dashboard.procurement.totalInvoices}
            breakdown={[{ label: 'Pending', count: dashboard.procurement.pendingInvoices }]}
          />
        </div>
      )}

      <PlatformStateTable />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentChangesTimeline logs={recentLogs} isLoading={auditLoading} />

        {dashboard && (
          <div className="bg-card rounded-lg border border-border p-4">
            <h2 className="text-base font-semibold text-foreground mb-4">
              {t('usersByRole.title', { defaultValue: 'Users by Role' })}
            </h2>
            <div className="space-y-2">
              {dashboard.users.byRole
                .filter((r) => r.count > 0)
                .map((r) => (
                  <div
                    key={r.role}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <span className="text-sm text-foreground capitalize">
                      {r.role.replace(/_/g, ' ').toLowerCase()}
                    </span>
                    <span className="text-sm font-medium text-foreground">{r.count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  breakdown,
}: {
  title: string;
  value: number;
  breakdown?: { label: string; count: number }[];
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      {breakdown && breakdown.length > 0 && (
        <div className="mt-2 space-y-1">
          {breakdown.map((b) => (
            <div key={b.label} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground capitalize">
                {b.label.replace(/_/g, ' ').toLowerCase()}
              </span>
              <span className="font-medium text-foreground">{b.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
