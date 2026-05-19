import CrossInCircleIcon from '../assets/icons/cross-in-circle.svg?react';
import { cn } from '../utils/cn';

import { Button } from './Button';

export interface SelectionBarProps {
  selectedCount: number;
  alreadyInTableCount?: number;
  onClear: () => void;
  onAction?: () => void;
  selectedLabel?: string;
  alreadyInTableLabel?: string;
  actionLabel?: string;
  clearTitle?: string;
  className?: string;
}

export function SelectionBar({
  selectedCount,
  alreadyInTableCount = 0,
  onClear,
  onAction,
  selectedLabel = 'items selected',
  alreadyInTableLabel = 'already in PO',
  actionLabel = 'Add selected',
  clearTitle = 'Clear selection',
  className,
}: SelectionBarProps) {
  if (selectedCount === 0 && alreadyInTableCount === 0) return null;

  return (
    <div className={cn('flex items-center justify-between mb-3 px-1', className)}>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title={clearTitle}
          >
            <CrossInCircleIcon className="w-4 h-4" />
          </button>
        )}
        <span>
          {selectedCount > 0 ? `${selectedCount} ${selectedLabel}` : ''}
          {selectedCount > 0 && alreadyInTableCount > 0 ? ' · ' : ''}
          {alreadyInTableCount > 0 ? `${alreadyInTableCount} ${alreadyInTableLabel}` : ''}
        </span>
      </div>
      {selectedCount > 0 && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
