import { render, screen } from '@testing-library/react';

const mockUseRfqQuoteComparison = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key} ${JSON.stringify(vars)}` : key,
  }),
}));

vi.mock('@forethread/rfq-shared', () => ({
  useRfqQuoteComparison: mockUseRfqQuoteComparison,
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: ({ size }: { size?: string }) => <div data-testid="spinner" data-size={size} />,
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  formatCurrency: (n: number | null) => (n === null ? '-' : `$${n}`),
  formatDate: (s: string | null) => s ?? '-',
}));

import { RfqQuoteComparisonTab } from './RfqQuoteComparisonTab';

const comparison = {
  rfqId: 'rfq-1',
  currency: 'AUD',
  vendors: [
    {
      quoteResponseId: 'q-1',
      vendorId: 'v-1',
      vendorName: 'Alpha Supplies',
      status: 'SUBMITTED',
      submittedAt: '2026-06-01T00:00:00Z',
      paymentTerms: 'Net 30',
      leadTimeDate: '2026-07-01T00:00:00Z',
      total: 200,
      itemsCovered: 1,
      totalItems: 1,
    },
    {
      quoteResponseId: 'q-2',
      vendorId: 'v-2',
      vendorName: 'Beta Trading',
      status: 'SUBMITTED',
      submittedAt: '2026-06-02T00:00:00Z',
      paymentTerms: 'Net 45',
      leadTimeDate: '2026-07-10T00:00:00Z',
      total: 150,
      itemsCovered: 1,
      totalItems: 1,
    },
  ],
  rows: [
    {
      rfqLineItemId: 'li-1',
      materialName: 'Cement',
      quantity: 10,
      unit: 'bags',
      lowestVendorId: 'v-2',
      cells: [
        {
          vendorId: 'v-1',
          quoteResponseId: 'q-1',
          unitPrice: 20,
          quotedQuantity: 10,
          extendedCost: 200,
          availability: 'AVAILABLE',
          deliveryDate: '2026-07-01T00:00:00Z',
          hasQuote: true,
          isLowest: false,
        },
        {
          vendorId: 'v-2',
          quoteResponseId: 'q-2',
          unitPrice: 15,
          quotedQuantity: 10,
          extendedCost: 150,
          availability: 'AVAILABLE',
          deliveryDate: '2026-07-10T00:00:00Z',
          hasQuote: true,
          isLowest: true,
        },
      ],
    },
  ],
};

describe('RfqQuoteComparisonTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a spinner while loading', () => {
    mockUseRfqQuoteComparison.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<RfqQuoteComparisonTab rfqId="rfq-1" />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders the error state', () => {
    mockUseRfqQuoteComparison.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<RfqQuoteComparisonTab rfqId="rfq-1" />);
    expect(screen.getByText('comparisonTab.loadError')).toBeInTheDocument();
  });

  it('renders the empty state when no quotes were received', () => {
    mockUseRfqQuoteComparison.mockReturnValue({
      data: { rfqId: 'rfq-1', currency: 'AUD', vendors: [], rows: [] },
      isLoading: false,
      isError: false,
    });
    render(<RfqQuoteComparisonTab rfqId="rfq-1" />);
    expect(screen.getByText('comparisonTab.noQuotes')).toBeInTheDocument();
  });

  it('renders vendor columns, line item rows and extended costs', () => {
    mockUseRfqQuoteComparison.mockReturnValue({
      data: comparison,
      isLoading: false,
      isError: false,
    });
    render(<RfqQuoteComparisonTab rfqId="rfq-1" />);

    expect(screen.getByText('Alpha Supplies')).toBeInTheDocument();
    expect(screen.getByText('Beta Trading')).toBeInTheDocument();
    expect(screen.getByText('Cement')).toBeInTheDocument();
    // $200 / $150 appear both as the cell extended cost and the vendor total.
    expect(screen.getAllByText('$200').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$150').length).toBeGreaterThanOrEqual(1);
  });

  it('flags the lowest-priced cell and surfaces vendor totals', () => {
    mockUseRfqQuoteComparison.mockReturnValue({
      data: comparison,
      isLoading: false,
      isError: false,
    });
    render(<RfqQuoteComparisonTab rfqId="rfq-1" />);

    // The cheaper cell (Beta, $150) carries the "lowest" badge.
    expect(screen.getByText('comparisonTab.lowest')).toBeInTheDocument();
    // Both vendors' payment terms appear in the footer row.
    expect(screen.getByText(/Net 30/)).toBeInTheDocument();
    expect(screen.getByText(/Net 45/)).toBeInTheDocument();
  });

  it('renders a no-quote placeholder for unquoted cells', () => {
    mockUseRfqQuoteComparison.mockReturnValue({
      data: {
        ...comparison,
        rows: [
          {
            ...comparison.rows[0],
            lowestVendorId: 'v-1',
            cells: [
              comparison.rows[0].cells[0],
              {
                ...comparison.rows[0].cells[1],
                hasQuote: false,
                unitPrice: null,
                quotedQuantity: null,
                extendedCost: null,
                isLowest: false,
              },
            ],
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    render(<RfqQuoteComparisonTab rfqId="rfq-1" />);

    expect(screen.getByText('comparisonTab.noQuote')).toBeInTheDocument();
  });
});
