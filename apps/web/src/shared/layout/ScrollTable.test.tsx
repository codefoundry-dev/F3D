import { ScrollTable } from '@forethread/ui-components';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// FOR-371: read-only tables scroll sideways inside a ScrollTable, keep one column
// pinned (CSS keyed off data-pin) and fade whichever edge hides columns.
function stubMetrics(m: { scrollWidth: number; clientWidth: number }) {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(m.scrollWidth);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(m.clientWidth);
}

const table = (
  <table>
    <tbody>
      <tr>
        <td>RFQ-00001</td>
        <td>Draft</td>
      </tr>
    </tbody>
  </table>
);

const scroller = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-scroll-table]')!;

describe('ScrollTable', () => {
  afterEach(() => vi.restoreAllMocks());

  it('pins column 1 by default and accepts another column or none', () => {
    const { container, rerender } = render(<ScrollTable>{table}</ScrollTable>);
    expect(scroller(container)).toHaveAttribute('data-pin', '1');
    rerender(<ScrollTable pinColumn={2}>{table}</ScrollTable>);
    expect(scroller(container)).toHaveAttribute('data-pin', '2');
    rerender(<ScrollTable pinColumn={false}>{table}</ScrollTable>);
    expect(scroller(container)).not.toHaveAttribute('data-pin');
  });

  it('puts box classes on the scroller and layout classes on the wrapper', () => {
    const { container } = render(
      <ScrollTable className="rounded-lg border" wrapperClassName="mt-6 hidden xl:block">
        {table}
      </ScrollTable>,
    );
    const el = scroller(container);
    expect(el).toHaveClass('overflow-x-auto', 'rounded-lg', 'border');
    expect(el.parentElement).toHaveClass('relative', 'mt-6', 'hidden', 'xl:block');
  });

  it('shows no fade and no pinned-column shadow when the table fits', () => {
    stubMetrics({ scrollWidth: 300, clientWidth: 300 });
    const { container } = render(<ScrollTable>{table}</ScrollTable>);
    expect(screen.queryByTestId('table-fade-right')).not.toBeInTheDocument();
    expect(screen.queryByTestId('table-fade-left')).not.toBeInTheDocument();
    expect(scroller(container)).not.toHaveAttribute('data-scrolled');
  });

  it('fades the right edge while columns are hidden, then the left once scrolled', () => {
    stubMetrics({ scrollWidth: 900, clientWidth: 300 });
    const { container } = render(<ScrollTable>{table}</ScrollTable>);
    expect(screen.getByTestId('table-fade-right')).toBeInTheDocument();

    const el = scroller(container);
    act(() => {
      el.scrollLeft = 600;
      fireEvent.scroll(el);
    });
    expect(screen.getByTestId('table-fade-left')).toBeInTheDocument();
    expect(screen.queryByTestId('table-fade-right')).not.toBeInTheDocument();
    expect(el).toHaveAttribute('data-scrolled', 'true');
  });
});
