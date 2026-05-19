import type { ReactNode } from 'react';

import { cn } from '../../utils/cn';
import { Button } from '../Button';

export interface BulkAction {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
}

export interface DataTableBulkActionsProps {
  selectedCount: number;
  actions: BulkAction[];
  className?: string;
}

export function DataTableBulkActions({
  selectedCount,
  actions,
  className,
}: DataTableBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm',
        className,
      )}
    >
      <span className="text-sm font-medium text-foreground">
        {selectedCount} {selectedCount === 1 ? 'Item' : 'Items'} Selected
      </span>
      <div className="flex items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant ?? 'outline'}
            size="sm"
            leftIcon={action.icon}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
