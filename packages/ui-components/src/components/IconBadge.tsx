import type { ReactNode } from 'react';

import { cn } from '../utils/cn';
import type { BadgeColor } from './Badge';

/**
 * IconBadge — Forethread design system "Activity icon" (Figma node 3671-5183).
 *
 * A rounded-square icon chip. With a `color` it renders the DS tonal scale
 * (hue-50 tint + hue-600 icon); without one it keeps the original neutral
 * `foreground/10` chip so existing call-sites render unchanged.
 */
export type IconBadgeColor = Extract<
  BadgeColor,
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
  | 'warning'
  | 'rose'
  | 'pink'
  | 'red'
  | 'destructive'
>;

export type IconBadgeSize = 'sm' | 'md' | 'lg';

export interface IconBadgeProps {
  icon: ReactNode;
  /** DS hue → tonal tint + coloured icon. Omit for the neutral chip. */
  color?: IconBadgeColor;
  size?: IconBadgeSize;
  className?: string;
}

const colorStyles: Record<IconBadgeColor, string> = {
  gray: 'bg-gray-100 text-gray-600',
  brand: 'bg-orange-50 text-orange-600',
  orange: 'bg-orange-50 text-orange-600',
  blue: 'bg-blue-50 text-blue-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  violet: 'bg-violet-50 text-violet-600',
  purple: 'bg-purple-50 text-purple-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  teal: 'bg-teal-50 text-teal-600',
  green: 'bg-green-50 text-green-600',
  success: 'bg-green-50 text-green-600',
  warning: 'bg-warning-50 text-warning-600',
  rose: 'bg-rose-50 text-rose-600',
  pink: 'bg-pink-50 text-pink-600',
  red: 'bg-destructive-50 text-destructive-600',
  destructive: 'bg-destructive-50 text-destructive-600',
};

const sizeStyles: Record<IconBadgeSize, { box: string; icon: string }> = {
  sm: { box: 'size-8 rounded-[8px]', icon: 'flex size-4 items-center justify-center' },
  md: { box: 'size-10 rounded-[10px]', icon: 'flex size-5 items-center justify-center' },
  lg: { box: 'size-12 rounded-[12px]', icon: 'flex size-6 items-center justify-center' },
};

export function IconBadge({ icon, color, size = 'lg', className }: IconBadgeProps) {
  const sz = sizeStyles[size];
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        sz.box,
        color ? colorStyles[color] : 'bg-foreground/10',
        className,
      )}
    >
      <span className={sz.icon}>{icon}</span>
    </div>
  );
}
