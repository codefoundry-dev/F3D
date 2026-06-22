import { useTranslation } from '@forethread/i18n';
import { Button, GridModal, Textarea } from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import { useState } from 'react';

interface DeclineReasonModalProps {
  /** MR number shown in the subtitle. */
  mrNumber: string;
  /** Whether the decline mutation is in flight. */
  isPending?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

/**
 * Decline-with-reason modal (US 2.08). The reason is REQUIRED by the backend —
 * the confirm button stays disabled until the textarea has non-whitespace text.
 */
export function DeclineReasonModal({
  mrNumber,
  isPending,
  onClose,
  onConfirm,
}: DeclineReasonModalProps) {
  const { t } = useTranslation('materialRequests');
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  return (
    <GridModal
      onClose={onClose}
      icon={<CrossInCircleIcon className="size-6 text-destructive" />}
      title={t('declineModal.title')}
      description={t('declineModal.subtitle', { number: mrNumber })}
      actions={
        <>
          <Button
            variant="destructive"
            size="lg"
            data-testid="mr-decline-confirm"
            disabled={!trimmed || isPending}
            isLoading={isPending}
            onClick={() => onConfirm(trimmed)}
            className="w-full"
          >
            {t('declineModal.confirm')}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onClose}
            disabled={isPending}
            className="w-full"
          >
            {t('declineModal.cancel')}
          </Button>
        </>
      }
    >
      <div className="w-full">
        <label
          className="mb-1.5 block text-sm font-medium text-foreground"
          htmlFor="mr-decline-reason"
        >
          {t('declineModal.reasonLabel')}
        </label>
        <Textarea
          id="mr-decline-reason"
          data-testid="mr-decline-reason"
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('declineModal.reasonPlaceholder')}
        />
      </div>
    </GridModal>
  );
}
