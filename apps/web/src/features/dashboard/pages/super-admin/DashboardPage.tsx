import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { Spinner } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import ClockIcon from '@forethread/ui-components/assets/icons/clock.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import MaterialCatalogueIcon from '@forethread/ui-components/assets/icons/material-catalogue.svg?react';
import NewUserIcon from '@forethread/ui-components/assets/icons/new-user.svg?react';
import NoteIcon from '@forethread/ui-components/assets/icons/note.svg?react';
import SettingsIcon from '@forethread/ui-components/assets/icons/settings.svg?react';
import SuppliersIcon from '@forethread/ui-components/assets/icons/suppliers.svg?react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { useDashboardData } from '../../hooks/super-admin/useDashboardData';
import { KpiCard } from '../../ui/super-admin/KpiCard';
import { PlatformStateTable } from '../../ui/super-admin/PlatformStateTable';
import { RecentChangesTimeline } from '../../ui/super-admin/RecentChangesTimeline';

/** Direction arrow for a week-over-week delta: negatives point down, 0/positive up. */
function trendDirection(delta: number): 'up' | 'down' | 'flat' {
  if (delta < 0) return 'down';
  if (delta > 0) return 'up';
  return 'flat';
}

/** Signed, human-readable delta: -2 → "-2", 3 → "+3", 0 → "0". */
function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  const { dashboard, dashboardLoading, recentLogs, auditLoading } = useDashboardData();

  // Surface the page title + subtitle in the global app header (super-admin
  // lands on `/`, so this dashboard owns the header copy).
  useEffect(() => {
    setPageTitle(t('title'), t('subtitle'));
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const quickActions = [
    {
      label: t('quickActions.userManagement'),
      icon: <NewUserIcon className="w-6 h-6" />,
      onClick: () => navigate(ROUTES.users),
    },
    {
      label: t('quickActions.companyManagement'),
      icon: <SuppliersIcon className="w-6 h-6" />,
      onClick: () => navigate(ROUTES.users),
    },
    {
      label: t('quickActions.materialCatalogue'),
      icon: <MaterialCatalogueIcon className="w-6 h-6" />,
      onClick: () => navigate(ROUTES.materialCatalogue),
    },
    {
      label: t('quickActions.adminPanel'),
      icon: <SettingsIcon className="w-6 h-6" />,
      onClick: () => navigate(ROUTES.adminPanel),
    },
  ];

  const systemHealthy = dashboard?.system.status === 'healthy';
  const usersDelta = dashboard?.users.newThisWeek ?? 0;
  const companiesDelta = dashboard?.companies.newThisWeek ?? 0;

  return (
    <div className="p-4 space-y-4 overflow-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard
          icon={<NoteIcon className="w-6 h-6 text-foreground" />}
          title={t('kpi.platformStatus')}
          value={
            dashboardLoading
              ? '...'
              : systemHealthy
                ? t('kpi.allOperational')
                : t('kpi.degraded', { defaultValue: 'Degraded' })
          }
          valueClassName="text-sm font-normal text-foreground"
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
          icon={<NewUserIcon className="w-6 h-6 text-foreground" />}
          title={t('kpi.activeUsers')}
          value={dashboardLoading ? '...' : String(dashboard?.users.active ?? 0)}
          valueClassName="text-2xl font-normal text-foreground"
          trend={dashboard ? `${formatDelta(usersDelta)} ${t('kpi.thisWeek')}` : undefined}
          trendDirection={trendDirection(usersDelta)}
        />
        <KpiCard
          icon={<SuppliersIcon className="w-6 h-6 text-foreground" />}
          title={t('kpi.totalCompanies')}
          value={dashboardLoading ? '...' : String(dashboard?.companies.total ?? 0)}
          valueClassName="text-2xl font-normal text-foreground"
          trend={dashboard ? `${formatDelta(companiesDelta)} ${t('kpi.thisWeek')}` : undefined}
          trendDirection={trendDirection(companiesDelta)}
        />
        {/*
          Database Performance: the frame shows a "+3 this week" trend, but the
          SuperAdminDashboard DTO (api-client) exposes no week-over-week delta
          for dbResponseMs — and that DTO is out of scope for this pass. We omit
          the trend rather than fabricate one (the frame also annotates this card
          "Phase 2"). Wire a real delta here once the API provides it.
        */}
        <KpiCard
          icon={<ClockIcon className="w-6 h-6 text-foreground" />}
          title={t('kpi.dbPerformance')}
          value={dashboardLoading ? '...' : `${dashboard?.system.dbResponseMs ?? 0} ms`}
          valueClassName="text-2xl font-normal text-foreground"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className="flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl bg-[#1B1D22] text-white text-lg font-medium hover:bg-[#1B1D22]/90 transition-colors"
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      <PlatformStateTable />

      <div className="grid grid-cols-1 lg:grid-cols-[656fr_488fr] gap-4">
        <RecentChangesTimeline logs={recentLogs} isLoading={auditLoading} />

        {/*
          Google Analytics: empty Phase-2 placeholder slot (no data wired yet),
          per the frame — a titled card with an empty body.
        */}
        <div className="bg-card rounded-lg border border-border p-4 h-[448px]">
          <h2 className="text-base font-semibold text-foreground">{t('googleAnalytics.title')}</h2>
        </div>
      </div>
    </div>
  );
}
