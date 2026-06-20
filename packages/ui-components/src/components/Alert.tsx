import type { ReactNode } from 'react';

import CrossIcon from '../assets/icons/cross.svg?react';
import { cn } from '../utils/cn';

/**
 * Alert — Forethread design system (Figma "Notifications / Alerts / Toast" 3719-72068).
 *
 * Tinted banner: hue-50 background + hue-200 border + a hue-coloured icon, with
 * grey title (Gray-900) and body (Gray-700) text — the colour lives in the icon
 * and surface, not the copy. Optional `title`, `actions` row and dismiss `✕`.
 *
 * Back-compat: the original `{ variant, icon, children }` shape still renders
 * (children become the body). `info` keeps mapping to blue; `error` aliases
 * `destructive`.
 */
const variantStyles = {
  neutral: { wrap: 'bg-gray-50 border-gray-200', icon: 'text-gray-500' },
  info: { wrap: 'bg-blue-50 border-blue-200', icon: 'text-blue-600' },
  success: { wrap: 'bg-green-50 border-green-200', icon: 'text-green-600' },
  warning: { wrap: 'bg-warning-50 border-warning-200', icon: 'text-warning-600' },
  destructive: { wrap: 'bg-destructive-50 border-destructive-200', icon: 'text-destructive-600' },
  error: { wrap: 'bg-destructive-50 border-destructive-200', icon: 'text-destructive-600' },
} as const;

export interface AlertProps {
  variant: keyof typeof variantStyles;
  icon?: ReactNode;
  /** Optional bold heading above the body. */
  title?: ReactNode;
  children?: ReactNode;
  /** Trailing action buttons row (rendered under the body). */
  actions?: ReactNode;
  /** Show a dismiss ✕ in the top-right. */
  onClose?: () => void;
  closeLabel?: string;
  className?: string;
}

export function Alert({
  variant,
  icon,
  title,
  children,
  actions,
  onClose,
  closeLabel = 'Dismiss',
  className,
}: AlertProps) {
  const tone = variantStyles[variant];
  return (
    <div className={cn('rounded-[12px] border px-4 py-3', tone.wrap, className)} role="alert">
      <div className="flex items-start gap-3">
        {icon && (
          <span
            className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center', tone.icon)}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {title && <p className="text-[14px] font-semibold text-gray-900">{title}</p>}
          {children && (
            <div className={cn('text-[14px] text-gray-700', title && 'mt-0.5')}>{children}</div>
          )}
          {actions && <div className="mt-3 flex items-center gap-2">{actions}</div>}
        </div>
        {onClose && (
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="-mr-1 -mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[6px] text-gray-500 transition-colors hover:bg-gray-700/[0.08] hover:text-gray-700"
          >
            <CrossIcon className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
