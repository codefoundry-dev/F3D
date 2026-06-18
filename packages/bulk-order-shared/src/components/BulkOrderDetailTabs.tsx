import { useTranslation } from '@forethread/i18n';
import { cn } from '@forethread/ui-components';

export type BulkOrderTab = 'lineItems' | 'drawdownHistory' | 'changeHistory';

interface BulkOrderDetailTabsProps {
  activeTab: BulkOrderTab;
  onTabChange: (tab: BulkOrderTab) => void;
}

// The detail view exposes only Line items + Drawdown History (Figma US 2.11).
// Change history lives on the list page (AllChangeHistorySection).
const TABS: BulkOrderTab[] = ['lineItems', 'drawdownHistory'];

export function BulkOrderDetailTabs({ activeTab, onTabChange }: BulkOrderDetailTabsProps) {
  const { t } = useTranslation('bulkOrders');

  return (
    <div className="flex items-center border-b border-foreground/10">
      <nav className="flex gap-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={cn(
              'px-3 py-3 text-base font-medium border-b-2 transition-colors',
              activeTab === tab
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`tabs.${tab}` as never) as string}
          </button>
        ))}
      </nav>
    </div>
  );
}
