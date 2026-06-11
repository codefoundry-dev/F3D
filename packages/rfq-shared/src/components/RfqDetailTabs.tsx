import { useTranslation } from '@forethread/i18n';
import { cn } from '@forethread/ui-components';

export type RfqTab = 'details' | 'lineItems' | 'responses' | 'documents' | 'emailLog' | 'audit';

interface RfqDetailTabsProps {
  activeTab: RfqTab;
  onTabChange: (tab: RfqTab) => void;
  rightSlot?: React.ReactNode;
  /** Which tabs to show, in order. Defaults to the four core tabs (no audit). */
  tabs?: RfqTab[];
}

const DEFAULT_TABS: RfqTab[] = ['details', 'lineItems', 'responses', 'documents'];

export function RfqDetailTabs({
  activeTab,
  onTabChange,
  rightSlot,
  tabs = DEFAULT_TABS,
}: RfqDetailTabsProps) {
  const { t } = useTranslation('rfqs');

  return (
    <div className="flex items-center justify-between border-b border-foreground/10">
      <nav className="flex gap-0">
        {tabs.map((tab) => (
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
