import { Tabs } from '@forethread/ui-components';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// FOR-370: the tab strip's scrollbar is hidden, so edge fades show which side
// still has tabs out of view. jsdom has no layout — stub the scroll metrics.
const ITEMS = ['details', 'lineItems', 'messages', 'documents', 'actionLog', 'emailLog'].map(
  (v) => ({ value: v, label: v }),
);

function stubMetrics(m: { scrollWidth: number; clientWidth: number }) {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(m.scrollWidth);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(m.clientWidth);
}

describe('Tabs edge fades', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows no fade when every tab fits', () => {
    stubMetrics({ scrollWidth: 300, clientWidth: 300 });
    render(<Tabs items={ITEMS} value="details" onValueChange={() => {}} />);
    expect(screen.queryByTestId('tabs-fade-left')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tabs-fade-right')).not.toBeInTheDocument();
  });

  it('fades the right edge while tabs are hidden there, and the left once scrolled', () => {
    stubMetrics({ scrollWidth: 600, clientWidth: 300 });
    render(<Tabs items={ITEMS} value="details" onValueChange={() => {}} />);
    expect(screen.getByTestId('tabs-fade-right')).toBeInTheDocument();
    expect(screen.queryByTestId('tabs-fade-left')).not.toBeInTheDocument();

    const list = screen.getByRole('tablist');
    act(() => {
      list.scrollLeft = 300;
      fireEvent.scroll(list);
    });
    expect(screen.getByTestId('tabs-fade-left')).toBeInTheDocument();
    expect(screen.queryByTestId('tabs-fade-right')).not.toBeInTheDocument();
  });

  it('scrolls the active tab into view when the selection changes', () => {
    stubMetrics({ scrollWidth: 300, clientWidth: 300 });
    const spy = vi.fn();
    Element.prototype.scrollIntoView = spy;
    const { rerender } = render(<Tabs items={ITEMS} value="details" onValueChange={() => {}} />);
    spy.mockClear();
    rerender(<Tabs items={ITEMS} value="emailLog" onValueChange={() => {}} />);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.contexts[0]).toBe(screen.getByRole('tab', { name: 'emailLog' }));
  });
});
