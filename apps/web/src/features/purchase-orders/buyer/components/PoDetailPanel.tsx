import { exportPurchaseOrders } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  usePurchaseOrder,
  PoDetailTabs,
  PoDetailsTab,
  PoLineItemsTab,
  PoDocumentsTab,
} from '@forethread/po-shared';
import type { PoTab } from '@forethread/po-shared';
import { Badge, cn, getStatusColor, PO_STATUS_COLORS, Spinner } from '@forethread/ui-components';
import ArrowLineRightIcon from '@forethread/ui-components/assets/icons/arrow-line-right.svg?react';
import ArrowsOutSimpleIcon from '@forethread/ui-components/assets/icons/arrows-out-simple.svg?react';
import DownloadIcon from '@forethread/ui-components/assets/icons/download.svg?react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { buyerPoStatusKey } from '../status-label';

import { PoSendButton } from './PoSendButton';

interface PoDetailPanelProps {
  poId: string;
  onClose: () => void;
}

export function PoDetailPanel({ poId, onClose }: PoDetailPanelProps) {
  const { t } = useTranslation('purchaseOrders');
  const navigate = useNavigate();
  const { data: po, isLoading, isError } = usePurchaseOrder(poId);
  const [activeTab, setActiveTab] = useState<PoTab>('details');

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
            <h2 className="flex-1 text-lg font-medium text-foreground">{po.projectName}</h2>
            <PoSendButton po={po} size="sm" />
            <Badge className={getStatusColor(PO_STATUS_COLORS, po.status)}>
              {t(buyerPoStatusKey(po.status) as never)}
            </Badge>
          </div>

          {/* Tabs + scrollable content */}
          <div className="flex flex-col gap-2 flex-1 min-h-0">
            <PoDetailTabs activeTab={activeTab} onTabChange={setActiveTab} />

            <div className="flex-1 overflow-y-auto">
              {activeTab === 'details' && <PoDetailsTab po={po} layout="panel" />}
              {activeTab === 'lineItems' && (
                <PoLineItemsTab lineItems={po.lineItems ?? []} layout="panel" />
              )}
              {activeTab === 'documents' && (
                <PoDocumentsTab poId={po.id} documents={po.documents ?? []} hideUpload />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
