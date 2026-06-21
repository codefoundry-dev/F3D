import { cn } from '@forethread/ui-components';
import BackArrowIcon from '@forethread/ui-components/assets/icons/back-arrow.svg?react';
import type { ReactNode } from 'react';

/**
 * In-content page header for the Material Request flow, matching the design
 * system used across the app: an optional back button + gradient-white icon
 * chip, a `text-xl` title with an optional subline, and a right-aligned actions
 * slot. Title and actions stack on phones and sit on one row from `sm` up.
 */
export interface MobileHeaderProps {
  title: string;
  onBack?: () => void;
  /** Secondary line under the title (e.g. the project label). */
  subline?: ReactNode;
  /** Right-aligned controls (page actions / wizard navigation). */
  trailing?: ReactNode;
  /** Leading glyph rendered in the gradient-white DS chip. */
  icon?: ReactNode;
}

/** Gradient-white icon chip used for the in-content page header. */
const ICON_CHIP =
  'flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-gray-100 bg-gradient-to-b from-[#F9F9FA] to-white text-gray-700 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)] [&_svg]:size-5';

export function MobileHeader({ title, onBack, subline, trailing, icon }: MobileHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <BackArrowIcon className="size-5" />
          </button>
        )}
        {icon && <span className={ICON_CHIP}>{icon}</span>}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold leading-tight text-foreground">{title}</h1>
          {subline && (
            <div className="truncate text-sm leading-tight text-muted-foreground">{subline}</div>
          )}
        </div>
      </div>
      {trailing && (
        <div className={cn('flex flex-wrap items-center gap-2', onBack && 'pl-12 sm:pl-0')}>
          {trailing}
        </div>
      )}
    </div>
  );
}
