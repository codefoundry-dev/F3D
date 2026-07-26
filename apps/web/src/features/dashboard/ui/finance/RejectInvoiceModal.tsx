import { useTranslation } from '@forethread/i18n';
import { Button, GridModal, Textarea } from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import { useState } from 'react';

interface RejectInvoiceModalProps {
  onClose: () => void;
  /** Called with the trimmed reason when the user confirms. */
  onConfirm: (reason: string) => void;
  isSubmitting?: boolean;
}

/**
 * Capture the discrepancy note when rejecting an invoice (US 8.05 / 8.06). The
 * reason is persisted on the invoice and quoted back to the vendor in the
 * rejection email, so it is required rather than optional — a rejection the
 * vendor cannot act on is not much of a notification. Mirrors
 * `RejectDeliveryModal`, the other reject-with-reason flow.
 */
export function RejectInvoiceModal({ onClose, onConfirm, isSubmitting }: RejectInvoiceModalProps) {
  const { t } = useTranslation('dashboard');
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  return (
    <GridModal
      onClose={onClose}
      icon={<CrossInCircleIcon className="size-6 text-destructive" />}
      title={t('invoicesPendingApproval.rejectTitle')}
      description={t('invoicesPendingApproval.rejectDescription')}
      actions={
        <>
          <Button
            variant="primary"
            size="lg"
            onClick={() => onConfirm(trimmed)}
            disabled={!trimmed}
            isLoading={isSubmitting}
            className="w-full"
            data-testid="invoice-reject-confirm"
          >
            {t('invoicesPendingApproval.rejectConfirm')}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full"
          >
            {t('invoicesPendingApproval.cancel')}
          </Button>
        </>
      }
    >
      <Textarea
        rows={4}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('invoicesPendingApproval.rejectPlaceholder')}
        aria-label={t('invoicesPendingApproval.rejectTitle')}
        data-testid="invoice-reject-reason"
      />
    </GridModal>
  );
}
