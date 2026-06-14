import { exportPurchaseOrders } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  usePurchaseOrder,
  usePoChangeRequests,
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
import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useAuthStore } from '@/features/auth/state/auth.store';
import { usePermissions } from '@/shared/role/usePermissions';

import { PoSendButton } from '../components/PoSendButton';
import { useProjectDetail } from '../services/purchase-orders.service';

/** Statuses for which the backend accepts a change proposal (po-change.service). */
const CHANGEABLE_STATUSES = ['SENT', 'ACKNOWLEDGED', 'ACCEPTED'];

export default function PurchaseOrderDetailPage() {
  const { t } = useTranslation('purchaseOrders');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: po, isLoading, isError } = usePurchaseOrder(id ?? '');
  const { data: changeRequests, isLoading: isLoadingCrs } = usePoChangeRequests(id ?? '');
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

  // Generic audit timeline (placeholder — no PO-scoped audit feed in api-client).
  // Resolved change requests are layered in via the `changeRequests` prop.
  const actionLogs = useMemo(() => {
    if (!po) return [];
    const logs = [];
    if (po.createdAt) {
      logs.push({
        id: 'created',
        action: 'Purchase Order Created',
        description: `Created by ${po.createdBy.name}`,
        performedBy: po.createdBy,
        createdAt: po.createdAt,
      });
    }
    if (po.issuedAt) {
      logs.push({
        id: 'issued',
        action: 'Purchase Order Issued',
        description: `Issued to ${po.vendor?.name ?? 'vendor'}`,
        performedBy: po.createdBy,
        createdAt: po.issuedAt,
      });
    }
    return logs;
  }, [po]);

  const canChange = po ? CHANGEABLE_STATUSES.includes(po.status) && has('po.proposeChange') : false;

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
            changeRequests={changeRequests ?? []}
            locationOptions={locationOptions}
          />
        )}
      </div>
    </div>
  );
}
