import { getRfqs, getRfq } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import {
  Alert,
  Button,
  CustomDropdown,
  DatePicker,
  FormField,
  Spinner,
  formatCurrency,
  notificationService,
} from '@forethread/ui-components';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit-in-square.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { BULK_ORDER_ROUTES } from '../constants/routes';
import { useCreateBulkOrder } from '../services/bulk-orders.service';
import { deriveApprovedQuoteResponses, type ApprovedQuoteResponse } from '../utils/approved-quotes';

/** Shipment & handling is not yet returned per bulk order; shown as a static $0 band per design. */
const SHIPMENT_AND_HANDLING = 0;

export interface CreateBulkOrderPageProps {
  /** True when rendered inside the vendor app — currently buyer-only, kept for parity. */
  isVendorView?: boolean;
}

export function CreateBulkOrderPage({ isVendorView = false }: CreateBulkOrderPageProps = {}) {
  void isVendorView;
  const { t } = useTranslation('bulkOrders');
  const navigate = useNavigate();
  const setTitle = usePageTitleStore((s) => s.setTitle);
  const mutation = useCreateBulkOrder();

  const [selectedRfqId, setSelectedRfqId] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    setTitle(t('create.title') as string, t('create.subtitle') as string);
    return () => setTitle(null);
  }, [setTitle, t]);

  // RFQs that have at least one approved quote — the source of "approved responses".
  const { data: rfqsData, isLoading: rfqsLoading } = useQuery({
    queryKey: ['rfqs', 'approved-quotes', 'bulk-order-create'],
    queryFn: () => getRfqs({ minApprovedQuotes: 1, limit: 50 }, { skipErrorHandler: true }),
  });

  const { data: rfqDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['rfqs', selectedRfqId],
    queryFn: () => getRfq(selectedRfqId),
    enabled: !!selectedRfqId,
  });

  const responseOptions = useMemo(
    () =>
      (rfqsData?.items ?? []).map((rfq) => ({
        value: rfq.id,
        label: `${rfq.rfqNumber ?? rfq.id} · ${rfq.projectName}`,
      })),
    [rfqsData],
  );

  // The first approved response on the selected RFQ (mirrors the PO "from RFQ" flow).
  const approvedResponse: ApprovedQuoteResponse | null = useMemo(() => {
    if (!rfqDetail) return null;
    const responses = deriveApprovedQuoteResponses(rfqDetail);
    return responses[0] ?? null;
  }, [rfqDetail]);

  const lineItems = approvedResponse?.lineItems ?? [];

  const summary = useMemo(() => {
    const lineTotal = lineItems.reduce((sum, li) => sum + li.lineTotalWithTax, 0);
    const discountPercent = lineItems[0]?.discountPercent ?? 0;
    return {
      discountPercent,
      totalWithTaxes: Math.round((lineTotal + SHIPMENT_AND_HANDLING) * 100) / 100,
    };
  }, [lineItems]);

  const isPopulated = !!approvedResponse && lineItems.length > 0;
  const canSubmit = isPopulated && !!endDate && !mutation.isPending;

  const handleCancel = () => navigate(BULK_ORDER_ROUTES.bulkOrders);

  const handleCreate = () => {
    if (!canSubmit || !approvedResponse) return;
    mutation.mutate(
      {
        projectId: approvedResponse.projectId,
        vendorId: approvedResponse.vendorId,
        rfqId: approvedResponse.rfqId,
        endDate,
        lineItems: lineItems.map((li) => ({
          itemReference: li.itemReference,
          description: li.description,
          qty: li.quantity,
          unit: li.unit,
          pricePerUnit: li.pricePerUnit,
        })),
      },
      {
        onSuccess: (data) => {
          notificationService.success(t('create.createSuccess'));
          navigate(BULK_ORDER_ROUTES.bulkOrderDetail.replace(':id', data.bulkId));
        },
        onError: () => notificationService.error(t('create.createError')),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Details card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-bold text-foreground mb-6">
          {isPopulated ? t('create.projectDetails') : t('create.bulkDetails')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label={t('create.projectAssignment')}>
            <CustomDropdown
              value={approvedResponse?.projectId ?? ''}
              options={
                approvedResponse
                  ? [{ value: approvedResponse.projectId, label: approvedResponse.projectName }]
                  : []
              }
              placeholder={t('create.selectPlaceholder')}
              disabled
            />
          </FormField>

          <FormField label={t('create.approvedRfqResponse')}>
            <CustomDropdown
              value={selectedRfqId}
              onChange={setSelectedRfqId}
              options={responseOptions}
              placeholder={
                rfqsLoading ? t('create.loadingResponses') : t('create.selectPlaceholder')
              }
              disabled={rfqsLoading}
            />
          </FormField>

          <FormField label={t('create.expectedEndDate')}>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder={t('create.datePlaceholder')}
              minDate={new Date().toISOString().slice(0, 10)}
            />
          </FormField>
        </div>

        {/* Empty-state info banner */}
        {!isPopulated && !detailLoading && (
          <Alert variant="info" icon={<InfoIcon className="w-5 h-5" />} className="mt-6">
            {selectedRfqId && responseOptions.length === 0
              ? t('create.noResponses')
              : selectedRfqId && lineItems.length === 0
                ? t('create.noLineItems')
                : t('create.autoPopulateInfo')}
          </Alert>
        )}

        {detailLoading && (
          <div className="flex justify-center py-10">
            <Spinner size="md" />
          </div>
        )}

        {/* Populated line items */}
        {isPopulated && (
          <div className="mt-6 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="bg-foreground/5">
                  {LINE_ITEM_COLUMN_KEYS.map((key) => (
                    <th
                      key={key}
                      className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))]"
                    >
                      {t(`create.columns.${key}` as never) as string}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((li) => (
                  <tr key={li.id} className="border-t border-border">
                    <td className="p-3 text-foreground">{li.itemReference}</td>
                    <td className="p-3 text-foreground truncate max-w-[160px]">{li.description}</td>
                    <td className="p-3 text-foreground">{formatCurrency(li.pricePerUnit)}</td>
                    <td className="p-3 text-foreground">{li.unit}</td>
                    <td className="p-3 text-foreground">{li.quantity}</td>
                    <td className="p-3 text-foreground">
                      {li.discountPercent > 0
                        ? `${li.discountPercent}% (${formatCurrency(li.discountAmount)})`
                        : '-'}
                    </td>
                    <td className="p-3 text-foreground">{formatCurrency(li.lineTotalWithTax)}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center">
                        <EditIcon className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/50">
                  <td colSpan={4} />
                  <td className="px-3 py-4 align-top" colSpan={2}>
                    <p className="text-sm text-muted-foreground">
                      {t('create.summary.shipmentHandling')}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {formatCurrency(SHIPMENT_AND_HANDLING)}
                    </p>
                  </td>
                  <td className="px-3 py-4 align-top">
                    <p className="text-sm text-muted-foreground">{t('create.summary.discount')}</p>
                    <p className="text-sm font-medium text-foreground">
                      {summary.discountPercent}%
                    </p>
                  </td>
                  <td className="px-3 py-4 align-top">
                    <p className="text-sm text-muted-foreground">
                      {t('create.summary.totalWithTaxes')}
                    </p>
                    <p className="text-sm font-bold text-foreground">
                      {formatCurrency(summary.totalWithTaxes)}
                    </p>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Footer action bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="lg"
          leftIcon={<CrossIcon className="w-4 h-4" />}
          onClick={handleCancel}
        >
          {t('create.cancel')}
        </Button>
        <Button variant="primary" size="lg" disabled={!canSubmit} onClick={handleCreate}>
          {mutation.isPending ? t('create.creating') : t('create.create')}
        </Button>
      </div>
    </div>
  );
}

const LINE_ITEM_COLUMN_KEYS = [
  'item',
  'description',
  'pricePerUnit',
  'uom',
  'quantity',
  'discount',
  'lineTotalWithTax',
  'actions',
] as const;
