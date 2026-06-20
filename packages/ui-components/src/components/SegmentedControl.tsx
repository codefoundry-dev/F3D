import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

/**
 * SegmentedControl — Forethread design system (Figma node 4162-76636, "Switcher").
 *
 * Pill-grouped toggle: a white rounded container (border stroke/light #E8EAED,
 * shadow-xs) holding segments. The active segment uses the dark charcoal gradient
 * (#090A0B → #2D3139) with white text and a soft shadow; inactive segments use
 * text/tertiary (#40454f) with a subtle grey hover shade.
 *
 * Controlled + generic over the option value.
 */
export interface SegmentedControlItem<T extends string = string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  items: SegmentedControlItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  size?: 'sm' | 'md';
  /** Stretch each segment to share the width equally. */
  fullWidth?: boolean;
  className?: string;
  'aria-label'?: string;
}

const sizeStyles = {
  sm: 'h-7 px-2 text-[13px] gap-1.5',
  md: 'h-[30px] px-2.5 text-[14px] gap-2',
} as const;

export function SegmentedControl<T extends string = string>({
  items,
  value,
  onValueChange,
  size = 'md',
  fullWidth,
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-[12px] border border-gray-100 bg-white p-[3px]',
        'shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]',
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onValueChange(item.value)}
            className={cn(
              'inline-flex items-center justify-center rounded-[10px] font-semibold leading-none tracking-[0.3px] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:text-gray-300',
              sizeStyles[size],
              fullWidth && 'flex-1',
              active
                ? 'bg-gradient-to-b from-[#090A0B] to-[#2D3139] text-white shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]'
                : 'text-gray-700 hover:bg-gray-700/[0.08] hover:text-gray-900',
            )}
          >
            {item.icon && (
              <span className="inline-flex size-[18px] shrink-0 items-center justify-center">
                {item.icon}
              </span>
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
