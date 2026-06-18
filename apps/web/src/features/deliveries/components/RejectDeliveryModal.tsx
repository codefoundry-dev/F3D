import { useTranslation } from '@forethread/i18n';
import { Modal, ModalIconHeader, Button, Textarea } from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import { useState } from 'react';

interface RejectDeliveryModalProps {
  onClose: () => void;
  /** Called with the trimmed reason when the user confirms. */
  onConfirm: (reason: string) => void;
  isSubmitting?: boolean;
}

/**
 * Reject a delivery report (screenshot 04). Centered icon header + reason
 * textarea + stacked Confirm/Cancel. The reason is stored on the report; the PO
 * status is explicitly NOT affected (copy mirrors the design).
 */
export function RejectDeliveryModal({ onClose, onConfirm, isSubmitting }: RejectDeliveryModalProps) {
  const { t } = useTranslation('deliveries');
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  return (
    <Modal onClose={onClose} maxWidth="max-w-[480px]">
      <div className="p-8 flex flex-col">
        <ModalIconHeader
          icon={<CrossInCircleIcon className="w-6 h-6 text-foreground" />}
          title={t('review.rejectTitle')}
          subtitle={t('review.rejectDescription')}
          onClose={onClose}
          className="mb-6"
        />

        <Textarea
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('review.rejectPlaceholder')}
          aria-label={t('review.rejectTitle')}
          data-testid="delivery-reject-reason"
          className="mb-6"
        />

        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            onClick={() => onConfirm(trimmed)}
            disabled={!trimmed}
            isLoading={isSubmitting}
            className="w-full"
            data-testid="delivery-reject-confirm"
          >
            {t('review.confirm')}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="w-full">
            {t('review.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
