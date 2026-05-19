import { useTranslation } from '@forethread/i18n';
import { cn } from '@forethread/ui-components';

export type RfqTab = 'details' | 'lineItems' | 'responses' | 'documents';

interface RfqDetailTabsProps {
  activeTab: RfqTab;
  onTabChange: (tab: RfqTab) => void;
  rightSlot?: React.ReactNode;
}

const TABS: RfqTab[] = ['details', 'lineItems', 'responses', 'documents'];

export function RfqDetailTabs({ activeTab, onTabChange, rightSlot }: RfqDetailTabsProps) {
  const { t } = useTranslation('rfqs');

  return (
    <div className="flex items-center justify-between border-b border-foreground/10">
      <nav className="flex gap-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={cn(
              'px-4 pb-2.5 pt-1 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`tabs.${tab}` as never)}
          </button>
        ))}
      </nav>
      {rightSlot && <div className="pb-2">{rightSlot}</div>}
    </div>
  );
}
