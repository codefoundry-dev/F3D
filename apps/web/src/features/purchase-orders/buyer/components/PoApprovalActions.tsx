import { approvePurchaseOrder } from '@forethread/api-client';
import type { PoDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Button, notificationService } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { DeclinePoReasonModal } from './DeclinePoReasonModal';

interface PoApprovalActionsProps {
  po: PoDetail;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Approver-facing Approve / Decline actions for a PENDING_APPROVAL PO, surfaced
 * on the PO detail page so an approver who opens the order directly (not via the
 * dashboard "Awaiting approval" card) can still action it. Mirrors the dashboard
 * card actions: Approve hits `PATCH /:id/approve`; Decline opens the reason modal
 * (`PATCH /:id/decline`, reason required). On success the PO detail query is
 * invalidated so the page refetches the new status and these buttons drop away.
 *
 * Render only when the caller has confirmed `po.status === 'PENDING_APPROVAL'`
 * and the user holds `po.approve`; the status guard is repeated here for safety.
 */
export function PoApprovalActions({ po, size = 'sm' }: PoApprovalActionsProps) {
  const { t } = useTranslation('purchaseOrders');
  const queryClient = useQueryClient();
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
    onError: () => {
      notificationService.error(t('send.approveFailed'));
    },
  });

  if (po.status !== 'PENDING_APPROVAL') return null;

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
      <Button
        type="button"
        variant="primary"
        size={size}
        leftIcon={<CheckCircleIcon className="w-4 h-4" />}
        isLoading={approveMutation.isPending}
        onClick={() => approveMutation.mutate()}
      >
        {t('actions.approve')}
      </Button>
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
