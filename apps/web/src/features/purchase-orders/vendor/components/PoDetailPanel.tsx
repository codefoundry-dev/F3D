import { exportPurchaseOrders } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  usePurchaseOrder,
  PoDetailTabs,
  PoDetailsTab,
  PoLineItemsTab,
  PoDocumentsTab,
  PoMessagesTab,
  PoActionLogTab,
} from '@forethread/po-shared';
import type { PoTab, RelatedDocument } from '@forethread/po-shared';
import { Badge, cn, NEUTRAL_STATUS_COLOR, Spinner } from '@forethread/ui-components';
import ArrowLineRightIcon from '@forethread/ui-components/assets/icons/arrow-line-right.svg?react';
import ArrowsOutSimpleIcon from '@forethread/ui-components/assets/icons/arrows-out-simple.svg?react';
import DownloadIcon from '@forethread/ui-components/assets/icons/download.svg?react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';
import { useAuthStore } from '@/features/auth/state/auth.store';
import { usePermissions } from '@/shared/role/usePermissions';

import { PoVendorActions } from './PoVendorActions';

interface PoDetailPanelProps {
  poId: string;
  onClose: () => void;
}

const PANEL_TABS: PoTab[] = ['details', 'lineItems', 'messages', 'documents', 'actionLog'];

export function PoDetailPanel({ poId, onClose }: PoDetailPanelProps) {
  const { t } = useTranslation('purchaseOrders');
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const { has } = usePermissions();
  const { data: po, isLoading, isError } = usePurchaseOrder(poId);
  const [activeTab, setActiveTab] = useState<PoTab>('details');

  const relatedDocuments = useMemo((): RelatedDocument[] => {
    if (!po) return [];
    const docs: RelatedDocument[] = [];
    if (po.rfqId) {
      docs.push({ id: `rfq-${po.rfqId}`, label: String(po.rfqId), url: `/rfqs/${po.rfqId}` });
    }
    for (const inv of (po.invoices ?? []) as Array<{
      id: string;
      status: string;
      totalAmount: number;
    }>) {
      docs.push({ id: `inv-${inv.id}`, label: String(inv.id), url: `/invoices/${inv.id}` });
    }
    return docs;
  }, [po]);

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

  const handleFullscreen = () => {
    onClose();
    navigate(ROUTES.purchaseOrderDetail.replace(':id', poId));
  };

  const iconBtnClass =
    'flex items-center justify-center h-9 px-3.5 rounded-xl border border-foreground/20 text-foreground hover:bg-accent transition-colors';

  return (
    <div
      className={cn(
        'w-[480px] min-h-[508px] max-h-[508px] shrink-0 flex flex-col gap-4.5',
        'bg-card border border-foreground/20',
        'rounded-[14px] shadow-lg overflow-hidden p-4',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onClose}
            className={iconBtnClass}
            title={t('actions.collapse')}
          >
            <ArrowLineRightIcon className="w-[18px] h-[18px]" />
          </button>
          <button
            type="button"
            onClick={handleFullscreen}
            className={iconBtnClass}
            title={t('actions.fullscreen')}
          >
            <ArrowsOutSimpleIcon className="w-[18px] h-[18px]" />
          </button>
        </div>
        {activeTab === 'details' && (
          <button
            type="button"
            className={iconBtnClass}
            title={t('actions.download')}
            onClick={() => {
              void exportPurchaseOrders('pdf', { search: poId }).then(({ url }) =>
                window.open(url, '_blank'),
              );
            }}
          >
            <DownloadIcon className="w-[18px] h-[18px]" />
          </button>
        )}
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {isError && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-destructive">{t('detail.failedToLoad')}</p>
        </div>
      )}

      {po && (
        <>
          {/* Title row */}
          <div className="flex items-center gap-4.5 shrink-0">
            <h2 className="flex-1 text-lg font-medium text-foreground">{po.poNumber}</h2>
            <Badge className={NEUTRAL_STATUS_COLOR}>
              {t([`vendorStatus.${po.status}`, `status.${po.status}`] as never)}
            </Badge>
          </div>

          {/* Vendor action banner + buttons */}
          <PoVendorActions po={po} compact />

          {/* Tabs + scrollable content */}
          <div className="flex flex-col flex-1 min-h-0 mt-4">
            <div className="shrink-0">
              <PoDetailTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                tabs={PANEL_TABS}
                compact
              />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto mt-2">
              {activeTab === 'details' && <PoDetailsTab po={po} layout="panel" isVendorView />}
              {activeTab === 'lineItems' && (
                <PoLineItemsTab lineItems={po.lineItems ?? []} layout="panel" />
              )}
              {activeTab === 'documents' && (
                <PoDocumentsTab
                  poId={po.id}
                  documents={po.documents ?? []}
                  hideUpload={!has('po.uploadDocument')}
                  relatedDocuments={relatedDocuments}
                />
              )}
              {activeTab === 'messages' && (
                <PoMessagesTab
                  poId={po.id}
                  poStatus={po.status}
                  currentUserId={currentUser?.id}
                  creatorUserId={po.createdBy.id}
                  height="h-[340px]"
                />
              )}
              {activeTab === 'actionLog' && <PoActionLogTab logs={actionLogs} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
