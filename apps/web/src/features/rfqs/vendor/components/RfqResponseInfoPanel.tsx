import type { RfqDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { DetailField, SectionTitle, formatDate, RfqDocumentsTab } from '@forethread/rfq-shared';
import { Badge, NEUTRAL_STATUS_COLOR } from '@forethread/ui-components';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';

interface RfqResponseInfoPanelProps {
  rfq: RfqDetail;
  onClose: () => void;
}

export function RfqResponseInfoPanel({ rfq, onClose }: RfqResponseInfoPanelProps) {
  const { t } = useTranslation(['rfqs', 'common']);
  const deadlineDisplay = formatDate(rfq.deadlineStart ?? rfq.deadlineEnd);

  return (
    <div className="space-y-4">
      {/* RFQ Details Card */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <SectionTitle>{t('detailFields.rfqDetails')}</SectionTitle>
            <Badge className={NEUTRAL_STATUS_COLOR}>{t(`status.${rfq.status}` as never)}</Badge>
          </div>
          <button
            type="button"
            aria-label="Close info panel"
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            onClick={onClose}
          >
            <CrossIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          {/* Row 1 */}
          <DetailField label={`${t('detailFields.rfqId')}:`} value={rfq.rfqNumber ?? rfq.id} />
          <DetailField label="Contractor company:" value={rfq.createdBy.name} />

          {/* Row 2: Issue Date (when RFQ was sent to vendors) + Res. Deadline */}
          <DetailField label={t('response.issueDate')} value={formatDate(rfq.createdAt)} />
          <DetailField label={`${t('detailFields.resDeadline')}:`} value={deadlineDisplay} />

          {/* Row 3 */}
          <DetailField
            label={`${t('detailFields.rfqStatus')}:`}
            value={t(`status.${rfq.status}` as never)}
          />
          <DetailField label={`${t('detailFields.projectName')}:`} value={rfq.projectName} />

          {/* Row 4 */}
          <DetailField
            label={`${t('columns.pickUp')}:`}
            value={rfq.pickUp ? t('common:yes') : t('common:no')}
          />
          <DetailField label={t('response.holdForRelease')} value={t('common:no')} />

          {/* Delivery location (full width) */}
          <div className="col-span-2">
            <DetailField
              label={`${t('detailFields.deliveryLocation')}:`}
              value={rfq.deliveryLocation ?? '-'}
            />
          </div>

          {/* Need by Date (full width) */}
          {rfq.needByDate && (
            <div className="col-span-2">
              <DetailField label={t('response.needByDate')} value={formatDate(rfq.needByDate)} />
            </div>
          )}

          {/* Contractor contact info */}
          <div className="col-span-2">
            <DetailField label={t('response.contractorContact')} value={rfq.createdBy.name} />
          </div>
          <div className="col-span-2">
            <DetailField label={`${t('detailFields.email')}:`} value="-" />
          </div>
        </div>
      </div>

      {/* Documents Card */}
      <div className="rounded-xl border border-border bg-card p-4">
        <SectionTitle>{t('documentsTab.title')}</SectionTitle>
        <div className="mt-3">
          <RfqDocumentsTab rfqId={rfq.id} documents={rfq.documents ?? []} hideUpload />
        </div>
      </div>
    </div>
  );
}
