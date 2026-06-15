import BackArrowIcon from '@forethread/ui-components/assets/icons/back-arrow.svg?react';
import type { ReactNode } from 'react';

/**
 * Dark (#171717) sticky header used across the Material Request flow
 * (Figma 2002:176). 18px white title, a back button on the left, and an
 * optional right-hand slot (e.g. the "Project: JOB-2847" pill on Job Overview).
 */
export interface MobileHeaderProps {
  title: string;
  onBack?: () => void;
  /** Secondary line under the title (e.g. project pill). */
  subline?: ReactNode;
  /** Right-aligned control in the title row. */
  trailing?: ReactNode;
}

export function MobileHeader({ title, onBack, subline, trailing }: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex flex-col gap-2 bg-[#171717] px-4 py-4">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-md text-white hover:bg-white/10"
          >
            <BackArrowIcon className="h-5 w-5" />
          </button>
        )}
        <h1 className="flex-1 truncate text-lg font-normal leading-7 text-white">{title}</h1>
        {trailing}
      </div>
      {subline}
    </header>
  );
}
