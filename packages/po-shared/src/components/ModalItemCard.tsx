import type React from 'react';

import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import PlusInCircleIcon from '@forethread/ui-components/assets/icons/plus-in-circle.svg?react';

interface ModalItemCardProps {
  id: string;
  name: string;
  isSelected: boolean;
  isInTable: boolean;
  alreadyAddedLabel: string;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

export function ModalItemCard({
  id,
  name,
  isSelected,
  isInTable,
  alreadyAddedLabel,
  onToggle,
  children,
}: ModalItemCardProps) {
  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        isInTable
          ? 'border-muted bg-muted/30 opacity-60'
          : isSelected
            ? 'border-foreground bg-secondary/50'
            : 'border-border hover:border-border-hover'
      }`}
    >
      {/* Item name */}
      <p className="text-sm font-medium text-[hsl(var(--success))] mb-2">{name}</p>

      {/* Metadata */}
      <div className="flex items-center gap-6">{children}</div>

      {/* Action button */}
      <div className="flex justify-end mt-1 -mb-1">
        {isInTable ? (
          <span className="text-xs text-muted-foreground px-2 py-1">{alreadyAddedLabel}</span>
        ) : (
          <button
            type="button"
            onClick={() => onToggle(id)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {isSelected ? (
              <CrossIcon className="w-3 h-3" />
            ) : (
              <PlusInCircleIcon className="w-5 h-5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
