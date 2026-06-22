import type { ReactNode } from 'react';

import CheckCircleIcon from '../assets/icons/checkcircle-icon.svg?react';
import InfoIcon from '../assets/icons/info.svg?react';
import { cn } from '../utils/cn';

import { Button } from './Button';
import { GridModal } from './GridModal';

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
  const infoBorder = variant === 'danger' ? 'border-destructive/20' : 'border-success/20';
  const infoBg = variant === 'danger' ? 'bg-destructive/5' : 'bg-success/5';
  const infoIconColor = variant === 'danger' ? 'text-destructive' : 'text-success';

  return (
    <GridModal
      onClose={onClose}
      icon={icon ?? <CheckCircleIcon className="size-6 text-foreground" />}
      title={title}
      description={subtitle}
      actions={
        <>
          <Button onClick={onConfirm} isLoading={isLoading} size="lg" className="w-full">
            {confirmLabel}
          </Button>
          <Button variant="outline" size="lg" type="button" onClick={onClose} className="w-full">
            {cancelLabel}
          </Button>
        </>
      }
    >
      <div className={cn('w-full rounded-xl border px-4 py-3', infoBorder, infoBg)}>
        <div className="flex items-start gap-2 text-left">
          <InfoIcon className={cn('mt-0.5 h-4 w-4 flex-shrink-0', infoIconColor)} />
          <div className="text-sm text-card-foreground">{infoText}</div>
        </div>
      </div>
    </GridModal>
  );
}
