import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

import type { BadgeColor } from './Badge';

/**
 * IconBadge — Forethread design system "Activity icon" (Figma node 3671-5183).
 *
 * A rounded-square icon chip. With a `color` it renders the DS tonal scale
 * (hue-50 tint + hue-600 icon); without one it renders the fleshed-out DS
 * "neutral" chip — a gradient-white surface with a hairline border + layered
 * drop-shadow (the same signature used by the page-header chip, filter pills
 * and icon buttons), so every modal "featured icon" matches the refreshed DS.
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
  lg: { box: 'size-12 rounded-[14px]', icon: 'flex size-6 items-center justify-center' },
};

/**
 * Fleshed-out DS neutral chip — the "Modal/ featured icon" surface (Figma node
 * 3758:4895): gradient-white fill (#F9F9FA→#FFF), #E8EAED hairline, layered shadow.
 */
const neutralStyle =
  'border border-[#E8EAED] bg-gradient-to-b from-[#F9F9FA] to-white text-gray-700 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]';

export function IconBadge({ icon, color, size = 'lg', className }: IconBadgeProps) {
  const sz = sizeStyles[size];
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        sz.box,
        color ? colorStyles[color] : neutralStyle,
        className,
      )}
    >
      <span className={sz.icon}>{icon}</span>
    </div>
  );
}
