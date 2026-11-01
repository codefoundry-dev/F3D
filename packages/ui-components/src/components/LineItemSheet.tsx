import { useState, type ReactNode } from 'react';

import ChevronRightIcon from '../assets/icons/chevron-right.svg?react';
import PlusIcon from '../assets/icons/plus.svg?react';
import { cn } from '../utils/cn';

import { Button } from './Button';
import { Modal, ModalCloseButton } from './Modal';

/**
 * One editable field of an input-grid line (ADR-0019 B10, FOR-376). A grid
 * defines its fields once; the desktop table renders `input` in a cell, and on
 * phones {@link LineItemEditor} renders it stacked full-width in the sheet.
 */
export interface LineItemField<T> {
  key: string;
  /** Column header on desktop, field label in the sheet. */
  label: ReactNode;
  required?: boolean;
  /** The bound input for line `index`. Values stay in the grid's own form state. */
  input: (line: T, index: number) => ReactNode;
  /** Read-only value for the phone card. Omit to leave the field off the card. */
  value?: (line: T, index: number) => ReactNode;
  /** Hide the field for some lines (e.g. substitute-only fields). */
  hidden?: (line: T, index: number) => boolean;
  /** Help or error text under the field in the sheet. */
  hint?: (line: T, index: number) => ReactNode;
}

export interface LineItemSheetProps {
  /** Sheet title, usually the line's material name. */
  title: ReactNode;
  /** 0-based position of the line, for "Line 2 of 5". */
  index: number;
  total: number;
  children: ReactNode;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  /** Runs before Save closes the sheet; return false to keep it open (validation). */
  onSave?: () => boolean | void;
  /** Extra actions under the fields, e.g. Remove line. */
  footerExtra?: ReactNode;
  lineOfLabel?: string;
  previousLabel?: string;
  saveLabel?: string;
  nextLabel?: string;
}

/**
 * Phone edit sheet for one input-grid line (B10): the line's fields stacked
 * full-width, with Previous / Save / Next so users can work through the lines
 * without closing it. Full-screen, so the keyboard never covers the buttons.
 */
export function LineItemSheet({
  title,
  index,
  total,
  children,
  onClose,
  onPrevious,
  onNext,
  onSave,
  footerExtra,
  lineOfLabel,
  previousLabel = 'Previous',
  saveLabel = 'Save',
  nextLabel = 'Next',
}: LineItemSheetProps) {
  const save = () => {
    if (onSave?.() === false) return;
    onClose();
  };
  const go = (move?: () => void) => () => {
    if (onSave?.() === false) return;
    move?.();
  };

  return (
    <Modal onClose={save} mobile="fullscreen" scrollBody>
      <div
        data-testid="line-item-sheet"
        className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3"
      >
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">
            {lineOfLabel ?? `Line ${index + 1} of ${total}`}
          </p>
          <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
        </div>
        <ModalCloseButton onClose={save} className="size-10" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {children}
        {footerExtra}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] [&>*]:min-h-11 [&>*]:flex-1">
        <Button
          type="button"
          variant="secondary"
          disabled={!onPrevious}
          onClick={go(onPrevious)}
          leftIcon={<ChevronRightIcon className="size-4 rotate-180" />}
        >
          {previousLabel}
        </Button>
        <Button type="button" variant="primary" onClick={save}>
          {saveLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!onNext}
          onClick={go(onNext)}
          rightIcon={<ChevronRightIcon className="size-4" />}
        >
          {nextLabel}
        </Button>
      </div>
    </Modal>
  );
}

export interface LineItemEditorProps<T> {
  lines: T[];
  fields: LineItemField<T>[];
  getKey: (line: T, index: number) => string;
  /** Card heading and sheet title. */
  getTitle: (line: T, index: number) => ReactNode;
  /** Optional line under the title on the card (e.g. SKU or a status badge). */
  getSubtitle?: (line: T, index: number) => ReactNode;
  /** Validates line `index` before Save / Previous / Next leave it. */
  validateLine?: (index: number) => boolean;
  /** Remove-line action shown in the sheet. */
  onRemove?: (index: number) => void;
  removeLabel?: string;
  /** "Add line" under the cards. Return the new line's index to open it. */
  onAdd?: () => number | void;
  addLabel?: string;
  /** Marks a card as needing attention (e.g. has validation errors). */
  hasError?: (line: T, index: number) => boolean;
  emptyState?: ReactNode;
  className?: string;
  labels?: Pick<LineItemSheetProps, 'previousLabel' | 'saveLabel' | 'nextLabel'> & {
    lineOf?: (index: number, total: number) => string;
  };
}

/**
 * Phone view of an input grid (B10): one card per line showing the title and
 * the fields that define a `value`, and a {@link LineItemSheet} for editing
 * when a card is tapped. Render it instead of the table when `useIsPhone()`.
 */
export function LineItemEditor<T>({
  lines,
  fields,
  getKey,
  getTitle,
  getSubtitle,
  validateLine,
  onRemove,
  removeLabel = 'Remove line',
  onAdd,
  addLabel = 'Add line',
  hasError,
  emptyState,
  className,
  labels,
}: LineItemEditorProps<T>) {
  const [open, setOpen] = useState<number | null>(null);
  const current = open !== null && open < lines.length ? open : null;
  const line = current !== null ? lines[current] : undefined;

  return (
    <div className={cn('flex flex-col gap-2', className)} data-testid="line-item-cards">
      {lines.length === 0 && emptyState}
      {lines.map((l, i) => {
        const shown = fields.filter((f) => f.value && !f.hidden?.(l, i));
        return (
          <button
            key={getKey(l, i)}
            type="button"
            onClick={() => setOpen(i)}
            data-testid="line-item-card"
            className={cn(
              'flex w-full flex-col gap-2 rounded-[14px] border bg-white p-3 text-left shadow-[0_1px_2px_0_rgba(10,13,18,0.04)]',
              hasError?.(l, i) ? 'border-destructive' : 'border-[#E8EAED]',
            )}
          >
            <span className="flex w-full items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold text-foreground">
                  {getTitle(l, i)}
                </span>
                {getSubtitle && (
                  <span className="block truncate text-xs text-gray-500">{getSubtitle(l, i)}</span>
                )}
              </span>
              <ChevronRightIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-gray-400" />
            </span>
            {shown.length > 0 && (
              <span className="grid w-full grid-cols-2 gap-x-3 gap-y-1.5">
                {shown.map((f) => (
                  <span key={f.key} className="min-w-0">
                    <span className="block truncate text-xs text-gray-500">{f.label}</span>
                    <span className="block truncate text-sm text-foreground">
                      {f.value?.(l, i) ?? '-'}
                    </span>
                  </span>
                ))}
              </span>
            )}
          </button>
        );
      })}

      {onAdd && (
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 w-full"
          leftIcon={<PlusIcon className="size-4" />}
          onClick={() => {
            const idx = onAdd();
            if (typeof idx === 'number') setOpen(idx);
          }}
        >
          {addLabel}
        </Button>
      )}

      {current !== null && line !== undefined && (
        <LineItemSheet
          title={getTitle(line, current)}
          index={current}
          total={lines.length}
          lineOfLabel={labels?.lineOf?.(current, lines.length)}
          previousLabel={labels?.previousLabel}
          saveLabel={labels?.saveLabel}
          nextLabel={labels?.nextLabel}
          onClose={() => setOpen(null)}
          onSave={validateLine ? () => validateLine(current) : undefined}
          onPrevious={current > 0 ? () => setOpen(current - 1) : undefined}
          onNext={current < lines.length - 1 ? () => setOpen(current + 1) : undefined}
          footerExtra={
            onRemove ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 self-start text-destructive"
                onClick={() => {
                  onRemove(current);
                  setOpen(null);
                }}
              >
                {removeLabel}
              </Button>
            ) : undefined
          }
        >
          {fields
            .filter((f) => !f.hidden?.(line, current))
            .map((f) => (
              <div key={f.key} className="flex flex-col gap-1.5 [&_input]:text-base">
                <span className="text-sm font-medium text-gray-700">
                  {f.label}
                  {f.required && <span className="text-destructive"> *</span>}
                </span>
                {f.input(line, current)}
                {f.hint?.(line, current)}
              </div>
            ))}
        </LineItemSheet>
      )}
    </div>
  );
}
