import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LineItemFormState, QuoteTotals } from '../hooks/useRfqResponse';

import { ResponseLineItemsTable } from './ResponseLineItemsTable';

// ADR-0019 B10 / FOR-376-377: on phones the quote grid becomes one card per
// line, edited in a sheet built from the same field definitions as the grid.
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock('@forethread/rfq-shared', () => ({ MaterialImageThumb: () => null }));
vi.mock('./MaterialSearchPopup', () => ({
  MaterialSearchPopup: () => <div data-testid="material-search-inline" />,
}));

const realMatchMedia = window.matchMedia;
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = realMatchMedia;
});

const makeItem = (overrides: Partial<LineItemFormState> = {}): LineItemFormState => ({
  rfqLineItemId: 'li-1',
  included: true,
  materialName: 'Cement',
  materialId: 'mat-1',
  imageUrl: null,
  unit: 'kg',
  requestedQty: 100,
  availQty: '50',
  unitPrice: '10',
  discount: '',
  discountType: 'PERCENT',
  gst: '',
  taxIncluded: false,
  deliveryDate: '2026-06-01',
  notes: '',
  backOrderQty: '',
  backOrderDeliveryDate: '',
  substituteItemId: null,
  substituteName: null,
  expandedSection: null,
  description: null,
  expectedDeliveryDate: null,
  deliveryLocation: null,
  ...overrides,
});

const totals: QuoteTotals = {
  totalItemsQuoted: 1,
  totalItems: 2,
  subtotal: 500,
  discountTotal: 0,
  gstTotal: 0,
  totalQuote: 500,
};

function Harness({ substituteEnabled = true }: { substituteEnabled?: boolean }) {
  const [items, setItems] = useState([
    makeItem(),
    makeItem({ rfqLineItemId: 'li-2', materialName: 'Sand', availQty: '' }),
  ]);
  const update = (i: number, field: keyof LineItemFormState, value: unknown) =>
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, [field]: value } : x)));
  return (
    <ResponseLineItemsTable
      lineItems={items}
      onToggleInclude={(i) => update(i, 'included', !items[i]?.included)}
      onUpdateItem={update}
      onToggleExpanded={vi.fn()}
      totals={totals}
      substituteOpenIdx={null}
      substituteQuery=""
      onSubstituteQueryChange={vi.fn()}
      onOpenSubstitute={vi.fn()}
      onCloseSubstitute={vi.fn()}
      onSelectSubstitute={vi.fn()}
      substituteEnabled={substituteEnabled}
    />
  );
}

describe('ResponseLineItemsTable on phones', () => {
  it('renders a card per line and a stacked totals summary, no grid', () => {
    render(<Harness />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const cards = screen.getAllByTestId('line-item-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Cement');
    expect(screen.getByTestId('quote-totals')).toHaveTextContent('500');
  });

  it('edits price in the sheet and keeps it open while Avail Qty exceeds Req Qty (FOR-273)', () => {
    render(<Harness />);
    fireEvent.click(screen.getAllByTestId('line-item-card')[0]);
    const sheet = screen.getByRole('dialog');

    fireEvent.change(within(sheet).getByLabelText('response.unitPrice'), {
      target: { value: '12' },
    });
    fireEvent.change(within(sheet).getByLabelText('response.availQty'), {
      target: { value: '150' },
    });
    expect(within(sheet).getByText('response.availExceedsReq')).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(screen.getByTestId('line-item-sheet')).toBeInTheDocument();

    fireEvent.change(within(sheet).getByLabelText('response.availQty'), {
      target: { value: '80' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(screen.queryByTestId('line-item-sheet')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('line-item-card')[0]).toHaveTextContent('12');
  });

  it('offers a substitute search only when substitutes are enabled', () => {
    const { unmount } = render(<Harness />);
    fireEvent.click(screen.getAllByTestId('line-item-card')[0]);
    expect(screen.getByText('response.substituteItem')).toBeInTheDocument();
    unmount();

    render(<Harness substituteEnabled={false} />);
    fireEvent.click(screen.getAllByTestId('line-item-card')[0]);
    expect(screen.queryByText('response.substituteItem')).not.toBeInTheDocument();
  });
});
