import { useEffect, useState } from 'react';

/** Phones are below the `md` breakpoint (768px) everywhere (ADR-0019). */
export const PHONE_MEDIA_QUERY = '(max-width: 767.98px)';

function matchesPhone(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(PHONE_MEDIA_QUERY).matches;
}

/**
 * True below 768px. Reads the query synchronously on first render so phone-only
 * chrome (action bar, compact toolbars) doesn't flash the desktop layout first.
 */
export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(matchesPhone);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(PHONE_MEDIA_QUERY);
    setIsPhone(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsPhone(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isPhone;
}
