import type { BulkOrderChangeRequest } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Alert, Button, formatDate, notificationService } from '@forethread/ui-components';
import CheckIcon from '@forethread/ui-components/assets/icons/checkmark.svg?react';
import ClockIcon from '@forethread/ui-components/assets/icons/clock-icon.svg?react';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';

import { useApproveChange, useRejectChange } from '../services/bulk-orders.service';

export interface InlineExtensionReviewProps {
  bulkOrderId: string;
  changeRequest: BulkOrderChangeRequest;
}

/**
 * Inline review of a pending end-date extension, shown to the approver
 * (the non-proposer, i.e. the vendor) on the bulk order detail page (bo6).
 * Approve applies the new endDate; reject dismisses the request.
 */
export function InlineExtensionReview({ bulkOrderId, changeRequest }: InlineExtensionReviewProps) {
  const { t } = useTranslation('bulkOrders');
  const approve = useApproveChange();
  const reject = useRejectChange();

  const newEndDate = (changeRequest.changes as { endDate?: string }).endDate ?? null;
  const note = changeRequest.message;
  const isBusy = approve.isPending || reject.isPending;

  const handleApprove = () => {
    approve.mutate(
      { bulkOrderId, changeRequestId: changeRequest.id },
      {
        onSuccess: () => notificationService.success(t('extension.review.approveSuccess')),
        onError: () => notificationService.error(t('extension.review.approveError')),
      },
    );
  };

  const handleReject = () => {
    reject.mutate(
      { bulkOrderId, changeRequestId: changeRequest.id },
      {
        onSuccess: () => notificationService.success(t('extension.review.rejectSuccess')),
        onError: () => notificationService.error(t('extension.review.rejectError')),
      },
    );
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <Alert variant="info" icon={<ClockIcon className="w-5 h-5" />} className="flex-1">
        <p className="mb-3">{t('extension.review.banner')}</p>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-x-4 gap-y-1">
            <span className="text-xs text-muted-foreground">
              {t('extension.review.newEndDate')} :
            </span>
            <span className="text-sm text-foreground">
              {newEndDate ? formatDate(newEndDate) : '-'}
            </span>
            {note && (
              <>
                <span className="text-xs text-muted-foreground">{t('extension.review.note')}:</span>
                <span className="text-sm text-foreground">{note}</span>
              </>
            )}
          </div>
        </div>
      </Alert>

      <div className="flex items-center gap-3 shrink-0">
        <Button
          variant="primary"
          size="md"
          className="h-12 gap-2"
          disabled={isBusy}
          onClick={handleApprove}
        >
          <CheckIcon className="w-5 h-5" />
          {t('extension.review.submit')}
        </Button>
        <Button
          variant="outline"
          size="md"
          className="h-12 gap-2"
          disabled={isBusy}
          onClick={handleReject}
        >
          <CrossIcon className="w-4 h-4" />
          {t('extension.review.cancel')}
        </Button>
      </div>
    </div>
  );
}
