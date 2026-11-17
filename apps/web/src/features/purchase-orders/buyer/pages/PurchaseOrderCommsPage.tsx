import { useTranslation } from '@forethread/i18n';
import { usePurchaseOrder, PoCommsPage } from '@forethread/po-shared';
import type { PoCommsTab } from '@forethread/po-shared';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { Spinner } from '@forethread/ui-components';
import { useCallback, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

export default function PurchaseOrderCommsPage() {
  const { t } = useTranslation('purchaseOrders');
  const { id } = useParams<{ id: string }>();
  const { data: po, isLoading, isError } = usePurchaseOrder(id ?? '');
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  const [searchParams, setSearchParams] = useSearchParams();

  const validTabs: PoCommsTab[] = ['messages', 'lineItems', 'attachments'];
  const tabParam = searchParams.get('tab') as PoCommsTab | null;
  const initialTab: PoCommsTab = tabParam && validTabs.includes(tabParam) ? tabParam : 'messages';

  const handleTabChange = useCallback(
    (tab: PoCommsTab) => setSearchParams({ tab }, { replace: true }),
    [setSearchParams],
  );

  // App-bar breadcrumb: PO Management › <PO number> › Messages.
  useEffect(() => {
    if (po) {
      setPageTitle(po.poNumber, null, null, [
        { label: t('list.title'), to: ROUTES.purchaseOrders },
        { label: po.poNumber, to: ROUTES.purchaseOrderDetail.replace(':id', po.id) },
        { label: t('comms.messages') },
      ]);
    }
    return () => setPageTitle(null);
  }, [po, setPageTitle, t]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !po) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">{t('detail.noData')}</div>
    );
  }

  return <PoCommsPage po={po} initialTab={initialTab} onTabChange={handleTabChange} />;
}
