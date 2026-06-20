import { useTranslation } from '@forethread/i18n';
import { Tabs, type TabItem } from '@forethread/ui-components';

export type PoTab =
  | 'details'
  | 'changeRequest'
  | 'lineItems'
  | 'documents'
  | 'messages'
  | 'emailLog'
  | 'actionLog';

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

  const items: TabItem<PoTab>[] = tabList.map((tab) => ({
    value: tab,
    label: t(`tabs.${tab}` as never),
  }));

  return (
    <Tabs
      items={items}
      value={activeTab}
      onValueChange={onTabChange}
      rightSlot={rightSlot}
      size={compact ? 'sm' : 'md'}
    />
  );
}
