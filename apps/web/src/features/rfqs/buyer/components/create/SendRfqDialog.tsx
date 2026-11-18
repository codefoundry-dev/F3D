import { Alert, Button, GridModal } from '@forethread/ui-components';
import PaperPlaneIcon from '@forethread/ui-components/assets/icons/paper-plane.svg?react';
import { useState } from 'react';

import { useRfqCcCandidates } from '../../services/rfqs.service';

import { CcRecipientsDropdown } from './CcRecipientsDropdown';

interface SendRfqDialogProps {
  /** How many vendors will be emailed — drives the confirmation copy. */
  vendorCount: number;
  isSending: boolean;
  isError: boolean;
  onCancel: () => void;
  /** Receives the email addresses of the colleagues picked to CC (may be empty). */
  onSend: (cc: string[]) => void;
}

/**
 * Confirmation dialog for sending an RFQ to its vendors. Sending is
 * outward-facing (it emails vendors a tokenized quote link and opens the RFQ),
 * so we confirm first and offer an optional CC picker (the sender's colleagues)
 * before the irreversible step.
 */
export function SendRfqDialog({
  vendorCount,
  isSending,
  isError,
  onCancel,
  onSend,
}: SendRfqDialogProps) {
  const [cc, setCc] = useState<string[]>([]);
  const { data: candidates = [], isLoading } = useRfqCcCandidates();

  return (
    <GridModal
      onClose={onCancel}
      icon={<PaperPlaneIcon className="size-6 text-gray-700" />}
      title="Send this RFQ?"
      description={`${vendorCount} ${
        vendorCount === 1 ? 'vendor' : 'vendors'
      } will be emailed a secure link to submit their quotes. The RFQ will move from draft to open.`}
      actions={
        <>
          <Button
            type="button"
            className="w-full"
            onClick={() => onSend(cc)}
            isLoading={isSending}
            data-testid="confirm-send-rfq"
          >
            Send RFQ
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onCancel}
            disabled={isSending}
          >
            Cancel
          </Button>
        </>
      }
    >
      <div>
        <label htmlFor="rfq-cc-emails" className="block mb-1.5 text-sm font-medium text-foreground">
          CC (optional)
        </label>
        <CcRecipientsDropdown
          id="rfq-cc-emails"
          options={candidates}
          value={cc}
          onChange={setCc}
          isLoading={isLoading}
          disabled={isSending}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Project members are CC’d automatically.
        </p>
      </div>

      {isError && (
        <Alert variant="destructive">
          We couldn’t send this RFQ. Check that it still has at least one vendor and line item, then
          try again.
        </Alert>
      )}
    </GridModal>
  );
}
