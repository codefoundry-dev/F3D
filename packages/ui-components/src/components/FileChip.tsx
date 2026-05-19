import DeleteIcon from '../assets/icons/delete.svg?react';
import { cn } from '../utils/cn';

export interface FileChipProps {
  name: string;
  size?: string;
  onRemove?: () => void;
  className?: string;
}

export function FileChip({ name, size, onRemove, className }: FileChipProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="truncate font-medium">{name}</span>
        {size && <span className="text-muted-foreground text-xs shrink-0">{size}</span>}
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
          aria-label={`Remove ${name}`}
        >
          <DeleteIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
