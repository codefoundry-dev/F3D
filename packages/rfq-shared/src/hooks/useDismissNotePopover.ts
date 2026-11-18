import { useEffect } from 'react';

/** Marks a line-note trigger + popover wrapper; clicks inside it don't dismiss. */
export const NOTE_POPOVER_ATTR = 'data-note-popover';

/**
 * Closes the open line-note popover on a click anywhere outside a note
 * wrapper, or on Escape. Clicking another line's note button is left to that
 * button's own handler, so the popover moves instead of flickering shut.
 */
export function useDismissNotePopover(open: boolean, onDismiss: () => void): void {
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target;
      if (target instanceof Element && target.closest(`[${NOTE_POPOVER_ATTR}]`)) return;
      onDismiss();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onDismiss]);
}
