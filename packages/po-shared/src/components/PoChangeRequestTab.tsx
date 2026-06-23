import { approvePoChange, rejectPoChange, type PoChangeRequest } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Button,
  GridModal,
  Spinner,
  Textarea,
  formatDateTime,
  notificationService,
} from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { PoChangeDiff } from './PoChangeDiff';

interface PoChangeRequestTabProps {
  poId: string;
  /** The pending change request to render (status PENDING). */
  changeRequest: PoChangeRequest;
  /** Resolve deliveryLocationId → label for the diff. */
  locationOptions?: { value: string; label: string }[];
  /**
   * Current user's display name. Apply all / Reject are hidden when it matches
   * the request's `requestedByName` (the backend also forbids self-approve, so
   * this is a UX guard, not the security boundary).
   */
  currentUserName?: string | null;
}

/**
 * FLOW 3 — PO detail "Changes request" tab (SPEC FLOW 3 / pc5).
 *
 * Renders the pending change request as a card: header
 * "{reference} · Suggested {company} ({user}) · {datetime}" with **Apply all**
 * (approve) and **Reject** on the right, and the shared diff below. Approving
 * calls `approvePoChange`; rejecting opens a reason modal then `rejectPoChange`.
 * Both invalidate the PO + change-request queries so the detail refreshes (the
 * tab disappears once no pending CR remains, and the resolved CR surfaces in the
 * Action log).
 */
export function PoChangeRequestTab({
  poId,
  changeRequest,
  locationOptions,
  currentUserName,
}: PoChangeRequestTabProps) {
  const { t } = useTranslation('purchaseOrders');
  const queryClient = useQueryClient();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['purchase-orders', poId] });
    void queryClient.invalidateQueries({ queryKey: ['po-change-requests', poId] });
  };

  const approveMutation = useMutation({
    mutationFn: () => approvePoChange(poId, changeRequest.id),
    onSuccess: () => {
      notificationService.success(t('changeRequestTab.applied'));
      invalidate();
    },
    onError: () => notificationService.error(t('changeRequestTab.applyError')),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectPoChange(poId, changeRequest.id, reason.trim() || undefined),
    onSuccess: () => {
      notificationService.success(t('changeRequestTab.rejected'));
      setShowReject(false);
      setReason('');
      invalidate();
    },
    onError: () => notificationService.error(t('changeRequestTab.rejectError')),
  });

  const isProposer = Boolean(currentUserName) && currentUserName === changeRequest.requestedByName;
  const canResolve = !isProposer;

  const company = changeRequest.requestedByCompanyName ?? '';
  const requester = changeRequest.requestedByName ?? '';

  const hasChanges =
    Object.keys(changeRequest.changedFields?.fields ?? {}).length > 0 ||
    (changeRequest.changedFields?.lineItems ?? []).length > 0;

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      {/* Card header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-bold text-foreground">{changeRequest.reference ?? '-'}</span>
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{t('changeRequestTab.suggestedBy')}</span>{' '}
            {t('changeRequestTab.by', { company, name: requester })}
          </span>
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{t('changeRequestTab.timeAndDate')}</span>{' '}
            {formatDateTime(changeRequest.createdAt)}
          </span>
        </div>

        {canResolve && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<CheckCircleIcon className="w-4 h-4" />}
              isLoading={approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
            >
              {t('changeRequestTab.applyAll')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<CrossIcon className="w-3.5 h-3.5" />}
              onClick={() => setShowReject(true)}
            >
              {t('changeRequestTab.reject')}
            </Button>
          </div>
        )}
      </div>

      {/* Diff body */}
      <div className="rounded-lg border border-border p-4">
        {hasChanges ? (
          <PoChangeDiff
            changedFields={changeRequest.changedFields}
            locationOptions={locationOptions}
            lineItemsAsCards
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t('changeRequestTab.noChanges')}</p>
        )}
        {changeRequest.message && (
          <p className="mt-4 text-sm text-foreground">{changeRequest.message}</p>
        )}
      </div>

      {/* Reject reason modal */}
      {showReject && (
        <GridModal
          onClose={() => setShowReject(false)}
          icon={<CrossIcon className="size-6 text-destructive" />}
          title={t('changeRequestTab.rejectTitle')}
          description={t('changeRequestTab.rejectDescription')}
          actionsClassName="flex-row"
          actions={
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowReject(false)}
                disabled={rejectMutation.isPending}
              >
                {t('changeRequestTab.rejectCancel')}
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => rejectMutation.mutate()}
                isLoading={rejectMutation.isPending}
              >
                {t('changeRequestTab.rejectConfirm')}
              </Button>
            </>
          }
        >
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('changeRequestTab.rejectReasonPlaceholder')}
            rows={4}
          />
        </GridModal>
      )}
    </div>
  );
}

/** Loading placeholder while the change requests query resolves. */
export function PoChangeRequestTabLoading() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="md" />
    </div>
  );
}
