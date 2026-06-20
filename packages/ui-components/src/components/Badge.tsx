import type { ReactNode } from 'react';

import CrossIcon from '../assets/icons/cross.svg?react';
import { cn } from '../utils/cn';

/**
 * Badge & Tags — Forethread design system (Figma node 3728-4590).
 *
 * Pill-shaped tonal badge: subtle tinted background + hue border + coloured text,
 * with an optional leading status dot and an optional removable ✕ (tag mode).
 *
 * Back-compat: when no `color` is given the badge keeps the original neutral pill
 * and honours a `className` override (the ~36 existing `<Badge className="bg-… text-…">`
 * call-sites and the status-colour maps render unchanged).
 */
export type BadgeColor =
  | 'neutral'
  | 'gray'
  | 'brand'
  | 'orange'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'cyan'
  | 'teal'
  | 'green'
  | 'success'
  | 'lime'
  | 'gold'
  | 'warning'
  | 'rose'
  | 'pink'
  | 'red'
  | 'destructive';

export type BadgeSize = 'sm' | 'md' | 'lg';

/** hue → { wrapper tonal classes, dot fill } using the exact Figma palette. */
const colorStyles: Record<BadgeColor, { wrap: string; dot: string }> = {
  neutral: { wrap: 'bg-gray-50 text-gray-700 border-gray-200', dot: 'bg-gray-400' },
  gray: { wrap: 'bg-gray-50 text-gray-700 border-gray-200', dot: 'bg-gray-400' },
  brand: { wrap: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  orange: { wrap: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  blue: { wrap: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  indigo: { wrap: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  violet: { wrap: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  purple: { wrap: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  cyan: { wrap: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500' },
  teal: { wrap: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  green: { wrap: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  success: { wrap: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  lime: { wrap: 'bg-lime-50 text-lime-700 border-lime-200', dot: 'bg-lime-500' },
  gold: { wrap: 'bg-gold-50 text-gold-700 border-gold-200', dot: 'bg-gold-500' },
  warning: { wrap: 'bg-warning-50 text-warning-700 border-warning-200', dot: 'bg-warning-500' },
  rose: { wrap: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  pink: { wrap: 'bg-pink-50 text-pink-700 border-pink-200', dot: 'bg-pink-500' },
  red: {
    wrap: 'bg-destructive-50 text-destructive-700 border-destructive-200',
    dot: 'bg-destructive-500',
  },
  destructive: {
    wrap: 'bg-destructive-50 text-destructive-700 border-destructive-200',
    dot: 'bg-destructive-500',
  },
};

const sizeStyles: Record<BadgeSize, { pill: string; dot: string; close: string }> = {
  sm: { pill: 'px-2 py-0.5 text-[12px] gap-1', dot: 'size-1.5', close: 'size-3' },
  md: { pill: 'px-2.5 py-0.5 text-[14px] gap-1.5', dot: 'size-2', close: 'size-3.5' },
  lg: { pill: 'px-3 py-1 text-[14px] gap-1.5', dot: 'size-2.5', close: 'size-4' },
};

export interface BadgeProps {
  children: ReactNode;
  /** DS hue. When omitted, renders a neutral pill and defers to `className`. */
  color?: BadgeColor;
  size?: BadgeSize;
  /** Show a leading status dot (coloured to the hue). */
  dot?: boolean;
  leftIcon?: ReactNode;
  /** Render a trailing ✕ (tag mode). Provides the removable affordance. */
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
}

export function Badge({
  children,
  color,
  size = 'sm',
  dot,
  leftIcon,
  onRemove,
  removeLabel = 'Remove',
  className,
}: BadgeProps) {
  const sz = sizeStyles[size];
  const tone = color ? colorStyles[color] : undefined;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium whitespace-nowrap leading-none',
        sz.pill,
        tone ? tone.wrap : 'border-transparent',
        className,
      )}
    >
      {dot && (
        <span className={cn('rounded-full shrink-0', sz.dot, tone ? tone.dot : 'bg-current')} />
      )}
      {leftIcon && <span className="inline-flex shrink-0 items-center">{leftIcon}</span>}
      {children}
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          className="inline-flex shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100 cursor-pointer"
        >
          <CrossIcon className={sz.close} />
        </button>
      )}
    </span>
  );
}
