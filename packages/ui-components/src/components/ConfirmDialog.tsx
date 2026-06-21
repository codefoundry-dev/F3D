import { cn } from '../utils/cn';

import { Button } from './Button';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmVariant,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal onClose={onCancel} maxWidth="max-w-[440px]">
      <div className="p-6">
        <h3 className="mb-1.5 text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mb-6 text-sm text-gray-500">{message}</p>
        <div className="flex gap-3">
          <Button variant="outline" type="button" onClick={onCancel} className="flex-1">
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className={cn('flex-1', confirmVariant)}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
