import { useTranslation } from '@forethread/i18n';
import { cn } from '@forethread/ui-components';

export type PoTab = 'details' | 'lineItems' | 'documents' | 'messages' | 'actionLog';

interface PoDetailTabsProps {
  activeTab: PoTab;
  onTabChange: (tab: PoTab) => void;
  rightSlot?: React.ReactNode;
  tabs?: PoTab[];
  /** Compact mode for slide-over panels — smaller padding so all tabs fit */
  compact?: boolean;
}

const TABS: PoTab[] = ['details', 'lineItems', 'messages', 'documents'];

export function PoDetailTabs({
  activeTab,
  onTabChange,
  rightSlot,
  tabs,
  compact,
}: PoDetailTabsProps) {
  const { t } = useTranslation('purchaseOrders');
  const tabList = tabs ?? TABS;

  return (
    <div className="flex flex-wrap items-center justify-between gap-y-2 border-b border-foreground/10 overflow-x-auto overflow-y-hidden scrollbar-none">
      <nav className="flex gap-0 shrink-0">
        {tabList.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={cn(
              compact
                ? 'px-2 pb-2 pt-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap'
                : 'px-4 pb-2.5 pt-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t(`tabs.${tab}` as never)}
          </button>
        ))}
      </nav>
      {rightSlot && <div className="pb-2 shrink-0">{rightSlot}</div>}
    </div>
  );
}
