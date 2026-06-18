import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { useEffect } from 'react';

import { usePermissions } from '@/shared/role/usePermissions';

import { useAwaitingApproval } from '../../hooks/buyer/useAwaitingApproval';
import { useDashboardData } from '../../hooks/buyer/useDashboardData';
import { InvoicesPendingApproval } from '../../ui/buyer/InvoicesPendingApproval';
import { KpiSummaryCards } from '../../ui/buyer/KpiSummaryCards';
import { PendingPurchaseOrders } from '../../ui/buyer/PendingPurchaseOrders';
import { QuickActions } from '../../ui/buyer/QuickActions';
import { QuoteResponsesSection } from '../../ui/buyer/QuoteResponsesSection';
import { RecentOrdersSection } from '../../ui/buyer/RecentOrdersSection';

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  const {
    kpiSummary,
    quoteResponses,
    recentOrders,
    pendingPurchaseOrders,
    invoicesPendingApproval,
    isLoading,
  } = useDashboardData();
  const { has } = usePermissions();
  const canApprove = has('po.approve');
  // Entitled PENDING_APPROVAL queue (threshold-scoped server-side). The frame has
  // no standalone "Awaiting approval" section — these are folded into the
  // Purchase orders section below so the approver capability is preserved.
  const { items: awaitingApproval, isLoading: isLoadingApproval } = useAwaitingApproval(canApprove);

  // Buyer (PO/CA) lands on `/`, so this dashboard owns the global header copy.
  useEffect(() => {
    setPageTitle(t('title'), t('subtitle'));
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  return (
    <div className="p-4 space-y-4 overflow-auto">
      <KpiSummaryCards data={kpiSummary} isLoading={isLoading} />
      <QuickActions />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <QuoteResponsesSection
          items={quoteResponses}
          isLoading={isLoading}
          canApprove={canApprove}
        />
        <RecentOrdersSection items={recentOrders} isLoading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PendingPurchaseOrders
          items={pendingPurchaseOrders}
          isLoading={isLoading}
          canApprove={canApprove}
          approvalItems={awaitingApproval}
          isLoadingApproval={isLoadingApproval}
        />
        <InvoicesPendingApproval items={invoicesPendingApproval} isLoading={isLoading} />
      </div>
    </div>
  );
}
