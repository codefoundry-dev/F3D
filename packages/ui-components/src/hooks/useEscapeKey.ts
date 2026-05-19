import { useEffect } from 'react';

/**
 * Calls `handler` when the Escape key is pressed.
 * Only active when `enabled` is true.
 */
export function useEscapeKey(handler: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handler();
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [handler, enabled]);
}
