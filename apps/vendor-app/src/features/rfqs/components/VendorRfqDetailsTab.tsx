import type { RfqDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { DetailField, SectionDivider, SectionTitle, formatDate } from '@forethread/rfq-shared';

interface VendorRfqDetailsTabProps {
  rfq: RfqDetail;
  layout?: 'panel' | 'page';
}

export function VendorRfqDetailsTab({ rfq, layout = 'panel' }: VendorRfqDetailsTabProps) {
  const { t } = useTranslation(['rfqs', 'common']);

  const deadlineDisplay = formatDate(rfq.deadlineStart ?? rfq.deadlineEnd);

  if (layout === 'page') {
    return (
      <div className="rounded-lg border border-border bg-card p-[17px]">
        <h3 className="text-base font-bold text-foreground leading-6">
          {t('detailFields.rfqDetails')}
        </h3>
        <div className="flex flex-col gap-3 mt-4">
          {/* Row 1 */}
          <div className="flex items-start">
            <div className="w-[296px] shrink-0">
              <DetailField label={t('detailFields.rfqId')} value={rfq.rfqNumber ?? rfq.id} />
            </div>
            <div className="w-[296px] shrink-0">
              <DetailField
                label={t('columns.rfqStatus')}
                value={t(`status.${rfq.status}` as never)}
              />
            </div>
            <div className="w-[296px] shrink-0">
              <DetailField label={t('detailFields.contractorName')} value={rfq.createdBy.name} />
            </div>
            <div className="flex-1 min-w-0">
              <DetailField label={t('detailFields.projectName')} value={rfq.projectName} />
            </div>
          </div>
          {/* Row 2 */}
          <div className="flex items-start">
            <div className="w-[296px] shrink-0">
              <DetailField label={t('detailFields.resDeadline')} value={deadlineDisplay} />
            </div>
            <div className="w-[296px] shrink-0">
              <DetailField
                label={t('detailFields.createdDate')}
                value={formatDate(rfq.createdAt)}
              />
            </div>
            <div className="w-[296px] shrink-0">
              <DetailField
                label={t('detailFields.pickUp')}
                value={rfq.pickUp ? t('common:yes') : t('common:no')}
              />
            </div>
            <div className="flex-1 min-w-0">
              <DetailField
                label={t('detailFields.deliveryLocation')}
                value={rfq.deliveryLocation ?? '-'}
              />
            </div>
          </div>
          {/* Row 3 */}
          <div className="flex items-start">
            <div className="w-[296px] shrink-0">
              <DetailField
                label={t('detailFields.contractorContact' as never) as string}
                value={rfq.createdBy.name}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Panel layout (sidebar card) ─── */
  return (
    <div className="rounded-[10px] border border-foreground/10 p-3 flex flex-col gap-4 overflow-clip">
      {/* RFQ Details */}
      <div className="flex flex-col gap-2">
        <SectionTitle>{t('detailFields.rfqDetails')}</SectionTitle>
        <DetailField label={t('detailFields.rfqId')} value={rfq.rfqNumber ?? rfq.id} />
        <DetailField label={t('detailFields.projectName')} value={rfq.projectName} />
        <DetailField
          label={t('detailFields.deliveryLocation')}
          value={rfq.deliveryLocation ?? '-'}
        />
        <DetailField label={t('detailFields.resDeadline')} value={deadlineDisplay} />
      </div>

      <SectionDivider />

      {/* Items & Quantities */}
      <div className="flex flex-col gap-2">
        <SectionTitle>{t('detailFields.itemsAndQuantities')}</SectionTitle>
        <div className="grid grid-cols-2 gap-x-3">
          <DetailField
            label={t('detailFields.lineItemsCount')}
            value={String((rfq.lineItems ?? []).length)}
          />
          <DetailField
            label={t('detailFields.totalRequestedQty')}
            value={String(rfq.totalRequestedQty)}
          />
        </div>
      </div>

      <SectionDivider />

      {/* Metadata */}
      <div className="flex flex-col gap-2">
        <SectionTitle>{t('detailFields.metadata')}</SectionTitle>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          <DetailField label={t('detailFields.createdDate')} value={formatDate(rfq.createdAt)} />
          <DetailField label={t('detailFields.createdBy')} value={rfq.createdBy.name} />
        </div>
      </div>
    </div>
  );
}
