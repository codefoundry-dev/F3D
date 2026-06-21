import { cn } from '@forethread/ui-components';
import type { ReactNode } from 'react';

/**
 * Responsive content shell for the Material Request flow. The flow is designed
 * mobile-first (Figma 2002:176) but renders inside the desktop app frame, so the
 * content is a comfortable centred column that scales from phone to desktop
 * rather than a fixed phone-width letterbox. A sticky footer region keeps the
 * primary CTA pinned on small screens.
 */
export interface MobileShellProps {
  /** Sticky page header (typically <MobileHeader />). */
  header?: ReactNode;
  /** Pinned bottom action bar. */
  footer?: ReactNode;
  children: ReactNode;
  /** Extra classes for the scrollable body column. */
  bodyClassName?: string;
}

export function MobileShell({ header, footer, children, bodyClassName }: MobileShellProps) {
  return (
    <div className="flex min-h-full flex-col bg-background">
      {header}
      <div className={cn('mx-auto w-full max-w-2xl flex-1 px-4 py-4 md:px-6', bodyClassName)}>
        {children}
      </div>
      {footer && (
        <div className="sticky bottom-0 border-t border-gray-100 bg-card px-4 py-3 md:px-6">
          <div className="mx-auto w-full max-w-2xl">{footer}</div>
        </div>
      )}
    </div>
  );
}
