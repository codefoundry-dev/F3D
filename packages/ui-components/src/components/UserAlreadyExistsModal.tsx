import WarningIcon from '../assets/icons/info-in-triangle.svg?react';

import { Button } from './Button';
import { GridModal } from './GridModal';

export interface UserAlreadyExistsModalProps {
  /** Close only this modal (overlay / Esc) */
  onClose: () => void;
  /** Close all modals and go back to the page (primary button) */
  onBack: () => void;
  title: string;
  description: string;
  buttonLabel: string;
}

export function UserAlreadyExistsModal({
  onClose,
  onBack,
  title,
  description,
  buttonLabel,
}: UserAlreadyExistsModalProps) {
  return (
    <GridModal
      onClose={onClose}
      icon={<WarningIcon className="size-6 text-gray-700" />}
      title={title}
      actions={
        <Button onClick={onBack} size="lg" className="w-full">
          {buttonLabel}
        </Button>
      }
    >
      <p className="w-full whitespace-pre-line text-center text-base leading-[1.4] text-muted-foreground">
        {description}
      </p>
    </GridModal>
  );
}
