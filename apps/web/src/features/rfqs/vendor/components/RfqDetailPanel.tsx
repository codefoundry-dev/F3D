import { exportRfqs } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { useRfq } from '@forethread/rfq-shared';
import {
  Badge,
  Button,
  cn,
  getStatusColor,
  VENDOR_RFQ_STATUS_COLORS,
  Spinner,
} from '@forethread/ui-components';
import ArrowLineRightIcon from '@forethread/ui-components/assets/icons/arrow-line-right.svg?react';
import ArrowsOutSimpleIcon from '@forethread/ui-components/assets/icons/arrows-out-simple.svg?react';
import DownloadIcon from '@forethread/ui-components/assets/icons/download.svg?react';
import PaperPlaneIcon from '@forethread/ui-components/assets/icons/paper-plane.svg?react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { useCanRespond } from '../hooks/useCanRespond';

import { VendorRfqDetailsTab } from './VendorRfqDetailsTab';

interface RfqDetailPanelProps {
  rfqId: string;
  onClose: () => void;
}

export function RfqDetailPanel({ rfqId, onClose }: RfqDetailPanelProps) {
  const { t } = useTranslation('rfqs');
  const navigate = useNavigate();
  const { data: rfq, isLoading, isError } = useRfq(rfqId);
  const { canCreate, canEdit } = useCanRespond(rfq);

  const handleFullscreen = () => {
    onClose();
    navigate(ROUTES.rfqDetail.replace(':id', rfqId));
  };

  const iconBtnClass =
    'flex items-center justify-center h-9 px-3.5 rounded-xl border border-foreground/20 text-foreground hover:bg-accent transition-colors';

  return (
    <div
      className={cn(
        'w-full h-full md:w-[480px] md:min-h-[508px] md:max-h-[508px] shrink-0 flex flex-col gap-4.5',
        'bg-card border border-foreground/20',
        'rounded-none md:rounded-[14px] overflow-hidden p-4',
      )}
    >
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
        <div className="flex items-center gap-1">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<PaperPlaneIcon className="w-4 h-4" />}
            onClick={() => navigate(ROUTES.rfqResponse.replace(':id', rfqId))}
            disabled={!canCreate && !canEdit}
          >
            {canEdit ? t('actions.editResponse') : t('actions.response')}
          </Button>
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
        </div>
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
          <div className="flex items-center gap-4.5 shrink-0">
            <h2 className="flex-1 text-lg font-medium text-foreground">
              {rfq.rfqNumber ?? rfq.id}
            </h2>
            <Badge className={getStatusColor(VENDOR_RFQ_STATUS_COLORS, rfq.status)}>
              {t(`status.${rfq.status}` as never)}
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            <VendorRfqDetailsTab rfq={rfq} layout="panel" />
          </div>
        </>
      )}
    </div>
  );
}
