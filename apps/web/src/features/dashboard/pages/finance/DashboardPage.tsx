import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import UploadIcon from '@forethread/ui-components/assets/icons/upload.svg?react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { useDashboardData } from '../../hooks/finance/useDashboardData';
import { DisputedInvoicesSection } from '../../ui/finance/DisputedInvoicesSection';
import { InvoiceKpiCards } from '../../ui/finance/InvoiceKpiCards';
import { InvoicesPendingSection } from '../../ui/finance/InvoicesPendingSection';

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  const {
    totalPendingAmount,
    pendingInvoiceCount,
    invoicesDueThisWeek,
    invoicesDueAmount,
    disputedInvoiceCount,
    disputedTrend,
    invoicesPendingApproval,
    disputedInvoices,
    isLoading,
  } = useDashboardData();

  // Finance lands on `/`, so this dashboard owns the global header copy.
  useEffect(() => {
    setPageTitle(t('title'), t('subtitle'));
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <div className="flex items-center">
        {/* Dark pill matches the Figma #1B1D22 and the super-admin quick-action
            pills; hardcoded so it stays dark in dark mode (--foreground flips). */}
        <button
          type="button"
          onClick={() => navigate(ROUTES.invoices)}
          className="flex items-center gap-2.5 rounded-xl bg-[#1B1D22] px-6 py-4 text-lg font-medium text-white transition-colors hover:bg-[#1B1D22]/90"
        >
          <UploadIcon className="w-6 h-6" />
          {t('finance.uploadInvoice')}
        </button>
      </div>

      <InvoiceKpiCards
        totalPendingAmount={totalPendingAmount}
        pendingInvoiceCount={pendingInvoiceCount}
        invoicesDueThisWeek={invoicesDueThisWeek}
        invoicesDueAmount={invoicesDueAmount}
        disputedInvoiceCount={disputedInvoiceCount}
        disputedTrend={disputedTrend}
        isLoading={isLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 flex-1">
        <InvoicesPendingSection
          items={invoicesPendingApproval}
          isLoading={isLoading}
          className="max-h-[620px]"
        />
        <DisputedInvoicesSection
          items={disputedInvoices}
          isLoading={isLoading}
          className="max-h-[620px]"
        />
      </div>
    </div>
  );
}
