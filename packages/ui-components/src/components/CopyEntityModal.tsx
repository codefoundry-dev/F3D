import CopyIcon from '../assets/icons/copy.svg?react';
import InfoIcon from '../assets/icons/info.svg?react';

import { Alert } from './Alert';
import { Button } from './Button';
import { IconBadge } from './IconBadge';
import { Modal, ModalCloseButton } from './Modal';

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
    <Modal onClose={onClose} maxWidth="max-w-[560px]">
      <div className="px-6 pt-6 pb-6">
        <div className="flex justify-end">
          <ModalCloseButton onClose={onClose} />
        </div>
        <div className="flex flex-col items-center gap-2 mb-6">
          <IconBadge icon={<CopyIcon className="w-5 h-5" />} />
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground text-center">{subtitle}</p>
        </div>

        {copyState === 'loading' && (
          <div className="flex justify-center mb-6">
            <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
          </div>
        )}

        {copyState === 'success' && (
          <>
            <div className="mb-6">
              <Alert variant="success" icon={<InfoIcon className="w-4 h-4" />}>
                {successMessage}
              </Alert>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
                {dismissLabel}
              </Button>
              <Button variant="primary" size="lg" className="flex-1" onClick={onOpenCopy}>
                {openLabel}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
