import { exportRfqs } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  useRfq,
  RfqDetailTabs,
  RfqDocumentsTab,
  RfqLineItemsTab,
  RfqResponsesTab,
} from '@forethread/rfq-shared';
import type { RfqTab } from '@forethread/rfq-shared';
import { Badge, cn, getStatusColor, RFQ_STATUS_COLORS, Spinner } from '@forethread/ui-components';
import ArrowLineRightIcon from '@forethread/ui-components/assets/icons/arrow-line-right.svg?react';
import ArrowsOutSimpleIcon from '@forethread/ui-components/assets/icons/arrows-out-simple.svg?react';
import DownloadIcon from '@forethread/ui-components/assets/icons/download.svg?react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { RfqDetailsTab } from './RfqDetailsTab';

interface RfqDetailPanelProps {
  rfqId: string;
  onClose: () => void;
}

export function RfqDetailPanel({ rfqId, onClose }: RfqDetailPanelProps) {
  const { t } = useTranslation('rfqs');
  const navigate = useNavigate();
  const { data: rfq, isLoading, isError } = useRfq(rfqId);
  const [activeTab, setActiveTab] = useState<RfqTab>('details');

  const handleFullscreen = () => {
    onClose();
    navigate(ROUTES.rfqDetail.replace(':id', rfqId));
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
              void exportRfqs('pdf', { search: rfqId }).then(({ url }) =>
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

      {rfq && (
        <>
          {/* Title row */}
          <div className="flex items-center gap-4.5 shrink-0">
            <h2 className="flex-1 text-lg font-medium text-foreground">{rfq.projectName}</h2>
            <Badge className={getStatusColor(RFQ_STATUS_COLORS, rfq.status)}>
              {t(`status.${rfq.status}` as never)}
            </Badge>
          </div>

          {/* Tabs + scrollable content */}
          <div className="flex flex-col gap-2 flex-1 min-h-0">
            <RfqDetailTabs activeTab={activeTab} onTabChange={setActiveTab} />

            <div className="flex-1 overflow-y-auto">
              {activeTab === 'details' && <RfqDetailsTab rfq={rfq} layout="panel" />}
              {activeTab === 'lineItems' && (
                <RfqLineItemsTab lineItems={rfq.lineItems ?? []} layout="panel" />
              )}
              {activeTab === 'responses' && (
                <RfqResponsesTab
                  rfqId={rfq.id}
                  quoteResponses={rfq.quoteResponses}
                  layout="panel"
                />
              )}
              {activeTab === 'documents' && (
                <RfqDocumentsTab rfqId={rfq.id} documents={rfq.documents ?? []} hideUpload />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
