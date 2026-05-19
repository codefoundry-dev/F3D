const mockRfqData = vi.hoisted(() => ({
  value: {
    data: {
      id: 'rfq-1',
      lineItems: [{ id: 'li-1' }],
      quoteResponses: [
        { id: 'q1', vendorName: 'Vendor A' },
        { id: 'q2', vendorName: 'Vendor B' },
      ],
    },
    isLoading: false,
    isError: false,
  } as Record<string, unknown>,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'rfq-1', quoteId: 'q1' }),
  useSearchParams: () => [new URLSearchParams('tab=messages'), vi.fn()],
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (sel: (s: { setTitle: () => void }) => unknown) => sel({ setTitle: vi.fn() }),
  useRfq: () => mockRfqData.value,
  QuoteResponseDetailPage: ({
    rfqId,
    quoteResponse,
    initialTab,
  }: {
    rfqId: string;
    quoteResponse: { id: string; vendorName: string };
    initialTab: string;
  }) => (
    <div data-testid="shared-detail">
      <span>{rfqId}</span>
      <span>{quoteResponse.vendorName}</span>
      <span>{initialTab}</span>
    </div>
  ),
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

import { render, screen } from '@testing-library/react';

import QuoteResponseDetailPage from './QuoteResponseDetailPage';

describe('QuoteResponseDetailPage', () => {
  beforeEach(() => {
    mockRfqData.value = {
      data: {
        id: 'rfq-1',
        lineItems: [{ id: 'li-1' }],
        quoteResponses: [
          { id: 'q1', vendorName: 'Vendor A' },
          { id: 'q2', vendorName: 'Vendor B' },
        ],
      },
      isLoading: false,
      isError: false,
    };
  });

  it('shows spinner when loading', () => {
    mockRfqData.value.isLoading = true;
    render(<QuoteResponseDetailPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows no data when error', () => {
    mockRfqData.value.isError = true;
    mockRfqData.value.data = null;
    render(<QuoteResponseDetailPage />);
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('shows no data when quote not found', () => {
    mockRfqData.value.data = {
      ...(mockRfqData.value.data as object),
      quoteResponses: [{ id: 'q999', vendorName: 'Other' }],
    };
    render(<QuoteResponseDetailPage />);
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('renders shared detail page', () => {
    render(<QuoteResponseDetailPage />);
    expect(screen.getByTestId('shared-detail')).toBeInTheDocument();
    expect(screen.getByText('Vendor A')).toBeInTheDocument();
    expect(screen.getByText('messages')).toBeInTheDocument();
  });
});
