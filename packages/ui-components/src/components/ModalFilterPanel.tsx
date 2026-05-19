import type { ReactNode } from 'react';

import CrossIcon from '../assets/icons/cross.svg?react';
import DeleteIcon from '../assets/icons/delete.svg?react';
import { cn } from '../utils/cn';

export interface ModalFilterPanelProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  clearLabel?: string;
  onClear?: () => void;
  showClear?: boolean;
  children: ReactNode;
  className?: string;
}

export function ModalFilterPanel({
  visible,
  onClose,
  title,
  clearLabel = 'Clear',
  onClear,
  showClear,
  children,
  className,
}: ModalFilterPanelProps) {
  if (!visible) return null;

  return (
    <div className={cn('mb-3 rounded-lg border border-border p-3', className)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <div className="flex items-center gap-2">
          {showClear && onClear && (
            <button
              type="button"
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-foreground border border-border rounded-lg hover:bg-accent"
              onClick={onClear}
            >
              {clearLabel}
              <DeleteIcon className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            className="flex items-center justify-center w-7 h-7 text-foreground border border-border rounded-lg hover:bg-accent"
            onClick={onClose}
          >
            <CrossIcon className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">{children}</div>
    </div>
  );
}
