import type { ReactNode } from 'react';

import CheckCircleIcon from '../assets/icons/checkcircle-icon.svg?react';
import InfoIcon from '../assets/icons/info.svg?react';
import { cn } from '../utils/cn';

import { Button } from './Button';
import { IconBadge } from './IconBadge';
import { Modal, ModalBody, ModalCloseButton } from './Modal';

export interface StatusActionModalProps {
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  title: string;
  subtitle: string;
  infoText: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  variant?: 'default' | 'danger';
  icon?: ReactNode;
}

export function StatusActionModal({
  onClose,
  onConfirm,
  isLoading,
  title,
  subtitle,
  infoText,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  icon,
}: StatusActionModalProps) {
  const iconColor = 'text-foreground';
  const iconBg = undefined;
  const infoBorder = variant === 'danger' ? 'border-destructive/20' : 'border-success/20';
  const infoBg = variant === 'danger' ? 'bg-destructive/5' : 'bg-success/5';
  const infoIconColor = variant === 'danger' ? 'text-destructive' : 'text-success';

  return (
    <Modal onClose={onClose}>
      <ModalBody>
        <div className="flex flex-col items-center text-center">
          {/* Header with close button */}
          <div className="w-full flex justify-between items-start">
            <div className="flex-1" />
            <IconBadge
              icon={icon ?? <CheckCircleIcon className={cn('w-6 h-6', iconColor)} />}
              className={iconBg}
            />
            <div className="flex-1 flex justify-end">
              <ModalCloseButton onClose={onClose} />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-semibold leading-[140%] text-foreground mt-4">{title}</h2>

          {/* Subtitle */}
          <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>

          {/* Info box */}
          <div className={cn('w-full mt-5 rounded-xl border px-4 py-3', infoBorder, infoBg)}>
            <div className="flex items-start gap-2 text-left">
              <InfoIcon className={cn('w-4 h-4 flex-shrink-0 mt-0.5', infoIconColor)} />
              <div className="text-sm text-card-foreground">{infoText}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="w-full flex flex-col gap-3 mt-5">
            <Button onClick={onConfirm} isLoading={isLoading} className="w-full">
              {confirmLabel}
            </Button>
            <Button variant="outline" type="button" onClick={onClose} className="w-full">
              {cancelLabel}
            </Button>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
