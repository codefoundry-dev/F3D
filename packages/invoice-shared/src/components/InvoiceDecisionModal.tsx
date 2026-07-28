import { useTranslation } from '@forethread/i18n';
import { Alert, Button, FormField, GridModal, Textarea } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import { useState } from 'react';

export interface InvoiceDecisionModalProps {
  /** Approve records an optional note; decline requires a reason (FOR-294). */
  mode: 'approve' | 'decline';
  isPending: boolean;
  isError: boolean;
  onConfirm: (reason: string | undefined) => void;
  onClose: () => void;
}

/**
 * Confirm an invoice state transition (FOR-294). Both directions capture the
 * reviewer's reason for the audit trail: approving takes an optional note,
 * declining insists on one — it is also quoted back to the vendor in the
 * rejection email.
 */
export function InvoiceDecisionModal({
  mode,
  isPending,
  isError,
  onConfirm,
  onClose,
}: InvoiceDecisionModalProps) {
  const { t } = useTranslation('invoices');
  const [reason, setReason] = useState('');

  const isApprove = mode === 'approve';
  const trimmed = reason.trim();
  const canConfirm = isApprove || trimmed.length > 0;

  const handleConfirm = () => {
    if (!canConfirm || isPending) return;
    onConfirm(trimmed === '' ? undefined : trimmed);
  };

  return (
    <GridModal
      onClose={onClose}
      icon={
        isApprove ? (
          <CheckCircleIcon className="size-6 text-foreground" />
        ) : (
          <CrossInCircleIcon className="size-6 text-destructive" />
        )
      }
      title={
        isApprove
          ? t('decision.approveTitle', { defaultValue: 'Approve invoice' })
          : t('decision.declineTitle', { defaultValue: 'Decline invoice' })
      }
      description={
        isApprove
          ? t('decision.approveDescription', {
              defaultValue: 'Approving confirms this invoice is correct and ready for payment.',
            })
          : t('decision.declineDescription', {
              defaultValue:
                'Declining rejects this invoice; your reason is recorded and shared with the vendor.',
            })
      }
      actions={
        <>
          <Button
            variant={isApprove ? 'primary' : 'destructive'}
            size="lg"
            className="w-full"
            isLoading={isPending}
            disabled={!canConfirm}
            onClick={handleConfirm}
            data-testid="invoice-decision-confirm"
          >
            {isApprove
              ? t('decision.approveConfirm', { defaultValue: 'Approve invoice' })
              : t('decision.declineConfirm', { defaultValue: 'Decline invoice' })}
          </Button>
          <Button variant="outline" size="lg" className="w-full" onClick={onClose}>
            {t('decision.cancel', { defaultValue: 'Cancel' })}
          </Button>
        </>
      }
    >
      {isError && (
        <Alert variant="destructive">
          {t('decision.error', { defaultValue: 'Something went wrong. Please try again.' })}
        </Alert>
      )}

      <FormField
        label={
          isApprove
            ? t('decision.approveNoteLabel', { defaultValue: 'Note (optional)' })
            : t('decision.declineReasonLabel', { defaultValue: 'Reason' })
        }
        required={!isApprove}
      >
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            isApprove
              ? t('decision.approveNotePlaceholder', {
                  defaultValue: 'Add a note for the record…',
                })
              : t('decision.declineReasonPlaceholder', {
                  defaultValue: 'Explain why this invoice is being declined…',
                })
          }
          rows={3}
          maxLength={2000}
          data-testid="invoice-decision-reason"
        />
      </FormField>
    </GridModal>
  );
}
