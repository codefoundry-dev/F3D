import { useEffect, type RefObject } from 'react';

/** Custom property (px) for chrome that overlays the page scroller, e.g. the app top bar. */
export const STICKY_TOP_VAR = '--sticky-top';

/**
 * Keep a table's `<thead>` in view while the table scrolls vertically past it,
 * like a frozen row in Excel (FOR-359).
 *
 * CSS `position: sticky; top: 0` can't do this: the table sits in a sideways
 * scroll box (`overflow-x: auto`, which forces `overflow-y: auto` too), so the
 * box becomes the sticky's scroll container — and the box itself never scrolls
 * vertically; the page does. Instead the header is shifted down with a
 * transform by however far the table's top has scrolled out of view. It stays
 * inside the sideways scroller, so it stays aligned with its columns.
 *
 * "Out of view" is the lowest of: the top of every clipping ancestor (modal
 * bodies, max-height panels) and `--sticky-top` inherited from the layout (the
 * app's sticky top bar, which portalled modals don't inherit). The header never
 * moves past the table's bottom edge.
 *
 * `ref` is the element whose direct `table > thead` is moved; it should carry
 * `data-sticky-header` so globals.css lifts the header above row content.
 */
export function useStickyTableHeader(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const box = ref.current;
    if (!box || typeof window === 'undefined') return;

    // Clipping ancestors can't change without a remount in practice; read once.
    const clippers: HTMLElement[] = [];
    for (let el = box.parentElement; el && el !== document.body; el = el.parentElement) {
      if (getComputedStyle(el).overflowY !== 'visible') clippers.push(el);
    }
    const baseTop = parseFloat(getComputedStyle(box).getPropertyValue(STICKY_TOP_VAR)) || 0;

    let frame = 0;

    const update = () => {
      frame = 0;
      const table = box.querySelector<HTMLTableElement>(':scope > table');
      const thead = table?.querySelector<HTMLElement>(':scope > thead');
      if (!table || !thead) return;

      let stickTop = baseTop;
      for (const el of clippers) {
        stickTop = Math.max(stickTop, el.getBoundingClientRect().top + el.clientTop);
      }

      // Read the shift off the node: React may have swapped the <thead>.
      const offset = Number(thead.dataset.stickyOffset) || 0;
      const head = thead.getBoundingClientRect();
      const naturalTop = head.top - offset;
      const maxOffset = Math.max(
        0,
        table.getBoundingClientRect().bottom - head.height - naturalTop,
      );
      const next = Math.min(Math.max(stickTop - naturalTop, 0), maxOffset);
      if (Math.abs(next - offset) < 0.5) return;

      thead.dataset.stickyOffset = String(next);
      thead.style.transform = next ? `translateY(${next}px)` : '';
      if (next) box.setAttribute('data-stuck', '');
      else box.removeAttribute('data-stuck');
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    // Capture catches scrolls of any ancestor (scroll events don't bubble).
    document.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    ro?.observe(box);

    return () => {
      document.removeEventListener('scroll', schedule, { capture: true });
      window.removeEventListener('resize', schedule);
      ro?.disconnect();
      if (frame) cancelAnimationFrame(frame);
      const thead = box.querySelector<HTMLElement>(':scope > table > thead');
      if (thead) {
        thead.style.transform = '';
        delete thead.dataset.stickyOffset;
      }
      box.removeAttribute('data-stuck');
    };
  }, [ref]);
}
