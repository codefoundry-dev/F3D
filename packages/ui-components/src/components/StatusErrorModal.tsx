import CrossInCircleIcon from '../assets/icons/cross-in-circle.svg?react';

import { Button } from './Button';
import { IconBadge } from './IconBadge';
import { Modal, ModalBody, ModalCloseButton } from './Modal';

export interface StatusErrorModalProps {
  onClose: () => void;
  title: string;
  description: string;
  primaryButtonLabel: string;
  onPrimaryClick: () => void;
  secondaryButtonLabel?: string;
  onSecondaryClick?: () => void;
  maxWidth?: string;
}

export function StatusErrorModal({
  onClose,
  title,
  description,
  primaryButtonLabel,
  onPrimaryClick,
  secondaryButtonLabel,
  onSecondaryClick,
  maxWidth,
}: StatusErrorModalProps) {
  return (
    <Modal onClose={onClose} maxWidth={maxWidth}>
      <ModalBody>
        <div className="flex flex-col items-center text-center">
          {/* Header with close button */}
          <div className="w-full flex justify-between items-start">
            <div className="flex-1" />
            <IconBadge
              icon={<CrossInCircleIcon className="w-6 h-6 text-destructive" />}
              className="bg-destructive/10"
            />
            <div className="flex-1 flex justify-end">
              <ModalCloseButton onClose={onClose} />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-lg font-semibold text-foreground mt-4">{title}</h2>

          {/* Description */}
          <p className="text-sm text-muted-foreground mt-2">{description}</p>

          {/* Primary action */}
          <Button onClick={onPrimaryClick} className="w-full mt-5">
            {primaryButtonLabel}
          </Button>

          {/* Optional secondary action */}
          {secondaryButtonLabel && onSecondaryClick && (
            <Button variant="outline" onClick={onSecondaryClick} className="w-full mt-3">
              {secondaryButtonLabel}
            </Button>
          )}
        </div>
      </ModalBody>
    </Modal>
  );
}
