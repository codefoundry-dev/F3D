import { useDashboardData } from '../../hooks/vendor/useDashboardData';
import { ActivePosTable } from '../../ui/vendor/active-pos';
import { InvoicesSection } from '../../ui/vendor/InvoicesSection';
import { RfqsWaitingSection } from '../../ui/vendor/RfqsWaitingSection';

export default function DashboardPage() {
  const { rfqsWaiting, invoices, activePOs, isLoading } = useDashboardData();

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RfqsWaitingSection items={rfqsWaiting} isLoading={isLoading} />
        <InvoicesSection items={invoices} isLoading={isLoading} />
      </div>

      <ActivePosTable items={activePOs} isLoading={isLoading} />
    </div>
  );
}
