import { useTranslation } from '@forethread/i18n';
import { Tabs, type TabItem } from '@forethread/ui-components';

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

  const items: TabItem<BulkOrderTab>[] = TABS.map((tab) => ({
    value: tab,
    label: t(`tabs.${tab}` as never) as string,
  }));

  return <Tabs items={items} value={activeTab} onValueChange={onTabChange} />;
}
