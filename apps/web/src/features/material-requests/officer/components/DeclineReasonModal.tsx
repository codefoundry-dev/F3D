import { useTranslation } from '@forethread/i18n';
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Textarea,
} from '@forethread/ui-components';
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
    <Modal onClose={onClose} maxWidth="max-w-md">
      <ModalHeader onClose={onClose}>{t('declineModal.title')}</ModalHeader>
      <ModalBody>
        <p className="mb-4 text-sm text-muted-foreground">
          {t('declineModal.subtitle', { number: mrNumber })}
        </p>
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
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
          {t('declineModal.cancel')}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          data-testid="mr-decline-confirm"
          disabled={!trimmed || isPending}
          onClick={() => onConfirm(trimmed)}
        >
          {t('declineModal.confirm')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
