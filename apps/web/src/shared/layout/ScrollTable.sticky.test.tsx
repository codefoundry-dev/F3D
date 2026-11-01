import { ScrollTable } from '@forethread/ui-components';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * FOR-359 — the header row of a ScrollTable stays in view while a scrolling
 * ancestor scrolls past the table. jsdom has no layout, so element rects are
 * stubbed: a scroller whose visible area starts at y=100, a 40px header and a
 * table 500px tall whose top sits at `tableTop`.
 */
let tableTop = 0;

function rect(top: number, height: number): DOMRect {
  return {
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: top,
  } as DOMRect;
}

function renderTable() {
  const utils = render(
    <div data-testid="scroller" style={{ overflowY: 'auto' }}>
      <ScrollTable>
        <table>
          <thead data-testid="thead">
            <tr>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Row</td>
            </tr>
          </tbody>
        </table>
      </ScrollTable>
    </div>,
  );
  const thead = utils.getByTestId('thead');
  const table = thead.parentElement as HTMLElement;
  utils.getByTestId('scroller').getBoundingClientRect = () => rect(100, 600);
  table.getBoundingClientRect = () => rect(tableTop, 500);
  // The header's on-screen top includes whatever shift the hook applied.
  thead.getBoundingClientRect = () =>
    rect(tableTop + (Number(thead.dataset.stickyOffset) || 0), 40);
  return { ...utils, thead };
}

function scrollTo(top: number) {
  tableTop = top;
  act(() => {
    document.dispatchEvent(new Event('scroll'));
  });
}

describe('ScrollTable frozen header (FOR-359)', () => {
  beforeEach(() => {
    tableTop = 200;
    // Run frames synchronously. Return 0 ("no frame pending"): a real frame
    // fires after the handle is stored, this one fires before.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('leaves the header in place while the table top is visible', () => {
    const { thead, container } = renderTable();
    scrollTo(150);
    expect(thead.style.transform).toBe('');
    expect(container.querySelector('[data-stuck]')).toBeNull();
  });

  it('shifts the header to the top of the visible area once the table scrolls under it', () => {
    const { thead, container } = renderTable();
    scrollTo(-50);
    expect(thead.style.transform).toBe('translateY(150px)');
    expect(container.querySelector('[data-scroll-table]')).toHaveAttribute('data-stuck');
  });

  it('never pushes the header past the bottom of the table', () => {
    const { thead } = renderTable();
    scrollTo(-1000);
    // 500px table − 40px header: the header rests on the table's last row.
    expect(thead.style.transform).toBe('translateY(460px)');
  });

  it('returns the header when scrolled back up', () => {
    const { thead, container } = renderTable();
    scrollTo(-50);
    scrollTo(300);
    expect(thead.style.transform).toBe('');
    expect(container.querySelector('[data-stuck]')).toBeNull();
  });
});
