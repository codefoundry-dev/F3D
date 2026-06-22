import CopyIcon from '../assets/icons/copy.svg?react';
import InfoIcon from '../assets/icons/info.svg?react';

import { Alert } from './Alert';
import { Button } from './Button';
import { GridModal } from './GridModal';

export interface CopyEntityModalProps {
  copyState: 'loading' | 'success' | null;
  onClose: () => void;
  onOpenCopy: () => void;
  /** e.g. Copy "Alpha Construction" */
  title: string;
  /** e.g. A new draft PO will be created with the same details and line items. */
  subtitle: string;
  successMessage: string;
  dismissLabel: string;
  openLabel: string;
}

export function CopyEntityModal({
  copyState,
  onClose,
  onOpenCopy,
  title,
  subtitle,
  successMessage,
  dismissLabel,
  openLabel,
}: CopyEntityModalProps) {
  return (
    <GridModal
      onClose={onClose}
      icon={<CopyIcon className="size-6 text-gray-700" />}
      title={title}
      description={subtitle}
      actions={
        copyState === 'success' ? (
          <div className="flex w-full gap-3">
            <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
              {dismissLabel}
            </Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={onOpenCopy}>
              {openLabel}
            </Button>
          </div>
        ) : undefined
      }
    >
      {copyState === 'loading' && (
        <div className="flex w-full justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
        </div>
      )}
      {copyState === 'success' && (
        <Alert variant="success" icon={<InfoIcon className="h-4 w-4" />}>
          {successMessage}
        </Alert>
      )}
    </GridModal>
  );
}
