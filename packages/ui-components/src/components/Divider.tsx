import type { ReactNode } from 'react';

import { cn } from '../utils/cn';

/**
 * Divider — Forethread design system hairline rule (Figma "Helped elements" 3608-72137).
 *
 * Gray-100 (#E8EAED) separator. Horizontal by default; pass an optional `label`
 * to render centred text between two rules. `vertical` draws a 1px column rule.
 */
export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  /** Centred label between two horizontal rules (ignored when vertical). */
  label?: ReactNode;
  className?: string;
}

export function Divider({ orientation = 'horizontal', label, className }: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <span
        role="separator"
        aria-orientation="vertical"
        className={cn('inline-block w-px self-stretch bg-gray-100', className)}
      />
    );
  }

  if (label) {
    return (
      <div className={cn('flex items-center gap-3', className)} role="separator">
        <span className="h-px flex-1 bg-gray-100" />
        <span className="text-[12px] font-medium tracking-[0.3px] text-gray-500">{label}</span>
        <span className="h-px flex-1 bg-gray-100" />
      </div>
    );
  }

  return <hr className={cn('h-px border-0 bg-gray-100', className)} />;
}
