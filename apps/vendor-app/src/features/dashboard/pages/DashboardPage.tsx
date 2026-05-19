import { useDashboardData } from '../hooks/useDashboardData';
import { ActivePosTable } from '../ui/active-pos';
import { InvoicesSection } from '../ui/InvoicesSection';
import { RfqsWaitingSection } from '../ui/RfqsWaitingSection';

export default function DashboardPage() {
  const { rfqsWaiting, invoices, activePOs, isLoading } = useDashboardData();

  return (
    <div className="p-4 space-y-6">
      {/* Top row: RFQs waiting + Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RfqsWaitingSection items={rfqsWaiting} isLoading={isLoading} />
        <InvoicesSection items={invoices} isLoading={isLoading} />
      </div>

      {/* Full-width: Active POs table */}
      <ActivePosTable items={activePOs} isLoading={isLoading} />
    </div>
  );
}
