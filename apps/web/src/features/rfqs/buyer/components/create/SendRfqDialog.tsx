import {
  Alert,
  Button,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@forethread/ui-components';
import { useState } from 'react';

interface SendRfqDialogProps {
  /** How many vendors will be emailed — drives the confirmation copy. */
  vendorCount: number;
  isSending: boolean;
  isError: boolean;
  onCancel: () => void;
  /** Receives the parsed CC list (already split + trimmed; may be empty). */
  onSend: (cc: string[]) => void;
}

/** Split a raw "a@x.com, b@y.com" string into trimmed, non-empty addresses. */
function parseCcEmails(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/**
 * Confirmation dialog for sending an RFQ to its vendors. Sending is
 * outward-facing (it emails vendors a tokenized quote link and opens the RFQ),
 * so we confirm first and offer an optional CC field before the irreversible step.
 */
export function SendRfqDialog({
  vendorCount,
  isSending,
  isError,
  onCancel,
  onSend,
}: SendRfqDialogProps) {
  const [cc, setCc] = useState('');

  return (
    <Modal onClose={onCancel} maxWidth="max-w-[480px]">
      <ModalHeader onClose={onCancel}>Send this RFQ?</ModalHeader>
      <ModalBody>
        <p className="text-sm text-muted-foreground">
          {vendorCount} {vendorCount === 1 ? 'vendor' : 'vendors'} will be emailed a secure link
          to submit their quotes. The RFQ will move from draft to open.
        </p>

        <label htmlFor="rfq-cc-emails" className="block mt-4 mb-1.5 text-sm font-medium text-foreground">
          CC emails (optional)
        </label>
        <Input
          id="rfq-cc-emails"
          value={cc}
          onChange={(e) => setCc(e.target.value)}
          placeholder="name@example.com, other@example.com"
          disabled={isSending}
          data-testid="send-rfq-cc"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Separate multiple addresses with a comma.
        </p>

        {isError && (
          <Alert variant="destructive" className="mt-4">
            We couldn’t send this RFQ. Check that it still has at least one vendor and line item,
            then try again.
          </Alert>
        )}
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSending}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => onSend(parseCcEmails(cc))}
          isLoading={isSending}
          data-testid="confirm-send-rfq"
        >
          Send RFQ
        </Button>
      </ModalFooter>
    </Modal>
  );
}
