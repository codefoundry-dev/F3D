import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import authCardGrid from '../assets/auth-card-bg.png';
import CrossIcon from '../assets/icons/cross.svg?react';
import { cn } from '../utils/cn';

/** Convert e.g. "max-w-md" → "toolbar:max-w-md" so the class only applies on desktop (≥900px) */
function toDesktopOnly(cls: string): string {
  return cls
    .split(' ')
    .map((c) => (c.startsWith('toolbar:') ? c : `toolbar:${c}`))
    .join(' ');
}

export interface ModalProps {
  onClose: () => void;
  maxWidth?: string;
  children: ReactNode;
  /**
   * Opt-in "pinned" layout for tall / data-table modals. When true, the desktop
   * card no longer scrolls as a whole — instead it is bounded to 90vh and its
   * children lay out as a flex column so a `ModalHeader` / `ModalFooter` stay
   * fixed and only the `ModalBody` (which becomes the flex child that scrolls)
   * moves. Defaults to the legacy behaviour (whole card scrolls) so existing
   * modals are unaffected.
   */
  scrollBody?: boolean;
  /**
   * Optional absolutely-positioned card decoration, painted behind the content
   * (e.g. `<ModalGridBackground />` — the auth-style angled orange grid). The
   * card becomes a positioning context (`relative`) when provided, so the
   * decoration anchors to the card edges and bleeds under the padding.
   */
  decoration?: ReactNode;
  /**
   * Extra classes merged onto the card. Lets a caller override the default card
   * chrome (radius / width / padding) — e.g. the registration modals which use
   * the 480px, 32px-radius, padded "auth card" treatment.
   */
  cardClassName?: string;
}

export function Modal({
  onClose,
  maxWidth,
  children,
  scrollBody = false,
  decoration,
  cardClassName,
}: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const overlay = (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-0 toolbar:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        className={cn(
          'bg-card shadow-xl flex flex-col rounded-none overflow-hidden w-full h-full',
          'toolbar:w-auto toolbar:h-auto toolbar:max-h-[90vh] toolbar:rounded-[20px] toolbar:overflow-y-auto',
          'toolbar:min-w-[560px] toolbar:max-w-[560px]',
          // Pinned layout: card itself stops scrolling (overflow-hidden wins over
          // the desktop overflow-y-auto via tailwind-merge) so the header/footer
          // stay put and the body becomes the scroll region.
          scrollBody && 'toolbar:overflow-hidden',
          // A decoration needs the card to be its positioning context.
          decoration && 'relative',
          maxWidth && toDesktopOnly(maxWidth),
          // Caller overrides (radius / width / padding) win via tailwind-merge.
          cardClassName,
        )}
      >
        {decoration}
        {children}
      </div>
    </div>
  );

  // Render through a portal to document.body so the `fixed inset-0` overlay is
  // positioned against the viewport, not against any ancestor that establishes
  // a containing block (transform / filter / will-change / contain). Without
  // this the overlay can be clipped to the app content area and fail to cover
  // the top bar.
  return createPortal(overlay, document.body);
}

export function ModalCloseButton({
  onClose,
  className,
}: {
  onClose: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClose}
      className={cn(
        'flex size-7 items-center justify-center rounded-[8px] text-gray-500 transition-colors hover:bg-gray-700/[0.08] hover:text-gray-700',
        className,
      )}
      aria-label="Close"
    >
      <CrossIcon className="size-4" />
    </button>
  );
}

export function ModalHeader({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border">
      <h2 className="text-lg font-semibold text-foreground">{children}</h2>
      {onClose && <ModalCloseButton onClose={onClose} />}
    </div>
  );
}

export function ModalBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'px-6 py-4 flex-1 flex flex-col min-h-0 overflow-y-auto toolbar:overflow-visible',
        /* On mobile: form stretches, last div (buttons) sticks to bottom via mt-auto.
           On desktop: parent is display:block so flex-1 has no effect. */
        '[&>form]:flex-1 [&>form]:flex [&>form]:flex-col [&>form>div:last-child]:mt-auto',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface ModalIconHeaderProps {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Renders the top-right close button when provided. Omit for wizard steps. */
  onClose?: () => void;
  className?: string;
}

/**
 * Centered modal header — fleshed-out DS: a gradient-white "featured icon" chip
 * (hairline border + layered drop-shadow), Title/M, and a muted subtitle, with
 * an optional top-right close button.
 */
export function ModalIconHeader({
  icon,
  title,
  subtitle,
  onClose,
  className,
}: ModalIconHeaderProps) {
  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <div className="flex w-full items-start justify-between">
        <div className="flex-1" />
        <div className="flex size-12 items-center justify-center rounded-[14px] border border-[#E8EAED] bg-gradient-to-b from-[#F9F9FA] to-white text-gray-700 shadow-[0_1px_6px_0_rgba(10,13,18,0.06),0_1px_2px_0_rgba(10,13,18,0.02)]">
          <span className="flex size-6 items-center justify-center">{icon}</span>
        </div>
        <div className="flex flex-1 justify-end">
          {onClose && <ModalCloseButton onClose={onClose} />}
        </div>
      </div>
      <h2 className="mt-4 text-2xl font-semibold leading-[1.4] text-gray-900">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}

export function ModalFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex justify-end gap-3 px-6 py-4 border-t border-border', className)}>
      {children}
    </div>
  );
}

/**
 * ModalGridBackground — the registration-modal card decoration (Figma "Card
 * Background" node 3758:4893): the same angled orange perspective-grid + glow
 * used on the auth cards, bled to the card's top edge. Pass it to `Modal`'s
 * `decoration` slot. Anchored `absolute top-0`; it must be the first card child
 * so the (relatively-positioned) header/body paint above it.
 */
export function ModalGridBackground({ className }: { className?: string }) {
  return (
    <img
      src={authCardGrid}
      alt=""
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 h-[180px] w-full select-none object-cover',
        className,
      )}
    />
  );
}

/**
 * Card chrome for the registration "auth card" modals (Figma node 4347:83892):
 * 480px wide, 32px radius, 40px padding/gap, content centred. Pass as `Modal`'s
 * `cardClassName` alongside `decoration={<ModalGridBackground />}`.
 */
export const REGISTRATION_MODAL_CARD_CLASS =
  'items-center gap-8 overflow-y-auto p-6 toolbar:min-w-[480px] toolbar:max-w-[480px] toolbar:gap-10 toolbar:rounded-[32px] toolbar:p-10';

export interface ModalGridHeaderProps {
  /** Raw header icon (~24px) rendered inside the DS white-gradient badge chip. */
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}

/**
 * ModalGridHeader — centred registration-modal header (Figma node 3758:4894):
 * the gradient-white "featured icon" badge, a Headline/S (32px) title and a
 * Body/M (14px) subtitle. Sits above `ModalGridBackground`, so it is `relative`.
 */
export function ModalGridHeader({ icon, title, subtitle, className }: ModalGridHeaderProps) {
  return (
    <header
      className={cn('relative flex w-full flex-col items-center gap-4 text-center', className)}
    >
      <div className="flex size-12 items-center justify-center rounded-[14px] border border-[#E8EAED] bg-gradient-to-b from-[#F9F9FA] to-white text-gray-700 shadow-[0_1px_3px_0_rgba(10,13,18,0.06),0_1px_1px_0_rgba(10,13,18,0.02)]">
        <span className="flex size-6 items-center justify-center">{icon}</span>
      </div>
      <div className="flex w-full flex-col gap-2">
        <h2 className="text-[32px] font-medium leading-[1.4] tracking-[0.3px] text-gray-900">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[14px] font-medium leading-[1.4] tracking-[0.3px] text-gray-700">
            {subtitle}
          </p>
        )}
      </div>
    </header>
  );
}
