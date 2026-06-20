import type { KpiSummary } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import FileTextIcon from '@forethread/ui-components/assets/icons/file-text.svg?react';

interface KpiSummaryCardsProps {
  data: KpiSummary | null;
  isLoading?: boolean;
}

const cards = [
  { key: 'rfqs' as const, label: 'kpi.rfqs' },
  { key: 'pos' as const, label: 'kpi.pos' },
  { key: 'quotes' as const, label: 'kpi.quotes' },
  { key: 'invoices' as const, label: 'kpi.invoicesLabel' },
];

export function KpiSummaryCards({ data, isLoading }: KpiSummaryCardsProps) {
  const { t } = useTranslation('dashboard');

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[82px] animate-pulse rounded-[14px] bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ key, label }) => {
        const counts = data?.[key];
        return (
          <div
            key={key}
            className="flex items-center gap-3 rounded-[14px] border border-border bg-card px-4 py-3"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent">
              <FileTextIcon className="h-6 w-6 text-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{t(label as never)}</p>
              <div className="mt-1 flex items-center gap-4">
                <span className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-foreground">
                    {counts?.pending ?? 0}
                  </span>
                  <span className="text-sm text-muted-foreground">{t('kpi.pending')}</span>
                </span>
                <span className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-foreground">
                    {counts?.overdue ?? 0}
                  </span>
                  <span className="text-sm text-muted-foreground">{t('kpi.overdue')}</span>
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
