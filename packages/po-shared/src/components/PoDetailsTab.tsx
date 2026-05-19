import type { PoDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { DetailField, SectionDivider, SectionTitle, formatDate } from '@forethread/rfq-shared';
import { Badge } from '@forethread/ui-components';

import { formatCurrency } from '../utils/format';

interface PoDetailsTabProps {
  po: PoDetail;
  layout?: 'panel' | 'page';
  /** Show "Contractor Details" instead of "Vendor Details" (for vendor app) */
  isVendorView?: boolean;
  /** Optional slot rendered at the bottom of Basic Information card (e.g. vendor accept fields) */
  vendorAcceptSlot?: React.ReactNode;
}

export function PoDetailsTab({
  po,
  layout = 'panel',
  isVendorView,
  vendorAcceptSlot,
}: PoDetailsTabProps) {
  const { t } = useTranslation(['purchaseOrders', 'common']);

  const deadlineDisplay =
    po.deadlineStart && po.deadlineEnd
      ? `${formatDate(po.deadlineStart)} - ${formatDate(po.deadlineEnd)}`
      : formatDate(po.deadlineStart ?? po.deadlineEnd);

  if (layout === 'page') {
    return (
      <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
        {/* Left: Basic Information */}
        <div className="flex-1 rounded-[10px] border border-foreground/10 p-4">
          <div className="flex flex-col gap-2">
            <SectionTitle>{t('detailFields.basicInformation')}</SectionTitle>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-x-14 gap-y-3">
                <DetailField label={t('detailFields.poId')} value={po.poNumber} />
                <DetailField label={t('detailFields.poName')} value={po.documentName ?? '-'} />
                <DetailField label={t('detailFields.projectId')} value={po.projectId ?? '-'} />
                <DetailField label={t('detailFields.projectName')} value={po.projectName} />
              </div>
              <DetailField
                label={t('detailFields.poType')}
                value={po.poType ? t(`poTypes.${po.poType}` as never) : '-'}
              />
              <div className="grid grid-cols-2 gap-x-14 gap-y-3">
                <DetailField
                  label={t('detailFields.pickUp')}
                  value={po.pickUp ? t('common:yes') : t('common:no')}
                />
                <DetailField
                  label={t('detailFields.holdForRelease')}
                  value={po.holdForRelease ? t('common:yes') : t('common:no')}
                />
                <DetailField
                  label={t('detailFields.plannedDeliveryDate')}
                  value={formatDate(po.plannedDeliveryDate)}
                />
                <DetailField
                  label={t('detailFields.earliestDelivery')}
                  value={formatDate(po.deadlineStart)}
                />
              </div>
              <DetailField
                label={t('detailFields.deliveryLocation')}
                value={po.deliveryLocationName ?? '-'}
              />
            </div>
          </div>
          {vendorAcceptSlot && (
            <>
              <SectionDivider />
              <div className="grid grid-cols-2 gap-x-12">{vendorAcceptSlot}</div>
            </>
          )}
        </div>

        {/* Right: Contractor/Vendor + Financial + Metadata */}
        <div className="flex-1 flex flex-col gap-2">
          {/* Vendor / Contractor Details */}
          {po.vendor && (
            <div className="rounded-[10px] border border-foreground/10 p-4">
              <SectionTitle>
                {isVendorView
                  ? t('detailFields.contractorDetails')
                  : t('detailFields.vendorDetails')}
              </SectionTitle>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                  <DetailField
                    label={isVendorView ? t('detailFields.contractor') : t('detailFields.vendor')}
                    value={po.vendor.name}
                  />
                  <DetailField label={t('detailFields.abn')} value={'-'} />
                  <DetailField label={t('detailFields.contactEmail')} value={'-'} />
                  <DetailField label={t('detailFields.contactPhone')} value={'-'} />
                </div>
              </div>
            </div>
          )}

          {/* Financial Summary */}
          <div className="rounded-[10px] border border-foreground/10 p-4">
            <SectionTitle>{t('detailFields.financialSummary')}</SectionTitle>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                <DetailField
                  label={t('detailFields.totalAmount')}
                  value={formatCurrency(po.totalAmount, po.currency)}
                />
                {!isVendorView ? (
                  <DetailField label={t('detailFields.linkedRfqAvgPrice')} value={'-'} />
                ) : (
                  <DetailField label={t('detailFields.shipmentCost')} value={'-'} />
                )}
                <DetailField
                  label={t('detailFields.discount')}
                  value={formatCurrency(po.discountAmount, po.currency)}
                />
                <DetailField
                  label={t('detailFields.generalSalesTax')}
                  value={formatCurrency(po.taxAmount, po.currency)}
                />
              </div>
              {!isVendorView && <DetailField label={t('detailFields.shipmentCost')} value={'-'} />}
            </div>
          </div>

          {/* Metadata */}
          <div className="rounded-[10px] border border-foreground/10 p-4">
            <SectionTitle>{t('detailFields.metadata')}</SectionTitle>
            <div className="grid grid-cols-2 gap-x-24 gap-y-3">
              <DetailField label={t('detailFields.createdDate')} value={formatDate(po.createdAt)} />
              <DetailField label={t('detailFields.createdBy')} value={po.createdBy.name} />
              {!isVendorView && (
                <>
                  <DetailField
                    label={t('detailFields.approvalStatus')}
                    value={
                      po.approvalStatus ? (
                        <Badge className="bg-muted text-muted-foreground text-xs">
                          {t(`approvalStatus.${po.approvalStatus}` as never)}
                        </Badge>
                      ) : (
                        '-'
                      )
                    }
                  />
                  <DetailField
                    label={t('detailFields.approvedBy')}
                    value={po.approvedBy?.name ?? '-'}
                  />
                  <DetailField
                    label={t('detailFields.lastModifiedBy')}
                    value={po.lastModifiedBy?.name ?? '-'}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Panel layout (preview sidebar)
  return (
    <div className="rounded-[10px] border border-foreground/10 p-3 flex flex-col gap-4 overflow-clip">
      <div className="flex flex-col gap-2">
        <SectionTitle>{t('detailFields.basicInformation')}</SectionTitle>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          <DetailField label={t('detailFields.poNumber')} value={po.poNumber} />
          <DetailField label={t('detailFields.projectName')} value={po.projectName} />
          <DetailField
            label={t('detailFields.poType')}
            value={po.poType ? t(`poTypes.${po.poType}` as never) : '-'}
          />
          <DetailField label={t('detailFields.vendor')} value={po.vendor?.name ?? '-'} />
          <DetailField
            label={t('detailFields.pickUp')}
            value={po.pickUp ? t('common:yes') : t('common:no')}
          />
          <DetailField label={t('detailFields.deadlineRange')} value={deadlineDisplay} />
        </div>
        <DetailField
          label={t('detailFields.deliveryLocation')}
          value={po.deliveryLocationName ?? '-'}
        />
        <DetailField
          label={t('detailFields.plannedDeliveryDate')}
          value={formatDate(po.plannedDeliveryDate)}
        />
      </div>

      <SectionDivider />

      <div className="flex flex-col gap-2">
        <SectionTitle>{t('detailFields.financialSummary')}</SectionTitle>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          <DetailField
            label={t('detailFields.totalAmount')}
            value={formatCurrency(po.totalAmount, po.currency)}
          />
          <DetailField
            label={t('detailFields.paymentTermsDays')}
            value={po.paymentTermsDays != null ? `${po.paymentTermsDays} days` : '-'}
          />
          <DetailField label={t('detailFields.currency')} value={po.currency} />
          <DetailField
            label={t('detailFields.subtotal')}
            value={formatCurrency(po.subtotal, po.currency)}
          />
        </div>
      </div>

      <SectionDivider />

      <div className="flex flex-col gap-2">
        <SectionTitle>{t('detailFields.metadata')}</SectionTitle>
        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
          <DetailField label={t('detailFields.createdDate')} value={formatDate(po.createdAt)} />
          <DetailField
            label={t('detailFields.approvalStatus')}
            value={
              po.approvalStatus ? (
                <Badge className="bg-muted text-muted-foreground text-xs">
                  {t(`approvalStatus.${po.approvalStatus}` as never)}
                </Badge>
              ) : (
                '-'
              )
            }
          />
          <DetailField label={t('detailFields.createdBy')} value={po.createdBy.name} />
          <DetailField label={t('detailFields.approvedBy')} value={po.approvedBy?.name ?? '-'} />
        </div>
        <DetailField
          label={t('detailFields.lastModifiedBy')}
          value={po.lastModifiedBy?.name ?? '-'}
        />
      </div>
    </div>
  );
}
