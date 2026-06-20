import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

/**
 * Tabs — Forethread design system (Figma node 4162-76636, "Tabs group").
 *
 * Underline tab bar: a `border-b` rail with label pills that show a dark active
 * underline (text/primary #1B1D22) and a subtle grey hover shade. Default labels
 * use text/tertiary (#40454f), Urbanist SemiBold 14px, tracking 0.3px.
 *
 * Controlled + generic over the tab value so feature wrappers (RfqDetailTabs,
 * PoDetailTabs, BulkOrderDetailTabs, …) can delegate to it without changing
 * their own public API.
 */
export interface TabItem<T extends string = string> {
  value: T;
  label: ReactNode;
  /** Optional leading icon (rendered in an 18px slot). */
  icon?: ReactNode;
  /** Optional trailing count/badge (e.g. number of responses). */
  count?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Right-aligned content on the tab bar (actions, view toggles). */
  rightSlot?: ReactNode;
  /** `md` = detail-page padding; `sm` = compact slide-over panels. */
  size?: 'sm' | 'md';
  className?: string;
  /** Extra classes for the `<nav>` list (e.g. to constrain scroll). */
  navClassName?: string;
  'aria-label'?: string;
}

const sizeStyles = {
  sm: 'px-2 py-1.5 text-[13px]',
  md: 'px-3 py-2 text-[14px]',
} as const;

export function Tabs<T extends string = string>({
  items,
  value,
  onValueChange,
  rightSlot,
  size = 'md',
  className,
  navClassName,
  'aria-label': ariaLabel,
}: TabsProps<T>) {
  return (
    <div
      className={cn('flex items-center justify-between gap-3 border-b border-gray-200', className)}
    >
      <nav
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          'scrollbar-none flex items-center gap-1.5 overflow-x-auto overflow-y-hidden',
          navClassName,
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
              aria-controls={`tabpanel-${item.value}`}
              disabled={item.disabled}
              onClick={() => onValueChange(item.value)}
              className={cn(
                'group relative -mb-px shrink-0 border-b-2 pb-px transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                'disabled:cursor-not-allowed',
                active ? 'border-gray-900' : 'border-transparent',
              )}
            >
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-[10px] font-semibold leading-none tracking-[0.3px] transition-colors',
                  sizeStyles[size],
                  item.disabled
                    ? 'text-gray-300'
                    : active
                      ? 'text-gray-900'
                      : 'text-gray-700 group-hover:bg-gray-700/[0.08] group-hover:text-gray-900',
                )}
              >
                {item.icon && (
                  <span className="inline-flex size-[18px] shrink-0 items-center justify-center">
                    {item.icon}
                  </span>
                )}
                {item.label}
                {item.count != null && (
                  <span
                    className={cn(
                      'inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] leading-none',
                      active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600',
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </nav>
      {rightSlot && <div className="shrink-0 pb-2">{rightSlot}</div>}
    </div>
  );
}
