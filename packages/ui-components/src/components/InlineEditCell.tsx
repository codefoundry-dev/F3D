import { useTranslation } from '@forethread/i18n';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { cn } from '../utils/cn';

import { Spinner } from './Spinner';

export interface InlineEditCellProps {
  /** The last saved value. `null` / empty renders `emptyDisplay`. */
  value: string | null | undefined;
  /**
   * Persist the edit. The cell shows the new value straight away (optimistic)
   * with a spinner, keeps it when the promise resolves, and rolls back to
   * `value` with an inline error when it rejects. Success / failure toasts are
   * the caller's, alongside its mutation.
   */
  onSave: (next: string) => Promise<unknown>;
  /** Accessible name of the field, e.g. "Cost code". */
  label: string;
  /** Return an error message to block the save and keep the editor open. */
  validate?: (next: string) => string | null;
  /** Inline message shown when `onSave` rejects. Defaults to a generic one. */
  getErrorMessage?: (error: unknown) => string;
  /** When false the cell is plain text: no button, no editor. */
  editable?: boolean;
  emptyDisplay?: string;
  maxLength?: number;
  placeholder?: string;
  className?: string;
  'data-testid'?: string;
}

/**
 * InlineEditCell — click-to-edit text for a table cell (FOR-365).
 *
 * At rest it's a button showing the value, so Tab walks between editable cells
 * and Enter / Space / F2 opens the editor. In the editor, Enter or blur saves,
 * Esc cancels; focus returns to the cell either way. Unchanged values (after
 * trimming) close without a request.
 */
export function InlineEditCell({
  value,
  onSave,
  label,
  validate,
  getErrorMessage,
  editable = true,
  emptyDisplay = '—',
  maxLength,
  placeholder,
  className,
  'data-testid': testId,
}: InlineEditCellProps) {
  const { t } = useTranslation(['common']);
  const saved = value ?? '';

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(saved);
  /** Value shown while a save is in flight; null once it settles. */
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Enter / Esc both end in a blur once the input unmounts; this stops that
  // blur from saving a second time (or saving a cancelled edit).
  const settledRef = useRef(false);
  const refocusRef = useRef(false);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (refocusRef.current) {
      refocusRef.current = false;
      buttonRef.current?.focus();
    }
  }, [editing]);

  const startEdit = () => {
    if (optimistic !== null) return;
    settledRef.current = false;
    setDraft(saved);
    setError(null);
    setEditing(true);
  };

  const commit = (refocus: boolean) => {
    if (settledRef.current) return;
    const next = draft.trim();
    const invalid = validate?.(next) ?? null;
    if (invalid) {
      setError(invalid);
      return;
    }
    settledRef.current = true;
    refocusRef.current = refocus;
    setEditing(false);
    if (next === saved.trim()) {
      setError(null);
      return;
    }

    setOptimistic(next);
    setError(null);
    onSave(next).then(
      () => setOptimistic(null),
      (err: unknown) => {
        setOptimistic(null);
        setError(
          getErrorMessage?.(err) ??
            t('inlineEdit.saveFailed', { defaultValue: 'Could not save. Try again.' }),
        );
      },
    );
  };

  const cancel = () => {
    settledRef.current = true;
    refocusRef.current = true;
    setError(null);
    setEditing(false);
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Keep Esc from also closing a surrounding modal / sheet.
      e.stopPropagation();
      cancel();
    }
  };

  const shown = optimistic ?? saved;
  const errorId = testId ? `${testId}-error` : undefined;

  if (!editable) {
    return (
      <span className={cn('text-muted-foreground', className)} data-testid={testId}>
        {shown || emptyDisplay}
      </span>
    );
  }

  return (
    <div className="min-w-[96px]">
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onInputKeyDown}
          onBlur={() => commit(false)}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          data-testid={testId ? `${testId}-input` : undefined}
          className={cn(
            'w-full min-w-[96px] rounded-md border bg-white px-2 py-1 text-base text-gray-900 outline-none md:text-sm',
            'focus:ring-2 focus:ring-ring max-md:min-h-11',
            error ? 'border-destructive' : 'border-border',
          )}
        />
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={startEdit}
          onKeyDown={(e) => {
            if (e.key === 'F2') {
              e.preventDefault();
              startEdit();
            }
          }}
          aria-busy={optimistic !== null || undefined}
          aria-label={t('inlineEdit.editLabel', {
            defaultValue: 'Edit {{label}}: {{value}}',
            label,
            value: shown || emptyDisplay,
          })}
          title={t('inlineEdit.hint', { defaultValue: 'Click to edit' })}
          data-testid={testId}
          className={cn(
            '-mx-1.5 inline-flex w-full items-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-left',
            'cursor-text hover:border-border hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'max-md:min-h-11',
            shown ? 'text-foreground' : 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{shown || emptyDisplay}</span>
          {optimistic !== null && <Spinner size="sm" className="shrink-0 text-muted-foreground" />}
        </button>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1 whitespace-normal text-xs text-destructive"
          data-testid={testId ? `${testId}-error` : undefined}
        >
          {error}
        </p>
      )}
    </div>
  );
}
