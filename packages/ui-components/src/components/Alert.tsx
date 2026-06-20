import type { ReactNode } from 'react';

import CrossIcon from '../assets/icons/cross.svg?react';
import { cn } from '../utils/cn';

/**
 * Alert — Forethread design system (Figma "Notifications / Alerts / Toast" 3719-72068).
 *
 * Tinted banner: a subtle vertical gradient surface (hue-100 → hue-25) + hue-200
 * border + a hue-coloured icon, with grey title (Gray-900) and body (Gray-700)
 * text — the colour lives in the icon and surface, not the copy. Optional
 * `title`, `actions` row and dismiss `✕`.
 *
 * Back-compat: the original `{ variant, icon, children }` shape still renders
 * (children become the body). `info` maps to the Figma "Notification" (indigo)
 * state; `error` aliases `destructive`.
 */
const variantStyles = {
  neutral: { wrap: 'from-gray-50 to-white border-gray-100', icon: 'text-gray-500' },
  info: { wrap: 'from-indigo-100 to-indigo-25 border-indigo-200', icon: 'text-indigo-600' },
  success: { wrap: 'from-success-100 to-success-25 border-success-200', icon: 'text-success-600' },
  warning: { wrap: 'from-warning-100 to-warning-25 border-warning-200', icon: 'text-warning-600' },
  destructive: {
    wrap: 'from-destructive-100 to-destructive-25 border-destructive-200',
    icon: 'text-destructive-600',
  },
  error: {
    wrap: 'from-destructive-100 to-destructive-25 border-destructive-200',
    icon: 'text-destructive-600',
  },
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
    <div
      className={cn('rounded-[12px] border bg-gradient-to-b px-4 py-3', tone.wrap, className)}
      role="alert"
    >
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
