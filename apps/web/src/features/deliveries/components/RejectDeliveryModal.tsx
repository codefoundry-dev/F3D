import { useTranslation } from '@forethread/i18n';
import { GridModal, Button, Textarea } from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import { useState } from 'react';

interface RejectDeliveryModalProps {
  onClose: () => void;
  /** Called with the trimmed reason when the user confirms. */
  onConfirm: (reason: string) => void;
  isSubmitting?: boolean;
}

/**
 * Reject a delivery report (screenshot 04). DS grid modal with the centered icon
 * header + reason textarea + stacked Confirm/Cancel. The reason is stored on the
 * report; the PO status is explicitly NOT affected (copy mirrors the design).
 */
export function RejectDeliveryModal({
  onClose,
  onConfirm,
  isSubmitting,
}: RejectDeliveryModalProps) {
  const { t } = useTranslation('deliveries');
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  return (
    <GridModal
      onClose={onClose}
      icon={<CrossInCircleIcon className="size-6 text-destructive" />}
      title={t('review.rejectTitle')}
      description={t('review.rejectDescription')}
      actions={
        <>
          <Button
            variant="primary"
            size="lg"
            onClick={() => onConfirm(trimmed)}
            disabled={!trimmed}
            isLoading={isSubmitting}
            className="w-full"
            data-testid="delivery-reject-confirm"
          >
            {t('review.confirm')}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full"
          >
            {t('review.cancel')}
          </Button>
        </>
      }
    >
      <Textarea
        rows={4}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('review.rejectPlaceholder')}
        aria-label={t('review.rejectTitle')}
        data-testid="delivery-reject-reason"
      />
    </GridModal>
  );
}
