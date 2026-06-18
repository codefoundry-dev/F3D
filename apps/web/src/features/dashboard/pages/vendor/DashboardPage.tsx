import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { useEffect } from 'react';

import { useDashboardData } from '../../hooks/vendor/useDashboardData';
import { ActivePosTable } from '../../ui/vendor/active-pos';
import { InvoicesSection } from '../../ui/vendor/InvoicesSection';
import { RfqsWaitingSection } from '../../ui/vendor/RfqsWaitingSection';

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  const { rfqsWaiting, invoices, activePOs, isLoading } = useDashboardData();

  // Vendor lands on `/`, so this dashboard owns the global header copy.
  useEffect(() => {
    setPageTitle(t('title'), t('subtitle'));
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RfqsWaitingSection items={rfqsWaiting} isLoading={isLoading} />
        <InvoicesSection items={invoices} isLoading={isLoading} />
      </div>

      <ActivePosTable items={activePOs} isLoading={isLoading} />
    </div>
  );
}
