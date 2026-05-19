import WarningIcon from '../assets/icons/info-in-triangle.svg?react';

import { Button } from './Button';
import { IconBadge } from './IconBadge';
import { Modal, ModalBody, ModalCloseButton } from './Modal';

export interface UserAlreadyExistsModalProps {
  /** Close only this modal (X button) */
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
    <Modal onClose={onClose}>
      <ModalBody>
        <div className="flex flex-col items-center text-center py-2">
          {/* Header with close button */}
          <div className="w-full flex justify-between items-start">
            <div className="flex-1" />
            <IconBadge
              icon={<WarningIcon className="w-6 h-6 text-muted-foreground" />}
              className="bg-muted"
            />
            <div className="flex-1 flex justify-end">
              <ModalCloseButton onClose={onClose} />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-normal leading-[140%] text-foreground mt-4">{title}</h2>

          {/* Description */}
          <p className="text-base text-muted-foreground mt-6 leading-[140%] whitespace-pre-line">
            {description}
          </p>

          {/* Action */}
          <Button onClick={onBack} className="w-full mt-8">
            {buttonLabel}
          </Button>
        </div>
      </ModalBody>
    </Modal>
  );
}
