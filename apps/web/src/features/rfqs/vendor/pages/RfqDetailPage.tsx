import { exportRfqs } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  usePageTitleStore,
  useRfq,
  RfqDocumentsTab,
  RfqLineItemsTab,
} from '@forethread/rfq-shared';
import { Button, Spinner } from '@forethread/ui-components';
import DownloadIcon from '@forethread/ui-components/assets/icons/download.svg?react';
import PaperPlaneIcon from '@forethread/ui-components/assets/icons/paper-plane.svg?react';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { VendorRfqDetailsTab } from '../components/VendorRfqDetailsTab';
import { useCanRespond } from '../hooks/useCanRespond';

export default function RfqDetailPage() {
  const { t } = useTranslation('rfqs');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: rfq, isLoading, isError } = useRfq(id ?? '');
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  const { canCreate, canEdit } = useCanRespond(rfq);

  useEffect(() => {
    if (rfq) setPageTitle(rfq.rfqNumber ?? rfq.id);
    return () => setPageTitle(null);
  }, [rfq, setPageTitle]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !rfq) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">{t('detail.noData')}</div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Action buttons */}
      <div className="px-4 sm:px-8 pt-6 pb-4 flex items-center gap-3">
        <Button
          variant="primary"
          size="md"
          className="h-[42px]"
          leftIcon={<PaperPlaneIcon className="w-4 h-4" />}
          onClick={() => navigate(ROUTES.rfqResponse.replace(':id', rfq.id))}
          disabled={!canCreate && !canEdit}
        >
          {canEdit ? t('actions.editResponse') : t('actions.response')}
        </Button>
        <Button
          variant="outline"
          size="md"
          className="h-[42px]"
          rightIcon={<DownloadIcon className="w-4 h-4" />}
          onClick={() => {
            void exportRfqs('pdf', { search: rfq.id }).then(({ url }) =>
              window.open(url, '_blank'),
            );
          }}
        >
          {t('actions.exportAs')}
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-8 space-y-6">
        {/* RFQ Details */}
        <VendorRfqDetailsTab rfq={rfq} layout="page" />

        {/* Line Items */}
        <div className="rounded-xl border border-border bg-card p-6">
          <RfqLineItemsTab lineItems={rfq.lineItems ?? []} layout="page" />
        </div>

        {/* Documents */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-medium text-foreground mb-4">{t('documentsTab.title')}</h2>
          <RfqDocumentsTab rfqId={rfq.id} documents={rfq.documents ?? []} hideUpload />
        </div>
      </div>
    </div>
  );
}
