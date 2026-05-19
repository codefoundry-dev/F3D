import type { RfqDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  DetailRow,
  DetailField,
  SectionDivider,
  SectionTitle,
  formatDate,
  formatCurrency,
  VendorList,
} from '@forethread/rfq-shared';
import { QuoteResponseStatus } from '@forethread/shared-types/client';
import { Badge } from '@forethread/ui-components';
import EyeClosedIcon from '@forethread/ui-components/assets/icons/eye-closed.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import { useState } from 'react';

interface RfqDetailsTabProps {
  rfq: RfqDetail;
  layout?: 'panel' | 'page';
}

export function RfqDetailsTab({ rfq, layout = 'panel' }: RfqDetailsTabProps) {
  const { t } = useTranslation(['rfqs', 'common']);
  const [vendorsVisible, setVendorsVisible] = useState(false);

  const quotes = rfq.quoteResponses ?? [];
  const approvedLineItems = quotes.filter(
    (q) => q.status === (QuoteResponseStatus.APPROVED as string),
  ).length;
  const declinedLineItems = quotes.filter(
    (q) => q.status === (QuoteResponseStatus.DECLINED as string),
  ).length;
  const receivedQuotes = quotes.length;
  const averageCost =
    receivedQuotes > 0 ? quotes.reduce((sum, q) => sum + q.totalCost, 0) / receivedQuotes : 0;

  const vendors = rfq.vendors ?? [];
  const invitedVendors = vendors.length;
  const approvedVendors = vendors.filter((v) => v.approved).length;

  const deadlineDisplay =
    rfq.deadlineStart && rfq.deadlineEnd
      ? `${formatDate(rfq.deadlineStart)} - ${formatDate(rfq.deadlineEnd)}`
      : formatDate(rfq.deadlineStart ?? rfq.deadlineEnd);

  if (layout === 'page') {
    return <RfqDetailsTabPageLayout rfq={rfq} />;
  }

  return (
    <div className="rounded-[10px] border border-foreground/10 p-3 flex flex-col gap-4 overflow-clip">
      {/* Basic Information */}
      <div className="flex flex-col gap-2">
        <SectionTitle>{t('detailFields.basicInformation')}</SectionTitle>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          <DetailField label={t('detailFields.rfqId')} value={rfq.rfqNumber ?? rfq.id} />
          <DetailField label={t('detailFields.rfqName')} value={rfq.name ?? '-'} />
          <DetailField label={t('detailFields.projectId')} value={rfq.projectId} />
          <DetailField label={t('detailFields.projectName')} value={rfq.projectName} />
          <DetailField label={t('detailFields.rfqType')} value={rfq.rfqType ?? '-'} />
          <DetailField label={t('detailFields.paymentTerms')} value={rfq.paymentTerms ?? '-'} />
          <DetailField
            label={t('detailFields.pickUp')}
            value={rfq.pickUp ? t('common:yes') : t('common:no')}
          />
          <DetailField label={t('detailFields.resDeadline')} value={deadlineDisplay} />
        </div>
        <DetailField
          label={t('detailFields.deliveryLocation')}
          value={rfq.deliveryLocation ?? '-'}
        />
        <DetailField label={t('detailFields.needBy')} value={formatDate(rfq.needByDate)} />
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

      {/* Vendors */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SectionTitle>{t('detailFields.vendors')}</SectionTitle>
          <button
            type="button"
            onClick={() => setVendorsVisible((p) => !p)}
            className="flex items-center justify-center w-6 h-6 text-muted-foreground hover:text-foreground transition-colors"
            title={t('actions.view')}
          >
            {vendorsVisible ? (
              <EyeClosedIcon className="w-6 h-6" />
            ) : (
              <EyeIcon className="w-6 h-6" />
            )}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <DetailField label={t('detailFields.invitedVendors')} value={String(invitedVendors)} />
          <DetailField label={t('detailFields.approvedVendors')} value={String(approvedVendors)} />
        </div>
        {vendorsVisible && vendors.length > 0 && (
          <div className="mt-1">
            <VendorList vendors={vendors} compact />
          </div>
        )}
      </div>

      <SectionDivider />

      {/* Quote Information */}
      <div className="flex flex-col gap-2">
        <SectionTitle>{t('detailFields.quoteInformation')}</SectionTitle>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          <DetailField label={t('detailFields.receivedQuotes')} value={String(receivedQuotes)} />
          <DetailField
            label={t('detailFields.averageQuotedCost')}
            value={formatCurrency(averageCost)}
          />
          <DetailField label={t('detailFields.approvedQuotes')} value={String(approvedLineItems)} />
          <DetailField label={t('detailFields.declinedQuotes')} value={String(declinedLineItems)} />
        </div>
      </div>

      <SectionDivider />

      {/* Metadata */}
      <div className="flex flex-col gap-2">
        <SectionTitle>{t('detailFields.metadata')}</SectionTitle>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          <DetailField label={t('detailFields.createdDate')} value={formatDate(rfq.createdAt)} />
          <DetailField
            label={t('detailFields.approvalStatus')}
            value={
              rfq.approvalStatus ? (
                <Badge className="bg-muted text-muted-foreground text-xs">
                  {t(`approvalStatus.${rfq.approvalStatus}` as never)}
                </Badge>
              ) : (
                '-'
              )
            }
          />
          <DetailField label={t('detailFields.createdBy')} value={rfq.createdBy.name} />
          <DetailField label={t('detailFields.approvedBy')} value={rfq.approvedBy?.name ?? '-'} />
        </div>
        <DetailField
          label={t('detailFields.lastModifiedBy')}
          value={rfq.lastModifiedBy?.name ?? '-'}
        />
      </div>
    </div>
  );
}

/* ─── Page layout (two-column) ─────────────────────────────────────────────── */

function RfqDetailsTabPageLayout({ rfq }: { rfq: RfqDetail }) {
  const { t } = useTranslation(['rfqs', 'common']);

  const quotes = rfq.quoteResponses ?? [];
  const approvedLineItems = quotes.filter(
    (q) => q.status === (QuoteResponseStatus.APPROVED as string),
  ).length;
  const declinedLineItems = quotes.filter(
    (q) => q.status === (QuoteResponseStatus.DECLINED as string),
  ).length;
  const receivedQuotes = quotes.length;
  const averageCost =
    receivedQuotes > 0 ? quotes.reduce((sum, q) => sum + q.totalCost, 0) / receivedQuotes : 0;

  const vendors = rfq.vendors ?? [];
  const invitedVendors = vendors.length;
  const approvedVendors = vendors.filter((v) => v.approved).length;

  const deadlineDisplay =
    rfq.deadlineStart && rfq.deadlineEnd
      ? `${formatDate(rfq.deadlineStart)} - ${formatDate(rfq.deadlineEnd)}`
      : formatDate(rfq.deadlineStart ?? rfq.deadlineEnd);

  return (
    <div className="space-y-6">
      {/* Top row: Basic Info + Quote Info side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <SectionTitle>{t('detailFields.basicInformation')}</SectionTitle>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-3">
            <DetailRow label={t('detailFields.rfqId')} value={rfq.rfqNumber ?? rfq.id} />
            <DetailRow label={t('detailFields.rfqName')} value={rfq.name ?? '-'} />
            <DetailRow label={t('detailFields.projectId')} value={rfq.projectId} />
            <DetailRow label={t('detailFields.projectName')} value={rfq.projectName} />
            <DetailRow label={t('detailFields.rfqType')} value={rfq.rfqType ?? '-'} />
            <DetailRow label={t('detailFields.paymentTerms')} value={rfq.paymentTerms ?? '-'} />
            <DetailRow
              label={t('detailFields.pickUp')}
              value={rfq.pickUp ? t('common:yes') : t('common:no')}
            />
            <DetailRow label={t('detailFields.resDeadline')} value={deadlineDisplay} />
            <DetailRow
              label={t('detailFields.deliveryLocation')}
              value={rfq.deliveryLocation ?? '-'}
            />
            <DetailRow label={t('detailFields.needBy')} value={formatDate(rfq.needByDate)} />
          </div>
        </div>

        {/* Right column: Quote Info + Items & Quantities */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <SectionTitle>{t('detailFields.quoteInformation')}</SectionTitle>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-3">
              <DetailRow label={t('detailFields.receivedQuotes')} value={String(receivedQuotes)} />
              <DetailRow
                label={t('detailFields.averageQuotedCost')}
                value={formatCurrency(averageCost)}
              />
              <DetailRow
                label={t('detailFields.approvedQuotes')}
                value={String(approvedLineItems)}
              />
              <DetailRow
                label={t('detailFields.declinedQuotes')}
                value={String(declinedLineItems)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <SectionTitle>{t('detailFields.itemsAndQuantities')}</SectionTitle>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-3">
              <DetailRow
                label={t('detailFields.lineItemsCount')}
                value={String((rfq.lineItems ?? []).length)}
              />
              <DetailRow
                label={t('detailFields.totalRequestedQty')}
                value={String(rfq.totalRequestedQty)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Vendors section */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>{t('detailFields.vendors')}</SectionTitle>
          <div className="flex items-center gap-6 text-sm">
            <span className="text-muted-foreground">
              {t('detailFields.invitedVendors')}:{' '}
              <span className="text-foreground font-medium">{invitedVendors}</span>
            </span>
            <span className="text-muted-foreground">
              {t('detailFields.approvedVendors')}:{' '}
              <span className="text-foreground font-medium">{approvedVendors}</span>
            </span>
          </div>
        </div>
        <VendorList vendors={vendors} />
      </div>

      {/* Metadata section */}
      <div className="rounded-xl border border-border bg-card p-6">
        <SectionTitle>{t('detailFields.metadata')}</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 mt-3">
          <DetailRow label={t('detailFields.createdDate')} value={formatDate(rfq.createdAt)} />
          <DetailRow
            label={t('detailFields.approvalStatus')}
            value={
              rfq.approvalStatus ? (
                <Badge className="bg-muted text-muted-foreground text-xs">
                  {t(`approvalStatus.${rfq.approvalStatus}` as never)}
                </Badge>
              ) : (
                '-'
              )
            }
          />
          <DetailRow label={t('detailFields.createdBy')} value={rfq.createdBy.name} />
          <DetailRow label={t('detailFields.approvedBy')} value={rfq.approvedBy?.name ?? '-'} />
          <DetailRow
            label={t('detailFields.lastModifiedBy')}
            value={rfq.lastModifiedBy?.name ?? '-'}
          />
        </div>
      </div>
    </div>
  );
}
