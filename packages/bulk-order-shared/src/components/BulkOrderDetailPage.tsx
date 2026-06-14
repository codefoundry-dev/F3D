import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { Button, Spinner, Alert, formatDate, notificationService } from '@forethread/ui-components';
import CalendarIcon from '@forethread/ui-components/assets/icons/date.svg?react';
import ClockIcon from '@forethread/ui-components/assets/icons/clock-icon.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
import LetterIcon from '@forethread/ui-components/assets/icons/letter.svg?react';
import MarkIcon from '@forethread/ui-components/assets/icons/mark-with-cyrcle.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

import { BULK_ORDER_ROUTES } from '../constants/routes';
import { useBulkOrder, useChangeRequests } from '../services/bulk-orders.service';

import { BulkOrderDetailTabs, type BulkOrderTab } from './BulkOrderDetailTabs';
import { BulkOrderLineItemsTable } from './BulkOrderLineItemsTable';
import { CancelBulkOrderModal } from './CancelBulkOrderModal';
import { ChangeHistoryTab } from './ChangeHistoryTab';
import { DetailField } from './DetailField';
import { DrawdownHistoryTab } from './DrawdownHistoryTab';
import { InlineExtensionReview } from './InlineExtensionReview';
import { ProposeExtensionModal } from './ProposeExtensionModal';

/** True when the only thing a change request changes is the bulk order end date (an extension). */
function isEndDateOnlyChange(changes: Record<string, unknown>): boolean {
  const lineItems = changes.lineItems as unknown[] | undefined;
  return !!changes.endDate && (!lineItems || lineItems.length === 0);
}

export interface BulkOrderDetailPageProps {
  /** Label for the counterparty field, e.g. "Contractor" or "Vendor" */
  counterpartyLabel?: string;
  /** Show "Create drawdown" button (contractor only) */
  showDrawdown?: boolean;
  /** Show "Change" / "Review" / "Cancel" change request actions */
  showChangeActions?: boolean;
  /** True when rendered inside the vendor app — flips approval labels */
  isVendorView?: boolean;
  /** Current logged-in user ID — used to determine proposer vs reviewer */
  currentUserId?: string;
}

export function BulkOrderDetailPage({
  counterpartyLabel,
  showDrawdown = true,
  showChangeActions = true,
  isVendorView = false,
  currentUserId,
}: BulkOrderDetailPageProps) {
  const { t } = useTranslation('bulkOrders');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useBulkOrder(id ?? '');
  const { data: changeRequests, isLoading: crLoading } = useChangeRequests(id ?? '');
  const setTitle = usePageTitleStore((s) => s.setTitle);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as BulkOrderTab | null;
  const VALID_TABS: BulkOrderTab[] = ['lineItems', 'drawdownHistory', 'changeHistory'];
  const activeTab: BulkOrderTab =
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'lineItems';

  const setActiveTab = useCallback(
    (tab: BulkOrderTab) => {
      setSearchParams(tab === 'lineItems' ? {} : { tab }, { replace: true });
    },
    [setSearchParams],
  );

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);

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

  const counterpartyValue = counterpartyLabel?.toLowerCase().includes('vendor')
    ? data.vendorName
    : data.contractorName;

  const pendingCr = changeRequests?.find((cr) => cr.status === 'PENDING');
  const hasPendingChange = !!pendingCr;
  const isProposer = !!(pendingCr && currentUserId && pendingCr.requestedBy.id === currentUserId);
  const isActive = data.status === 'ACTIVE' || data.status === 'CHANGE_PENDING';

  // An end-date-only pending change is an extension: the approver (non-proposer,
  // i.e. the vendor) reviews it inline rather than on a separate page (bo6).
  const pendingExtension =
    pendingCr && isEndDateOnlyChange(pendingCr.changes) ? pendingCr : undefined;
  const showInlineExtensionReview = !!pendingExtension && !isProposer;

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Inline extension review (bo6) — approver reviews an end-date extension */}
      {showInlineExtensionReview && pendingExtension && (
        <InlineExtensionReview bulkOrderId={id!} changeRequest={pendingExtension} />
      )}

      {/* Pending change alert + action buttons (line-item change requests) */}
      {hasPendingChange && !showInlineExtensionReview && (
        <div className="flex items-center justify-between gap-4">
          <Alert variant="info" icon={<ClockIcon className="w-5 h-5" />} className="flex-1">
            {isProposer
              ? isVendorView
                ? t('changeRequests.pendingAlertContractor')
                : t('changeRequests.pendingAlertVendor')
              : t('changeRequests.pendingAlertReviewer')}
          </Alert>
          {showChangeActions && (
            <div className="flex items-center gap-3 shrink-0">
              {!isProposer && (
                <Button
                  variant="primary"
                  size="md"
                  className="h-12 gap-2"
                  onClick={() =>
                    navigate(BULK_ORDER_ROUTES.bulkOrderReviewChange.replace(':id', id!))
                  }
                >
                  <LetterIcon className="w-5 h-5" />
                  {t('changeRequests.reviewChanges')}
                </Button>
              )}
              <Button
                variant="outline"
                size="md"
                className="h-12 gap-2"
                onClick={() => setShowCancelModal(true)}
              >
                <MarkIcon className="w-5 h-5" />
                {t('changeRequests.cancelChangeRequest')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-6 justify-start">
        {showDrawdown && (
          <Button
            variant="primary"
            size="lg"
            leftIcon={<PlusIcon className="w-6 h-6" />}
            onClick={() => navigate(BULK_ORDER_ROUTES.bulkOrderDrawdown.replace(':id', id!))}
          >
            {t('detail.createDrawdown')}
          </Button>
        )}
        {showChangeActions && isActive && !hasPendingChange && (
          <>
            <Button
              variant="outline"
              size="lg"
              leftIcon={<EditIcon style={{ width: '18.75px', height: '18.75px' }} />}
              onClick={() => navigate(BULK_ORDER_ROUTES.bulkOrderChange.replace(':id', id!))}
            >
              {t('detail.change')}
            </Button>
            <Button
              variant="outline"
              size="lg"
              leftIcon={<CalendarIcon className="w-5 h-5" />}
              onClick={() => setShowExtensionModal(true)}
            >
              {t('detail.proposeExtension')}
            </Button>
          </>
        )}
      </div>

      {/* Bulk Details */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-base font-bold text-foreground mb-4">{t('detail.bulkDetails')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4">
          <DetailField label={t('detail.bulkId')} value={data.bulkId} />
          <DetailField
            label={t('detail.status')}
            value={data.status ? (t(`status.${data.status}` as never) as string) : '-'}
          />
          <DetailField
            label={counterpartyLabel ?? t('detail.contractorName')}
            value={counterpartyValue}
          />
          <DetailField label={t('detail.projectName')} value={data.projectName} />
          <DetailField label={t('detail.createdDate')} value={formatDate(data.createdDate)} />
          <DetailField label={t('detail.validUntil')} value={formatDate(data.endDate)} />
          <DetailField label={t('detail.rfqReference')} value={data.rfqReference ?? '-'} />
          <DetailField label={t('detail.createdBy')} value={data.createdBy} />
        </div>
      </div>

      {/* Tabs */}
      <BulkOrderDetailTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div>
        {activeTab === 'lineItems' && <BulkOrderLineItemsTable lineItems={data.lineItems} />}
        {activeTab === 'drawdownHistory' && (
          <DrawdownHistoryTab drawdowns={data.drawdowns ?? []} isLoading={isLoading} />
        )}
        {activeTab === 'changeHistory' && (
          <ChangeHistoryTab
            changeRequests={changeRequests ?? []}
            isLoading={crLoading}
            rfqReference={data.rfqReference}
            isVendorView={isVendorView}
            currentEndDate={data.endDate}
            lineItems={data.lineItems}
          />
        )}
      </div>

      {/* Modals */}
      {showCancelModal && (
        <CancelBulkOrderModal
          bulkOrderId={id!}
          onClose={() => setShowCancelModal(false)}
          onSuccess={() => notificationService.success(t('cancel.success'))}
        />
      )}
      {showExtensionModal && (
        <ProposeExtensionModal
          bulkOrderId={id!}
          bulkNumber={data.bulkId}
          currentValidUntil={data.endDate}
          onClose={() => setShowExtensionModal(false)}
        />
      )}
    </div>
  );
}
