import type { KpiSummary } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import InvoiceIcon from '@forethread/ui-components/assets/icons/invoice.svg?react';
import PurchaseOrdersIcon from '@forethread/ui-components/assets/icons/purchase-orders.svg?react';
import RequestIcon from '@forethread/ui-components/assets/icons/request.svg?react';
import SearchIcon from '@forethread/ui-components/assets/icons/search.svg?react';

interface KpiSummaryCardsProps {
  data: KpiSummary | null;
  isLoading?: boolean;
}

const cards = [
  { key: 'rfqs' as const, label: 'kpi.rfqs', Icon: SearchIcon },
  { key: 'pos' as const, label: 'kpi.pos', Icon: PurchaseOrdersIcon },
  { key: 'quotes' as const, label: 'kpi.quotes', Icon: RequestIcon },
  { key: 'invoices' as const, label: 'kpi.invoicesLabel', Icon: InvoiceIcon },
];

export function KpiSummaryCards({ data, isLoading }: KpiSummaryCardsProps) {
  const { t } = useTranslation('dashboard');

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ key, label, Icon }) => {
        const counts = data?.[key];
        return (
          <div
            key={key}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t(label as never)}</p>
              <div className="flex items-center gap-3 text-xs">
                <span>
                  <span className="text-base font-bold text-foreground">
                    {counts?.pending ?? 0}
                  </span>{' '}
                  <span className="text-muted-foreground">{t('kpi.pending')}</span>
                </span>
                <span>
                  <span className="text-base font-bold text-destructive">
                    {counts?.overdue ?? 0}
                  </span>{' '}
                  <span className="text-muted-foreground">{t('kpi.overdue')}</span>
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
