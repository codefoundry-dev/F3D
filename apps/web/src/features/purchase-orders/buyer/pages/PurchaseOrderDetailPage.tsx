import { exportPurchaseOrders } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  usePurchaseOrder,
  usePoChangeRequests,
  usePoActionLog,
  PoDetailTabs,
  PoDetailsTab,
  PoLineItemsTab,
  PoDocumentsTab,
  PoEmailLogTab,
  PoMessagesTab,
  PoActionLogTab,
  PoChangeRequestTab,
  PoChangeRequestTabLoading,
} from '@forethread/po-shared';
import type { PoTab } from '@forethread/po-shared';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { Button, Spinner } from '@forethread/ui-components';
import DownloadIcon from '@forethread/ui-components/assets/icons/download.svg?react';
import EditWithoutLineIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useAuthStore } from '@/features/auth/state/auth.store';
import { usePermissions } from '@/shared/role/usePermissions';

import { PoSendButton } from '../components/PoSendButton';
import { ReceiveDeliveryModal } from '../components/ReceiveDeliveryModal';
import { useProjectDetail } from '../services/purchase-orders.service';

/** Statuses for which the backend accepts a change proposal (po-change.service). */
const CHANGEABLE_STATUSES = ['SENT', 'ACKNOWLEDGED', 'ACCEPTED'];

/**
 * Statuses that can legally advance to PARTIALLY_DELIVERED / DELIVERED — i.e. a
 * delivery can be recorded against the PO (Week-3 delivery leg).
 */
const RECEIVABLE_STATUSES = [
  'ACKNOWLEDGED',
  'ACCEPTED',
  'SCHEDULED_FOR_DELIVERY',
  'PARTIALLY_DELIVERED',
  'LATE_FOR_DELIVERY',
];

export default function PurchaseOrderDetailPage() {
  const { t } = useTranslation('purchaseOrders');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: po, isLoading, isError } = usePurchaseOrder(id ?? '');
  const { data: changeRequests, isLoading: isLoadingCrs } = usePoChangeRequests(id ?? '');
  const { logs: actionLogs, isLoading: isLoadingLog } = usePoActionLog(po?.id ?? id ?? '');
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  const currentUser = useAuthStore((s) => s.currentUser);
  const { has } = usePermissions();

  // Project locations resolve deliveryLocationId → address in the change diff.
  const { data: projectDetail } = useProjectDetail(po?.projectId ?? '');
  const locationOptions = useMemo(
    () =>
      (projectDetail?.locations ?? []).map((loc) => ({
        value: loc.id,
        label: loc.label ?? loc.address,
      })),
    [projectDetail],
  );

  useEffect(() => {
    if (po) setPageTitle(po.projectName);
    return () => setPageTitle(null);
  }, [po, setPageTitle]);

  const pendingCr = useMemo(
    () => changeRequests?.find((cr) => cr.status === 'PENDING'),
    [changeRequests],
  );

  // The "Changes request" tab only appears while a pending CR exists.
  const validTabs: PoTab[] = useMemo(() => {
    const tabs: PoTab[] = ['details'];
    if (pendingCr) tabs.push('changeRequest');
    tabs.push('lineItems', 'documents', 'emailLog', 'messages', 'actionLog');
    return tabs;
  }, [pendingCr]);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as PoTab | null;
  const activeTab: PoTab = tabParam && validTabs.includes(tabParam) ? tabParam : 'details';

  const setActiveTab = useCallback(
    (tab: PoTab) => setSearchParams({ tab }, { replace: true }),
    [setSearchParams],
  );

  const canChange = po ? CHANGEABLE_STATUSES.includes(po.status) && has('po.proposeChange') : false;
  const canReceive = po ? RECEIVABLE_STATUSES.includes(po.status) && has('po.receive') : false;

  const [showReceiveModal, setShowReceiveModal] = useState(false);

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
          tabs={validTabs}
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
                {canChange && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<EditWithoutLineIcon className="w-4 h-4" />}
                    onClick={() => navigate(ROUTES.purchaseOrderChange.replace(':id', po.id))}
                  >
                    {t('actions.change')}
                  </Button>
                )}
                {canReceive && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<PackageIcon className="w-4 h-4" />}
                    onClick={() => setShowReceiveModal(true)}
                  >
                    {t('actions.recordDelivery', 'Record delivery')}
                  </Button>
                )}
                <PoSendButton po={po} size="sm" />
              </div>
            ) : undefined
          }
        />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-6 md:pb-8">
        {activeTab === 'details' && <PoDetailsTab po={po} layout="page" />}
        {activeTab === 'changeRequest' &&
          (isLoadingCrs ? (
            <PoChangeRequestTabLoading />
          ) : pendingCr ? (
            <PoChangeRequestTab
              poId={po.id}
              changeRequest={pendingCr}
              locationOptions={locationOptions}
              currentUserName={currentUser?.name}
            />
          ) : null)}
        {activeTab === 'lineItems' && (
          <PoLineItemsTab poId={po.id} lineItems={po.lineItems ?? []} layout="page" />
        )}
        {activeTab === 'documents' && (
          <PoDocumentsTab poId={po.id} documents={po.documents ?? []} hideUpload />
        )}
        {activeTab === 'emailLog' && <PoEmailLogTab poId={po.id} />}
        {activeTab === 'messages' && <PoMessagesTab />}
        {activeTab === 'actionLog' && (
          <PoActionLogTab
            logs={actionLogs}
            isLoading={isLoadingLog}
            changeRequests={changeRequests ?? []}
            locationOptions={locationOptions}
          />
        )}
      </div>

      {showReceiveModal && (
        <ReceiveDeliveryModal po={po} onClose={() => setShowReceiveModal(false)} />
      )}
    </div>
  );
}
