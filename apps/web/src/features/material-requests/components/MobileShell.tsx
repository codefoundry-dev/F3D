import { cn } from '@forethread/ui-components';
import type { ReactNode } from 'react';

/**
 * Page shell for the Material Request flow. Renders the standard design-system
 * page chrome shared across the app — the common page padding
 * (`px-4 … sm:px-8`), a header region and an optional footer action bar — so the
 * flow reads like the rest of the desktop application instead of a centred phone
 * letterbox. It still collapses to a comfortable single column on phones.
 *
 * (Historically the flow was a fixed phone-width "mobile" shell; the name is
 * kept for continuity but the layout is now responsive desktop-first.)
 */
export interface MobileShellProps {
  /** In-content page header (typically <MobileHeader />). */
  header?: ReactNode;
  /** Optional action region rendered under the body. */
  footer?: ReactNode;
  children: ReactNode;
  /** Extra classes for the scrollable body region. */
  bodyClassName?: string;
}

export function MobileShell({ header, footer, children, bodyClassName }: MobileShellProps) {
  return (
    <div className="flex min-h-full flex-col px-4 pb-8 pt-4 sm:px-8 sm:pt-6">
      {header}
      <div className={cn('flex-1', bodyClassName)}>{children}</div>
      {footer && <div className="mt-6">{footer}</div>}
    </div>
  );
}
