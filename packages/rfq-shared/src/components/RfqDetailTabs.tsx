import { useTranslation } from '@forethread/i18n';
import { Tabs, type TabItem } from '@forethread/ui-components';

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

  const items: TabItem<RfqTab>[] = tabs.map((tab) => ({
    value: tab,
    label: t(`tabs.${tab}` as never),
  }));

  return <Tabs items={items} value={activeTab} onValueChange={onTabChange} rightSlot={rightSlot} />;
}
