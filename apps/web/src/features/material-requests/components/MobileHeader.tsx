import BackArrowIcon from '@forethread/ui-components/assets/icons/back-arrow.svg?react';
import type { ReactNode } from 'react';

/**
 * Sticky page header for the Material Request flow (Figma 2002:176). Light DS
 * surface with a gray back button, a gray-900 title and an optional right-hand
 * slot (e.g. the project pill on Job Overview). The content is centred to the
 * same column width as <MobileShell /> so it stays aligned on desktop.
 */
export interface MobileHeaderProps {
  title: string;
  onBack?: () => void;
  /** Secondary line under the title (e.g. project label). */
  subline?: ReactNode;
  /** Right-aligned control in the title row. */
  trailing?: ReactNode;
}

export function MobileHeader({ title, onBack, subline, trailing }: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-100 bg-card px-4 py-3 md:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-[10px] text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              <BackArrowIcon className="size-5" />
            </button>
          )}
          <h1 className="flex-1 truncate text-[18px] font-medium leading-7 text-gray-900">
            {title}
          </h1>
          {trailing}
        </div>
        {subline && <div className="mt-1">{subline}</div>}
      </div>
    </header>
  );
}
