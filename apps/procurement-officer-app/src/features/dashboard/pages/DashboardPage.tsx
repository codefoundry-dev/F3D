import { useDashboardData } from '../hooks/useDashboardData';
import { InvoicesPendingApproval } from '../ui/InvoicesPendingApproval';
import { KpiSummaryCards } from '../ui/KpiSummaryCards';
import { PendingPurchaseOrders } from '../ui/PendingPurchaseOrders';
import { QuickActions } from '../ui/QuickActions';
import { QuoteResponsesSection } from '../ui/QuoteResponsesSection';
import { RecentOrdersSection } from '../ui/RecentOrdersSection';

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
      {/* KPI Summary Cards */}
      <KpiSummaryCards data={kpiSummary} isLoading={isLoading} />

      {/* Quick Actions */}
      <QuickActions />

      {/* Middle row: QuoteResponses | RecentOrders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <QuoteResponsesSection items={quoteResponses} isLoading={isLoading} />
        <RecentOrdersSection items={recentOrders} isLoading={isLoading} />
      </div>

      {/* Bottom row: PendingPurchaseOrders | InvoicesPendingApproval */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PendingPurchaseOrders items={pendingPurchaseOrders} isLoading={isLoading} />
        <InvoicesPendingApproval items={invoicesPendingApproval} isLoading={isLoading} />
      </div>
    </div>
  );
}
