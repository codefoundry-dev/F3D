import { useEffect, useState, type RefObject } from 'react';

export interface ScrollEdges {
  /** Content is scrolled away from the start (something hidden on the left). */
  left: boolean;
  /** Content continues past the end (something hidden on the right). */
  right: boolean;
}

/**
 * Track whether a horizontal scroll container has content hidden at either
 * edge — drives the edge fades on tab strips and tables (ADR-0019). Re-measures
 * on scroll and on resize of the container; `deps` re-binds when the content
 * changes shape (e.g. item count).
 */
export function useScrollEdges(
  ref: RefObject<HTMLElement | null>,
  deps: readonly unknown[] = [],
): ScrollEdges {
  const [edges, setEdges] = useState<ScrollEdges>({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const left = el.scrollLeft > 1;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return edges;
}
