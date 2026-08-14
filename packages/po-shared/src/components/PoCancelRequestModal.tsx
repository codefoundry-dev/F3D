import { useTranslation } from '@forethread/i18n';
import { Button, GridModal, Textarea } from '@forethread/ui-components';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import { useState } from 'react';

interface PoCancelRequestModalProps {
  /** PO number shown in the modal copy. */
  poNumber: string;
  onClose: () => void;
  /** Submit the cancellation request with the (optional) reason. */
  onConfirm: (reason: string) => void;
  isSubmitting?: boolean;
}

/**
 * FOR-352 — request cancellation of a Purchase Order through the change-request
 * workflow. Unlike a direct cancel, the counterparty must approve before the PO
 * actually transitions, so this proposes a `{ cancelPo: true }` change request
 * (the caller supplies the propose mutation). The reason travels as the CR
 * message and becomes the PO's cancellation reason on approval.
 */
export function PoCancelRequestModal({
  poNumber,
  onClose,
  onConfirm,
  isSubmitting,
}: PoCancelRequestModalProps) {
  const { t } = useTranslation('purchaseOrders');
  const [reason, setReason] = useState('');

  return (
    <GridModal
      onClose={onClose}
      icon={<CrossIcon className="size-6 text-destructive" />}
      title={t('cancelRequest.title')}
      description={t('cancelRequest.description', { poNumber })}
      actionsClassName="flex-row"
      actions={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSubmitting}>
            {t('cancelRequest.back')}
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => onConfirm(reason.trim())}
            isLoading={isSubmitting}
          >
            {t('cancelRequest.confirm')}
          </Button>
        </>
      }
    >
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('cancelRequest.reasonPlaceholder')}
        rows={4}
      />
    </GridModal>
  );
}
