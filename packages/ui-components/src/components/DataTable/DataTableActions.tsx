import type { ReactNode } from 'react';

import { cn } from '../../utils/cn';

export interface RowAction<T> {
  icon: ReactNode;
  label: string;
  onClick: (row: T) => void;
}

export interface DataTableActionsProps<T> {
  row: T;
  actions: RowAction<T>[];
  className?: string;
}

export function DataTableActions<T>({ row, actions, className }: DataTableActionsProps<T>) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          title={action.label}
          onClick={(e) => {
            e.stopPropagation();
            action.onClick(row);
          }}
          className="inline-flex items-center justify-center size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
}
