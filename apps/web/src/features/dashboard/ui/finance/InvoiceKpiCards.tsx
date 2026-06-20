import { useTranslation } from '@forethread/i18n';
import { formatCurrency } from '@forethread/ui-components';
import ClockIcon from '@forethread/ui-components/assets/icons/clock-icon.svg?react';
import FileLockIcon from '@forethread/ui-components/assets/icons/file-lock.svg?react';
import TrendUpIcon from '@forethread/ui-components/assets/icons/trend-up.svg?react';
import UsersIcon from '@forethread/ui-components/assets/icons/users-group.svg?react';

// Figma: card px-[16.8px] py-[12.8px], 0.8px border rgba(0,0,0,0.2); icon box
// 48px rounded-[12px] bg rgba(3,2,19,0.1) ≈ --foreground/10 (matches the
// super-admin KPI cards); value 24px/32px, subtext 12px #717182.
const CARD_CLASS =
  'bg-white rounded-[14px] border-[0.8px] border-black/20 px-[16.8px] py-[12.8px] flex items-center gap-4';
const ICON_BOX_CLASS =
  'w-12 h-12 rounded-xl bg-foreground/10 flex items-center justify-center shrink-0';
const LABEL_CLASS = 'text-sm font-medium leading-5 text-[#525866]';
const VALUE_CLASS = 'text-2xl font-normal leading-8 text-foreground';
const SUBTEXT_CLASS = 'text-xs text-[#717182]';

interface InvoiceKpiCardsProps {
  totalPendingAmount: number;
  pendingInvoiceCount: number;
  invoicesDueThisWeek: number;
  invoicesDueAmount: number;
  disputedInvoiceCount: number;
  disputedTrend: number;
  isLoading?: boolean;
}

export function InvoiceKpiCards({
  totalPendingAmount,
  pendingInvoiceCount,
  invoicesDueThisWeek,
  invoicesDueAmount,
  disputedInvoiceCount,
  disputedTrend,
  isLoading,
}: InvoiceKpiCardsProps) {
  const { t } = useTranslation('dashboard');

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-[86px] animate-pulse rounded-[14px] bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <div className={CARD_CLASS}>
        <div className={ICON_BOX_CLASS}>
          <ClockIcon className="w-6 h-6 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={LABEL_CLASS}>{t('finance.totalPendingAmount')}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={VALUE_CLASS}>{formatCurrency(totalPendingAmount)}</span>
            <span className={SUBTEXT_CLASS}>
              {t('finance.invoiceCount', { count: pendingInvoiceCount })}
            </span>
          </div>
        </div>
      </div>

      <div className={CARD_CLASS}>
        <div className={ICON_BOX_CLASS}>
          <UsersIcon className="w-6 h-6 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={LABEL_CLASS}>{t('finance.invoicesDueThisWeek')}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={VALUE_CLASS}>{invoicesDueThisWeek}</span>
            <span className={SUBTEXT_CLASS}>Total amount: {formatCurrency(invoicesDueAmount)}</span>
          </div>
        </div>
      </div>

      <div className={CARD_CLASS}>
        <div className={ICON_BOX_CLASS}>
          <FileLockIcon className="w-6 h-6 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={LABEL_CLASS}>{t('finance.disputedInvoices')}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={VALUE_CLASS}>{disputedInvoiceCount}</span>
            {disputedTrend !== 0 && (
              <div className="flex items-center gap-1.5">
                <TrendUpIcon className="w-4 h-4 text-[#717182]" />
                <span className={SUBTEXT_CLASS}>
                  {disputedTrend > 0 ? `+${disputedTrend}` : String(disputedTrend)} this week
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
