import { type FormEventHandler, type ReactNode } from 'react';

import { cn } from '../utils/cn';

import {
  Modal,
  ModalCloseButton,
  ModalGridBackground,
  ModalGridHeader,
  REGISTRATION_MODAL_CARD_CLASS,
} from './Modal';

export type GridModalSize = 'md' | 'lg';

export interface GridModalProps {
  /** Close handler (overlay click, Esc, the optional close button). */
  onClose: () => void;
  /** Raw header icon (~24px) rendered inside the DS white-gradient badge chip. */
  icon: ReactNode;
  title: ReactNode;
  /** Muted Body/M subtitle under the title. */
  description?: ReactNode;
  /** Main content slot (form fields, info boxes, etc.). Left-aligned by default. */
  children?: ReactNode;
  /** Footer slot — stacked full-width buttons by default (Figma "Button Container"). */
  actions?: ReactNode;
  /**
   * When provided, the body + actions are wrapped in a `<form onSubmit>` so a
   * `type="submit"` button in `actions` submits the fields in `children`.
   */
  onSubmit?: FormEventHandler<HTMLFormElement>;
  /** Card width: `md` = 480px (default), `lg` = 720px (Figma "Modal big"). */
  size?: GridModalSize;
  /** Show the top-right close button. Defaults to false (Figma closes via the buttons). */
  showClose?: boolean;
  /** Pin the header/footer and scroll only the body — for tall modals. */
  scrollBody?: boolean;
  /** Extra width override merged onto the card (desktop-scoped automatically by Modal). */
  maxWidth?: string;
  className?: string;
  cardClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  actionsClassName?: string;
}

/** lg swaps the 480px width baked into `REGISTRATION_MODAL_CARD_CLASS` for 720px. */
const SIZE_WIDTHS: Record<GridModalSize, string> = {
  md: '',
  lg: 'toolbar:min-w-[720px] toolbar:max-w-[720px]',
};

/**
 * GridModal — the canonical Forethread modal (Figma "Modal big", node
 * 5833:135085). Every modal shares this structure: the angled orange perspective
 * grid bled to the top edge, a centred white-gradient "featured icon" badge, a
 * Headline/S title + Body/M description, the content slot, and a stacked footer
 * of full-width buttons.
 *
 * It composes the existing primitives — `Modal` (with the `ModalGridBackground`
 * decoration), `ModalGridHeader`, and `ModalCloseButton` — so callers only pass
 * `icon` / `title` / `description` / `children` / `actions`.
 *
 * Forms: pass `onSubmit` and the shell wraps the body + footer in a `<form>` so a
 * `type="submit"` action button works while the header stays outside the form.
 */
export function GridModal({
  onClose,
  icon,
  title,
  description,
  children,
  actions,
  onSubmit,
  size = 'md',
  showClose = false,
  scrollBody = false,
  maxWidth,
  className,
  cardClassName,
  headerClassName,
  bodyClassName,
  actionsClassName,
}: GridModalProps) {
  const body =
    children !== undefined && children !== null ? (
      <div className={cn('relative flex w-full flex-col gap-6 text-left', bodyClassName)}>
        {children}
      </div>
    ) : null;

  const footer =
    actions !== undefined && actions !== null ? (
      <div className={cn('relative flex w-full flex-col gap-3', actionsClassName)}>{actions}</div>
    ) : null;

  const main = onSubmit ? (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn('relative flex w-full flex-col gap-10 text-left', className)}
    >
      {body}
      {footer}
    </form>
  ) : (
    <>
      {body}
      {footer}
    </>
  );

  return (
    <Modal
      onClose={onClose}
      decoration={<ModalGridBackground />}
      scrollBody={scrollBody}
      maxWidth={maxWidth}
      cardClassName={cn(REGISTRATION_MODAL_CARD_CLASS, SIZE_WIDTHS[size], cardClassName)}
    >
      {showClose && (
        <ModalCloseButton
          onClose={onClose}
          className="absolute right-5 top-5 z-10 bg-white/70 backdrop-blur-sm"
        />
      )}
      <ModalGridHeader
        icon={icon}
        title={title}
        subtitle={description}
        className={headerClassName}
      />
      {main}
    </Modal>
  );
}
