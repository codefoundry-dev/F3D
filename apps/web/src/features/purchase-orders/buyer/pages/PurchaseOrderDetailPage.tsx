import { exportPurchaseOrders } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  usePurchaseOrder,
  PoDetailTabs,
  PoDetailsTab,
  PoLineItemsTab,
  PoDocumentsTab,
  PoMessagesTab,
} from '@forethread/po-shared';
import type { PoTab } from '@forethread/po-shared';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { Button, Spinner } from '@forethread/ui-components';
import DownloadIcon from '@forethread/ui-components/assets/icons/download.svg?react';
import { useCallback, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { PoSendButton } from '../components/PoSendButton';

export default function PurchaseOrderDetailPage() {
  const { t } = useTranslation('purchaseOrders');
  const { id } = useParams<{ id: string }>();
  const { data: po, isLoading, isError } = usePurchaseOrder(id ?? '');
  const setPageTitle = usePageTitleStore((s) => s.setTitle);

  useEffect(() => {
    if (po) setPageTitle(po.projectName);
    return () => setPageTitle(null);
  }, [po, setPageTitle]);

  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs: PoTab[] = ['details', 'lineItems', 'documents', 'messages'];
  const tabParam = searchParams.get('tab') as PoTab | null;
  const activeTab: PoTab = tabParam && validTabs.includes(tabParam) ? tabParam : 'details';

  const setActiveTab = useCallback(
    (tab: PoTab) => setSearchParams({ tab }, { replace: true }),
    [setSearchParams],
  );

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

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="px-4 md:px-8 pt-4 md:pt-6 pb-3 md:pb-4">
        <PoDetailTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          rightSlot={
            activeTab === 'details' ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<DownloadIcon className="w-4 h-4" />}
                  onClick={() => {
                    void exportPurchaseOrders('pdf', { search: po.id }).then(({ url }) =>
                      window.open(url, '_blank'),
                    );
                  }}
                >
                  {t('actions.exportAs')}
                </Button>
                <PoSendButton po={po} size="sm" />
              </div>
            ) : undefined
          }
        />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-6 md:pb-8">
        {activeTab === 'details' && <PoDetailsTab po={po} layout="page" />}
        {activeTab === 'lineItems' && (
          <PoLineItemsTab poId={po.id} lineItems={po.lineItems ?? []} layout="page" />
        )}
        {activeTab === 'documents' && (
          <PoDocumentsTab poId={po.id} documents={po.documents ?? []} hideUpload />
        )}
        {activeTab === 'messages' && <PoMessagesTab />}
      </div>
    </div>
  );
}
