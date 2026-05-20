import { useTranslation } from '@forethread/i18n';
import { formatCurrency } from '@forethread/ui-components';
import ClockIcon from '@forethread/ui-components/assets/icons/clock-icon.svg?react';
import FileLockIcon from '@forethread/ui-components/assets/icons/file-lock.svg?react';
import TrendUpIcon from '@forethread/ui-components/assets/icons/trend-up.svg?react';
import UsersIcon from '@forethread/ui-components/assets/icons/users-group.svg?react';

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
      <div className="bg-white rounded-[14px] border border-black/20 px-4 py-3 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-black/10 flex items-center justify-center shrink-0">
          <ClockIcon className="w-6 h-6 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#525252]">{t('finance.totalPendingAmount')}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-normal text-foreground">
              {formatCurrency(totalPendingAmount)}
            </span>
            <span className="text-xs text-[#717182]">
              {t('finance.invoiceCount', { count: pendingInvoiceCount })}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[14px] border border-black/20 px-4 py-3 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-black/10 flex items-center justify-center shrink-0">
          <UsersIcon className="w-6 h-6 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#525252]">{t('finance.invoicesDueThisWeek')}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-2xl font-normal text-foreground">{invoicesDueThisWeek}</span>
            <span className="text-xs text-[#717182]">
              Total amount: {formatCurrency(invoicesDueAmount)}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[14px] border border-black/20 px-4 py-3 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-black/10 flex items-center justify-center shrink-0">
          <FileLockIcon className="w-6 h-6 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#525252]">{t('finance.disputedInvoices')}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[28px] font-normal text-foreground">{disputedInvoiceCount}</span>
            {disputedTrend !== 0 && (
              <div className="flex items-center gap-2">
                <TrendUpIcon className="w-4 h-4 text-[#717182]" />
                <span className="text-xs text-[#717182]">
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
