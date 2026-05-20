import { useDashboardData } from '../../hooks/buyer/useDashboardData';
import { InvoicesPendingApproval } from '../../ui/buyer/InvoicesPendingApproval';
import { KpiSummaryCards } from '../../ui/buyer/KpiSummaryCards';
import { PendingPurchaseOrders } from '../../ui/buyer/PendingPurchaseOrders';
import { QuickActions } from '../../ui/buyer/QuickActions';
import { QuoteResponsesSection } from '../../ui/buyer/QuoteResponsesSection';
import { RecentOrdersSection } from '../../ui/buyer/RecentOrdersSection';

export default function DashboardPage() {
  const {
    kpiSummary,
    quoteResponses,
    recentOrders,
    pendingPurchaseOrders,
    invoicesPendingApproval,
    isLoading,
  } = useDashboardData();

  return (
    <div className="p-4 space-y-4 overflow-auto">
      <KpiSummaryCards data={kpiSummary} isLoading={isLoading} />
      <QuickActions />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <QuoteResponsesSection items={quoteResponses} isLoading={isLoading} />
        <RecentOrdersSection items={recentOrders} isLoading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PendingPurchaseOrders items={pendingPurchaseOrders} isLoading={isLoading} />
        <InvoicesPendingApproval items={invoicesPendingApproval} isLoading={isLoading} />
      </div>
    </div>
  );
}
