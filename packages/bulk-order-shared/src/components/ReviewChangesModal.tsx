import type { BulkOrderChangeRequest } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Modal,
  ModalBody,
  ModalCloseButton,
  Input,
  FormField,
  Button,
  Alert,
  IconBadge,
  formatDate,
  formatCurrency,
} from '@forethread/ui-components';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import { useState } from 'react';

import { useApproveChange, useRejectChange } from '../services/bulk-orders.service';

export interface ReviewChangesModalProps {
  bulkOrderId: string;
  changeRequest: BulkOrderChangeRequest;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReviewChangesModal({
  bulkOrderId,
  changeRequest,
  onClose,
  onSuccess,
}: ReviewChangesModalProps) {
  const { t: _t } = useTranslation(['bulkOrders', 'common']);
  const t = _t as (key: string, opts?: Record<string, unknown>) => string;
  const approveMutation = useApproveChange();
  const rejectMutation = useRejectChange();
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const changes = changeRequest.changes as {
    endDate?: string | null;
    lineItems?: Array<{
      action: string;
      lineItemId?: string;
      itemReference?: string;
      description?: string;
      unitPrice?: number;
      quantity?: number;
    }>;
  };

  const changeSummary: string[] = [];
  if (changes.endDate) {
    changeSummary.push(`Expiration date → ${formatDate(changes.endDate)}`);
  }
  if (changes.lineItems?.length) {
    for (const li of changes.lineItems) {
      const name = li.itemReference || li.description || 'Item';
      if (li.action === 'remove') changeSummary.push(`${name}: removed`);
      else if (li.action === 'add') changeSummary.push(`${name}: added`);
      else {
        if (li.unitPrice !== undefined)
          changeSummary.push(`${name} price → ${formatCurrency(li.unitPrice)}`);
        if (li.quantity !== undefined) changeSummary.push(`${name} qty → ${li.quantity}`);
      }
    }
  }

  const isPending = approveMutation.isPending || rejectMutation.isPending;

  const handleApprove = () => {
    approveMutation.mutate(
      { bulkOrderId, changeRequestId: changeRequest.id },
      {
        onSuccess: () => {
          onSuccess?.();
          onClose();
        },
      },
    );
  };

  const handleReject = () => {
    rejectMutation.mutate(
      { bulkOrderId, changeRequestId: changeRequest.id, reason: rejectReason || undefined },
      {
        onSuccess: () => {
          onSuccess?.();
          onClose();
        },
      },
    );
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-[560px]">
      <ModalBody>
        <div className="space-y-5">
          <div className="flex flex-col items-center text-center mb-2">
            <div className="w-full flex justify-between items-start">
              <div className="flex-1" />
              <IconBadge icon={<EditIcon className="w-6 h-6 text-foreground" />} />
              <div className="flex-1 flex justify-end">
                <ModalCloseButton onClose={onClose} />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-foreground mt-4">
              {t('changeRequests.reviewModal.title')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('changeRequests.reviewModal.subtitle')}
            </p>
          </div>

          {/* Proposed by info */}
          <p className="text-sm text-muted-foreground">
            {t('changeRequests.proposedBy', {
              name: changeRequest.requestedBy.name,
              date: formatDate(changeRequest.createdAt),
            })}
          </p>

          {changeRequest.message && (
            <p className="text-sm text-foreground italic">&ldquo;{changeRequest.message}&rdquo;</p>
          )}

          {/* Changes summary */}
          <div className="rounded-lg bg-muted p-3">
            <h3 className="text-sm font-semibold text-foreground mb-2">
              {t('changeRequests.reviewModal.proposedChanges')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {changeSummary.map((s, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-full bg-foreground/15 px-2 py-0.5 text-sm text-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {(approveMutation.isError || rejectMutation.isError) && (
            <Alert variant="destructive">
              {approveMutation.isError
                ? t('changeRequests.approveError')
                : t('changeRequests.rejectError')}
            </Alert>
          )}

          {showRejectForm && (
            <FormField label={t('changeRequests.reviewModal.rejectReason')}>
              <Input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t('changeRequests.reviewModal.rejectReasonPlaceholder')}
              />
            </FormField>
          )}

          <div className="flex flex-col gap-3 pt-2">
            {!showRejectForm ? (
              <>
                <Button
                  isLoading={approveMutation.isPending}
                  disabled={isPending}
                  onClick={handleApprove}
                  className="w-full"
                >
                  {t('changeRequests.actions.approve')}
                </Button>
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setShowRejectForm(true)}
                  className="w-full"
                >
                  {t('changeRequests.actions.reject')}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="destructive"
                  isLoading={rejectMutation.isPending}
                  disabled={isPending}
                  onClick={handleReject}
                  className="w-full"
                >
                  {t('changeRequests.rejectModal.confirm')}
                </Button>
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setShowRejectForm(false)}
                  className="w-full"
                >
                  {t('modals.cancel')}
                </Button>
              </>
            )}
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
