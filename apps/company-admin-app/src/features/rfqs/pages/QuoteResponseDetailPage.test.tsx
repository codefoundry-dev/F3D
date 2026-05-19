import { render, screen } from '@testing-library/react';

const mockRfq = vi.hoisted(() => ({
  value: {
    data: {
      id: 'rfq-1',
      projectName: 'Project X',
      quoteResponses: [{ id: 'q-1', vendorName: 'Vendor A' }],
      lineItems: [],
    } as Record<string, unknown> | null,
    isLoading: false,
    isError: false,
  },
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'rfq-1', quoteId: 'q-1' }),
  useSearchParams: () => [new URLSearchParams('')],
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: (s: { setTitle: () => void }) => unknown) =>
    selector({ setTitle: vi.fn() }),
  useRfq: () => mockRfq.value,
  QuoteResponseDetailPage: ({ rfqId }: { rfqId: string }) => (
    <div data-testid="shared-quote-detail">RFQ: {rfqId}</div>
  ),
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
}));

import QuoteResponseDetailPage from './QuoteResponseDetailPage';

describe('QuoteResponseDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRfq.value = {
      data: {
        id: 'rfq-1',
        projectName: 'Project X',
        quoteResponses: [{ id: 'q-1', vendorName: 'Vendor A' }],
        lineItems: [],
      },
      isLoading: false,
      isError: false,
    };
  });

  it('renders shared detail page when data loaded', () => {
    render(<QuoteResponseDetailPage />);
    expect(screen.getByTestId('shared-quote-detail')).toBeInTheDocument();
  });

  it('shows spinner when loading', () => {
    mockRfq.value = { data: null, isLoading: true, isError: false };
    render(<QuoteResponseDetailPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows no data on error', () => {
    mockRfq.value = { data: null, isLoading: false, isError: true };
    render(<QuoteResponseDetailPage />);
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('shows no data when quote not found', () => {
    mockRfq.value = {
      data: {
        id: 'rfq-1',
        projectName: 'Project X',
        quoteResponses: [{ id: 'q-other', vendorName: 'Vendor B' }],
        lineItems: [],
      },
      isLoading: false,
      isError: false,
    };
    render(<QuoteResponseDetailPage />);
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });
});
