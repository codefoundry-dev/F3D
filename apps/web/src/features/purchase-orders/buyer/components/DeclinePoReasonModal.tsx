import { declinePurchaseOrder } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { GridModal, Textarea, Button } from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

interface DeclinePoReasonModalProps {
  poId: string;
  onClose: () => void;
  /** Called after a successful decline so the caller can refresh its data. */
  onDeclined?: () => void;
}

/**
 * Contractor/approver decline of a purchase order. The backend requires a
 * non-empty reason (Week-3 reason capture), so the confirm button stays disabled
 * until one is entered; the reason is persisted on the PO and recorded in its
 * audit trail.
 */
export function DeclinePoReasonModal({ poId, onClose, onDeclined }: DeclinePoReasonModalProps) {
  const { t } = useTranslation('purchaseOrders');
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  const mutation = useMutation({
    mutationFn: () => declinePurchaseOrder(poId, { reason: trimmed }),
    onSuccess: () => {
      onDeclined?.();
      onClose();
    },
  });

  return (
    <GridModal
      onClose={onClose}
      icon={<CrossInCircleIcon className="size-6 text-destructive" />}
      title={t('decline.title', 'Decline Purchase Order')}
      description={t(
        'decline.descriptionRequired',
        'Please provide a reason for declining this purchase order. It will be recorded on the order.',
      )}
      actions={
        <>
          <Button
            variant="destructive"
            size="lg"
            onClick={() => mutation.mutate()}
            isLoading={mutation.isPending}
            disabled={!trimmed}
            className="w-full"
          >
            {t('decline.confirm', 'Decline PO')}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onClose}
            disabled={mutation.isPending}
            className="w-full"
          >
            {t('decline.cancel', 'Cancel')}
          </Button>
        </>
      }
    >
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('decline.reasonPlaceholder', 'Enter reason for declining...')}
        rows={4}
      />
    </GridModal>
  );
}
