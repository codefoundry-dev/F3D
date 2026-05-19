import { useEffect, useRef, useState } from 'react';

/**
 * Debounce a value by the given delay (ms).
 * Returns [debouncedValue, setValueImmediately].
 */
export function useDebounce<T>(value: T, delay = 600): T {
  const [debounced, setDebounced] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timerRef.current = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timerRef.current);
  }, [value, delay]);

  return debounced;
}
