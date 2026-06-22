import CrossInCircleIcon from '../assets/icons/cross-in-circle.svg?react';

import { Button } from './Button';
import { GridModal } from './GridModal';

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
    <GridModal
      onClose={onClose}
      maxWidth={maxWidth}
      icon={<CrossInCircleIcon className="size-6 text-destructive" />}
      title={title}
      description={description}
      actions={
        <>
          <Button onClick={onPrimaryClick} size="lg" className="w-full">
            {primaryButtonLabel}
          </Button>
          {secondaryButtonLabel && onSecondaryClick && (
            <Button variant="outline" size="lg" onClick={onSecondaryClick} className="w-full">
              {secondaryButtonLabel}
            </Button>
          )}
        </>
      }
    />
  );
}
