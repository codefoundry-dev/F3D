import { useTranslation } from '@forethread/i18n';
import { Button } from '@forethread/ui-components';
import UploadIcon from '@forethread/ui-components/assets/icons/upload.svg?react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { useDashboardData } from '../hooks/useDashboardData';
import { DisputedInvoicesSection } from '../ui/DisputedInvoicesSection';
import { InvoiceKpiCards } from '../ui/InvoiceKpiCards';
import { InvoicesPendingSection } from '../ui/InvoicesPendingSection';

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
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

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      {/* Upload Invoice button */}
      <div className="flex items-center">
        <Button
          variant="primary"
          size="lg"
          leftIcon={<UploadIcon className="w-6 h-6" />}
          onClick={() => navigate(ROUTES.invoices)}
        >
          {t('finance.uploadInvoice')}
        </Button>
      </div>

      {/* KPI Cards */}
      <InvoiceKpiCards
        totalPendingAmount={totalPendingAmount}
        pendingInvoiceCount={pendingInvoiceCount}
        invoicesDueThisWeek={invoicesDueThisWeek}
        invoicesDueAmount={invoicesDueAmount}
        disputedInvoiceCount={disputedInvoiceCount}
        disputedTrend={disputedTrend}
        isLoading={isLoading}
      />

      {/* 2-column: Pending + Disputed */}
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
