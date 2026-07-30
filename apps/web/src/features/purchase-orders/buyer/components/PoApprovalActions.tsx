import { approvePurchaseOrder } from '@forethread/api-client';
import type { PoDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { requiresApproval } from '@forethread/po-shared';
import { Button, Tooltip, notificationService } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';

import { useMe } from '../services/purchase-orders.service';

import { DeclinePoReasonModal } from './DeclinePoReasonModal';

interface PoApprovalActionsProps {
  po: PoDetail;
  size?: 'sm' | 'md' | 'lg';
}

/** Pull a human message off an axios error, falling back to a translated default. */
function errorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    const message = data?.message;
    if (Array.isArray(message)) return message[0] ?? fallback;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

/**
 * Approver-facing Approve / Decline actions for a PENDING_APPROVAL PO, surfaced
 * on the PO detail page so an approver who opens the order directly (not via the
 * dashboard "Awaiting approval" card) can still action it. Mirrors the dashboard
 * card actions: Approve hits `PATCH /:id/approve`; Decline opens the reason modal
 * (`PATCH /:id/decline`, reason required). On success the PO detail query is
 * invalidated so the page refetches the new status and these buttons drop away.
 *
 * FOR-286: a viewer whose `poApprovalThreshold` is below the PO total sees the
 * Approve button disabled with an over-limit explanation instead of a silent
 * 403 — the backend enforces the same cap authoritatively. Decline stays
 * available: rejecting an order does not need spend authority.
 *
 * Render only when the caller has confirmed `po.status === 'PENDING_APPROVAL'`
 * and the user holds `po.approve`; the status guard is repeated here for safety.
 */
export function PoApprovalActions({ po, size = 'sm' }: PoApprovalActionsProps) {
  const { t } = useTranslation('purchaseOrders');
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [showDeclineModal, setShowDeclineModal] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['purchase-orders', po.id] });
    void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard', 'po-ca'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard', 'awaiting-approval'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => approvePurchaseOrder(po.id),
    onSuccess: () => {
      invalidate();
      notificationService.success(t('send.approved'));
    },
    onError: (error) => {
      // Surface the backend's message (e.g. the over-limit explanation with the
      // configured cap) rather than a generic failure.
      notificationService.error(errorMessage(error, t('send.approveFailed')));
    },
  });

  if (po.status !== 'PENDING_APPROVAL') return null;

  // `me` still loading resolves to false (enabled button) — the backend cap check
  // remains the authority and its message is surfaced via the error toast.
  const overLimit = requiresApproval(me?.poApprovalThreshold, po.totalAmount);
  const overLimitMessage = overLimit
    ? t('send.overApprovalLimit', {
        amount: (po.totalAmount ?? 0).toLocaleString(),
        limit: (me?.poApprovalThreshold ?? 0).toLocaleString(),
        currency: po.currency,
      })
    : null;

  const approveButton = (
    <Button
      type="button"
      variant="primary"
      size={size}
      leftIcon={<CheckCircleIcon className="w-4 h-4" />}
      isLoading={approveMutation.isPending}
      disabled={overLimit}
      onClick={() => approveMutation.mutate()}
      data-testid="po-approve-button"
    >
      {t('actions.approve')}
    </Button>
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        leftIcon={<CrossInCircleIcon className="w-4 h-4" />}
        disabled={approveMutation.isPending}
        onClick={() => setShowDeclineModal(true)}
      >
        {t('actions.decline')}
      </Button>
      {overLimitMessage ? (
        // Disabled buttons swallow pointer events, so the tooltip hangs off a
        // wrapping span instead of the button itself. side="left" keeps the
        // bubble inside the viewport (the button sits at the page's right edge).
        <Tooltip content={overLimitMessage} side="left">
          <span className="inline-flex" data-testid="po-approve-over-limit">
            {approveButton}
          </span>
        </Tooltip>
      ) : (
        approveButton
      )}
      {showDeclineModal && (
        <DeclinePoReasonModal
          poId={po.id}
          onClose={() => setShowDeclineModal(false)}
          onDeclined={invalidate}
        />
      )}
    </>
  );
}
