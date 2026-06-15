import { declinePurchaseOrder } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  Button,
} from '@forethread/ui-components';
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
    <Modal onClose={onClose}>
      <ModalHeader onClose={onClose}>{t('decline.title', 'Decline Purchase Order')}</ModalHeader>
      <ModalBody>
        <p className="text-sm text-muted-foreground mb-4">
          {t(
            'decline.descriptionRequired',
            'Please provide a reason for declining this purchase order. It will be recorded on the order.',
          )}
        </p>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('decline.reasonPlaceholder', 'Enter reason for declining...')}
          rows={4}
        />
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
          {t('decline.cancel', 'Cancel')}
        </Button>
        <Button
          variant="destructive"
          onClick={() => mutation.mutate()}
          isLoading={mutation.isPending}
          disabled={!trimmed}
        >
          {t('decline.confirm', 'Decline PO')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
