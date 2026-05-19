import type { BulkOrderLineItemDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import {
  Button,
  Spinner,
  Alert,
  notificationService,
  formatCurrency,
  formatDate,
} from '@forethread/ui-components';
import ClockIcon from '@forethread/ui-components/assets/icons/clock-icon.svg?react';
import MarkIcon from '@forethread/ui-components/assets/icons/mark-with-cyrcle.svg?react';
import MessageIcon from '@forethread/ui-components/assets/icons/message.svg?react';
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { BULK_ORDER_ROUTES } from '../constants/routes';
import {
  useBulkOrder,
  useChangeRequests,
  useApproveChange,
  useRejectChange,
} from '../services/bulk-orders.service';

import { ChangeHistoryCard } from './ChangeHistoryCard';
import { DetailField } from './DetailField';

interface ParsedLineItemChange {
  lineItemId?: string;
  action: string;
  itemReference?: string;
  description?: string;
  unitPrice?: number;
  quantity?: number;
  uom?: string;
}

export interface ReviewChangesPageProps {
  /** True when rendered inside the vendor app — flips approval labels */
  isVendorView?: boolean;
}

export function ReviewChangesPage({ isVendorView = false }: ReviewChangesPageProps = {}) {
  const { t: _t } = useTranslation('bulkOrders');
  const t = _t as (key: string, opts?: Record<string, unknown>) => string;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useBulkOrder(id ?? '');
  const { data: changeRequests } = useChangeRequests(id ?? '');
  const approveMutation = useApproveChange();
  const rejectMutation = useRejectChange();
  const setTitle = usePageTitleStore((s) => s.setTitle);

  useEffect(() => {
    if (data) setTitle(data.bulkId, t('list.subtitle') as string);
    return () => setTitle(null);
  }, [data, setTitle, t]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8">
        <Alert variant="destructive">{t('list.failedToLoad')}</Alert>
      </div>
    );
  }

  const pendingCr = changeRequests?.find((cr) => cr.status === 'PENDING');
  if (!pendingCr) {
    // No pending change request — redirect back
    navigate(BULK_ORDER_ROUTES.bulkOrderDetail.replace(':id', id!));
    return null;
  }

  const goBack = () => navigate(BULK_ORDER_ROUTES.bulkOrderDetail.replace(':id', id!));

  const changes = pendingCr.changes as {
    endDate?: string | null;
    lineItems?: ParsedLineItemChange[];
  };

  const isPending = approveMutation.isPending || rejectMutation.isPending;

  const handleApprove = () => {
    approveMutation.mutate(
      { bulkOrderId: id!, changeRequestId: pendingCr.id },
      {
        onSuccess: () => {
          notificationService.success(t('changeRequests.approveSuccess'));
          goBack();
        },
      },
    );
  };

  const handleReject = () => {
    rejectMutation.mutate(
      { bulkOrderId: id!, changeRequestId: pendingCr.id },
      {
        onSuccess: () => {
          notificationService.success(t('changeRequests.rejectSuccess'));
          goBack();
        },
      },
    );
  };

  // Build a map of lineItemId → proposed changes
  const changeMap = new Map<string, ParsedLineItemChange>();
  for (const li of changes.lineItems ?? []) {
    if (li.lineItemId) changeMap.set(li.lineItemId, li);
  }
  const addedItems = (changes.lineItems ?? []).filter((li) => li.action === 'add');
  const removedIds = new Set(
    (changes.lineItems ?? []).filter((li) => li.action === 'remove').map((li) => li.lineItemId),
  );

  // Sort change requests desc
  const sortedCrs = [...(changeRequests ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const totalVersions = sortedCrs.length;

  return (
    <div className="flex gap-6 p-4 min-h-full">
      {/* Left sidebar */}
      <div className="w-[280px] shrink-0 flex flex-col gap-6">
        {/* Bulk Details */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-base font-bold text-foreground mb-3">{t('detail.bulkDetails')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <DetailField label={t('detail.bulkId')} value={data.bulkId} />
            <DetailField
              label={t('detail.status')}
              value={data.status ? (t(`status.${data.status}` as never) as string) : '-'}
            />
            <DetailField label={t('detail.vendorName')} value={data.vendorName} />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <DetailField label={t('detail.createdDate')} value={formatDate(data.createdDate)} />
            <DetailField label={t('detail.validUntil')} value={formatDate(data.endDate)} />
            <DetailField label={t('detail.rfqReference')} value={data.rfqReference ?? '-'} />
            <DetailField label={t('detail.createdBy')} value={data.createdBy} />
          </div>
        </div>

        {/* Change History */}
        {sortedCrs.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-base font-bold text-foreground mb-3">
              {t('changeRequests.title')}
            </h2>
            <div className="flex flex-col gap-2">
              {sortedCrs.map((cr, index) => (
                <ChangeHistoryCard
                  key={cr.id}
                  changeRequest={cr}
                  isInitialVersion={index === sortedCrs.length - 1}
                  version={totalVersions - index}
                  rfqReference={data.rfqReference}
                  isVendorView={isVendorView}
                  compact
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Top bar: Alert + Submit/Cancel */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <Alert variant="info" icon={<ClockIcon className="w-5 h-5" />} className="flex-1">
            {isVendorView
              ? t('changeRequests.reviewPage.infoAlertContractor')
              : t('changeRequests.reviewPage.infoAlertVendor')}
          </Alert>
          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="primary"
              size="md"
              className="h-12 gap-2"
              disabled={isPending}
              onClick={handleApprove}
            >
              <MarkIcon className="w-5 h-5" />
              {approveMutation.isPending
                ? t('changeRequests.reviewPage.submitting')
                : t('changeRequests.reviewPage.submit')}
            </Button>
            <Button
              variant="outline"
              size="md"
              className="h-12"
              disabled={isPending}
              onClick={handleReject}
            >
              {t('changeRequests.reviewPage.cancel')}
            </Button>
          </div>
        </div>

        {(approveMutation.isError || rejectMutation.isError) && (
          <Alert variant="destructive" className="mb-4">
            {approveMutation.isError
              ? t('changeRequests.approveError')
              : t('changeRequests.rejectError')}
          </Alert>
        )}

        {/* Agreement details — read-only */}
        <div className="mb-6">
          <div className="flex items-baseline gap-2 mb-4">
            <h2 className="text-base font-bold text-foreground">
              {t('changeRequests.reviewPage.agreementDetails')}
            </h2>
            <span className="text-sm text-muted-foreground">
              {t('changeRequests.reviewPage.appliedToAll')}
            </span>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t('changeRequests.reviewPage.projectName')}
                </p>
                <p className="text-sm font-medium text-foreground">{data.projectName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t('changeRequests.reviewPage.expirationDate')}
                </p>
                <p className="text-sm font-medium text-foreground">
                  {changes.endDate ? formatDate(changes.endDate) : formatDate(data.endDate)}
                </p>
              </div>
            </div>
            {pendingCr.message && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {t('changeRequests.reviewPage.changeReason')}
                </p>
                <p className="text-sm text-foreground">{pendingCr.message}</p>
              </div>
            )}
          </div>
        </div>

        {/* Line Items table — read-only with proposed values */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-bold text-foreground mb-4">
            {t('changeRequests.reviewPage.lineItems')}
          </h2>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="bg-foreground/5">
                  <Th>{t('detail.lineItemId')}</Th>
                  <Th>{t('detail.itemReference')}</Th>
                  <Th>{t('detail.description')}</Th>
                  <Th>{t('detail.unit')}</Th>
                  <Th>{t('detail.qty')}</Th>
                  <Th>{t('detail.qtyRemaining')}</Th>
                  <Th>{t('changeRequests.reviewPage.newQty')}</Th>
                  <Th>{t('changeRequests.reviewPage.currentPrice')}</Th>
                  <Th>{t('changeRequests.reviewPage.newPrice')}</Th>
                  <Th>{t('columns.actions')}</Th>
                </tr>
              </thead>
              <tbody>
                {data.lineItems
                  .filter((li) => !removedIds.has(li.lineItemId))
                  .map((item) => {
                    const change = changeMap.get(item.lineItemId);
                    return (
                      <ReadOnlyLineItemRow
                        key={item.lineItemId}
                        item={item}
                        proposedQty={change?.quantity}
                        proposedPrice={change?.unitPrice}
                      />
                    );
                  })}
                {/* Added items */}
                {addedItems.map((added, idx) => (
                  <tr key={`added-${idx}`} className="border-t border-border bg-success/5">
                    <td className="p-3 text-muted-foreground border border-border text-xs italic">
                      new
                    </td>
                    <td className="p-3 text-foreground border border-border">
                      {added.itemReference ?? '-'}
                    </td>
                    <td className="p-3 text-foreground border border-border">
                      {added.description ?? '-'}
                    </td>
                    <td className="p-3 text-foreground border border-border">
                      {added.uom ?? 'EA'}
                    </td>
                    <td className="p-3 border border-border" />
                    <td className="p-3 border border-border" />
                    <td className="p-3 text-foreground border border-border font-medium">
                      {added.quantity ?? '-'}
                    </td>
                    <td className="p-3 border border-border" />
                    <td className="p-3 text-foreground border border-border font-medium">
                      {added.unitPrice !== undefined ? formatCurrency(added.unitPrice) : '-'}
                    </td>
                    <td className="p-3 border border-border">
                      <div className="flex items-center justify-center">
                        <MessageIcon className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/50">
                  <td colSpan={10} className="px-6 py-3">
                    <span className="text-sm text-muted-foreground">
                      {t('detail.totalItems')}:{' '}
                      <span className="text-foreground">
                        {data.lineItems.filter((li) => !removedIds.has(li.lineItemId)).length +
                          addedItems.length}
                      </span>
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border last:border-r-0">
      {children}
    </th>
  );
}

function ReadOnlyLineItemRow({
  item,
  proposedQty,
  proposedPrice,
}: {
  item: BulkOrderLineItemDetail;
  proposedQty?: number;
  proposedPrice?: number;
}) {
  return (
    <tr className="border-t border-border">
      <td className="p-3 text-foreground border border-border">{item.lineItemId}</td>
      <td className="p-3 text-foreground border border-border">{item.itemReference}</td>
      <td className="p-3 text-foreground border border-border truncate max-w-[200px]">
        {item.description}
      </td>
      <td className="p-3 text-foreground border border-border">{item.unit}</td>
      <td className="p-3 text-foreground border border-border">{item.qty}</td>
      <td className="p-3 text-foreground border border-border">{item.qtyRemaining}</td>
      <td className="p-3 text-foreground border border-border font-medium">{proposedQty ?? ''}</td>
      <td className="p-3 text-foreground border border-border">
        {formatCurrency(item.pricePerUnit)}
      </td>
      <td className="p-3 text-foreground border border-border font-medium">
        {proposedPrice !== undefined ? formatCurrency(proposedPrice) : ''}
      </td>
      <td className="p-3 border border-border">
        <div className="flex items-center justify-center">
          <MessageIcon className="w-4 h-4 text-muted-foreground" />
        </div>
      </td>
    </tr>
  );
}
