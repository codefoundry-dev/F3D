import type { PoDetail } from '@forethread/api-client';
import { NominateApproversModal } from '@forethread/approval-shared';
import { useTranslation } from '@forethread/i18n';
import { requiresApproval } from '@forethread/po-shared';
import { Button, notificationService } from '@forethread/ui-components';
import { useState } from 'react';

import { useMe, useIssuePurchaseOrder } from '../services/purchase-orders.service';

interface PoSendButtonProps {
  po: PoDetail;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * FOR-210: approval-gated Send action for a DRAFT PO.
 *
 * Reads the current user's `poApprovalThreshold` to label the button:
 *   - "Send"                → within threshold / unlimited authority
 *   - "Submit for Approval" → over threshold / no self-approval grant
 *
 * Both labels call the SAME `POST /:id/issue`; the backend routes the PO to
 * SENT or PENDING_APPROVAL. The success toast is chosen from the returned
 * status after the PO query is invalidated and refetched.
 *
 * FOR-306: the "Submit for Approval" path opens a confirm modal first, so the
 * creator can see the Approver Pool and optionally point the request at
 * specific people. "Notify everyone" is preselected, so confirming without
 * touching anything reproduces the old broadcast exactly. The direct-send path
 * is unchanged — there is no approver to choose.
 */
export function PoSendButton({ po, size = 'md' }: PoSendButtonProps) {
  const { t } = useTranslation('purchaseOrders');
  const { data: me } = useMe();
  const issue = useIssuePurchaseOrder();
  const [showNominate, setShowNominate] = useState(false);

  // Only DRAFT POs can be sent. A SPLIT parent is a vendorless container — its
  // per-vendor child POs are issued individually, never the parent (US 5.19).
  if (po.status !== 'DRAFT' || po.poType === 'SPLIT') return null;

  const needsApproval = requiresApproval(me?.poApprovalThreshold, po.totalAmount);

  const submit = (nomineeIds?: string[]) => {
    issue.mutate(
      { id: po.id, nomineeIds },
      {
        onSuccess: () => {
          setShowNominate(false);
          // The backend decides the resulting status; reflect it in the toast.
          // Use the pre-issue decision as the optimistic message — the
          // invalidated query will refetch the authoritative status/badge.
          if (needsApproval) {
            notificationService.success(t('send.submittedForApproval'));
          } else {
            notificationService.success(t('send.sent'));
          }
        },
        onError: () => {
          notificationService.error(t('send.failed'));
        },
      },
    );
  };

  return (
    <>
      <Button
        type="button"
        variant="primary"
        size={size}
        isLoading={issue.isPending && !showNominate}
        onClick={() => (needsApproval ? setShowNominate(true) : submit())}
      >
        {needsApproval ? t('send.submitForApproval') : t('send.send')}
      </Button>

      {showNominate && (
        <NominateApproversModal
          entityType="PURCHASE_ORDER"
          entityId={po.id}
          mode="submit"
          isSubmitting={issue.isPending}
          onClose={() => setShowNominate(false)}
          onConfirm={submit}
        />
      )}
    </>
  );
}
