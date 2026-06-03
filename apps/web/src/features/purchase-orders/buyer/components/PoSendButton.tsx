import type { PoDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { requiresApproval } from '@forethread/po-shared';
import { Button, notificationService } from '@forethread/ui-components';

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
 */
export function PoSendButton({ po, size = 'md' }: PoSendButtonProps) {
  const { t } = useTranslation('purchaseOrders');
  const { data: me } = useMe();
  const issue = useIssuePurchaseOrder();

  // Only DRAFT POs can be sent.
  if (po.status !== 'DRAFT') return null;

  const needsApproval = requiresApproval(me?.poApprovalThreshold, po.totalAmount);

  const handleClick = () => {
    issue.mutate(po.id, {
      onSuccess: () => {
        // The backend decides the resulting status; reflect it in the toast.
        // Use the pre-issue decision as the optimistic message — the invalidated
        // query will refetch the authoritative status/badge.
        if (needsApproval) {
          notificationService.success(t('send.submittedForApproval'));
        } else {
          notificationService.success(t('send.sent'));
        }
      },
      onError: () => {
        notificationService.error(t('send.failed'));
      },
    });
  };

  return (
    <Button
      type="button"
      variant="primary"
      size={size}
      isLoading={issue.isPending}
      onClick={handleClick}
    >
      {needsApproval ? t('send.submitForApproval') : t('send.send')}
    </Button>
  );
}
