import type { ReactNode } from 'react';

import WarningIcon from '../assets/icons/info-in-triangle.svg?react';
import { cn } from '../utils/cn';

import { Button } from './Button';
import { GridModal } from './GridModal';

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Header icon (rendered in the DS badge). Defaults to a warning triangle. */
  icon?: ReactNode;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmVariant,
  onConfirm,
  onCancel,
  icon,
}: ConfirmDialogProps) {
  return (
    <GridModal
      onClose={onCancel}
      icon={icon ?? <WarningIcon className="size-6 text-gray-700" />}
      title={title}
      description={message}
      actionsClassName="flex-row"
      actions={
        <>
          <Button variant="outline" type="button" size="lg" onClick={onCancel} className="flex-1">
            {cancelLabel}
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={onConfirm}
            className={cn('flex-1', confirmVariant)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
