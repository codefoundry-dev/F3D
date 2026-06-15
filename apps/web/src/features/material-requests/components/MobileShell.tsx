import type { ReactNode } from 'react';

/**
 * Centered mobile column for the Material Request flow (Figma 2002:176 — 375px
 * frames). The flow is designed mobile-first; this shell constrains the content
 * to a phone-width column that also reads correctly on desktop. A sticky footer
 * region is supported via the `footer` slot so the primary CTA stays pinned.
 */
export interface MobileShellProps {
  /** Dark sticky header (typically <MobileHeader />). */
  header?: ReactNode;
  /** Pinned bottom action bar (white surface, top border). */
  footer?: ReactNode;
  children: ReactNode;
  /** Background of the scrollable body. Defaults to white. */
  bodyClassName?: string;
}

export function MobileShell({ header, footer, children, bodyClassName }: MobileShellProps) {
  return (
    <div className="flex justify-center bg-neutral-100 min-h-full">
      <div className="relative flex w-full max-w-[420px] flex-col bg-white shadow-sm min-h-[100dvh]">
        {header}
        <div className={`flex-1 overflow-y-auto ${bodyClassName ?? ''}`}>{children}</div>
        {footer && (
          <div className="sticky bottom-0 border-t border-[#E5E5E5] bg-white px-4 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
