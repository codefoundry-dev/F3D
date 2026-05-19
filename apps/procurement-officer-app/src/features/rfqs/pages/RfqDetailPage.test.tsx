import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const mockUseRfq = vi.hoisted(() => vi.fn());
const mockUseParams = vi.hoisted(() => vi.fn());
const mockUseSearchParams = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', () => ({
  exportRfqs: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useParams: mockUseParams,
  useSearchParams: mockUseSearchParams,
}));

vi.mock('@forethread/rfq-shared', () => ({
  useRfq: mockUseRfq,
  usePageTitleStore: () => vi.fn(),
  RfqDetailTabs: ({
    activeTab,
    onTabChange,
    rightSlot,
  }: {
    activeTab: string;
    onTabChange: (tab: string) => void;
    rightSlot?: React.ReactNode;
  }) => (
    <div data-testid="rfq-detail-tabs" data-active={activeTab}>
      <button data-testid="tab-details" onClick={() => onTabChange('details')}>
        Details
      </button>
      <button data-testid="tab-lineItems" onClick={() => onTabChange('lineItems')}>
        Line Items
      </button>
      <button data-testid="tab-responses" onClick={() => onTabChange('responses')}>
        Responses
      </button>
      <button data-testid="tab-documents" onClick={() => onTabChange('documents')}>
        Documents
      </button>
      {rightSlot && <div data-testid="right-slot">{rightSlot}</div>}
    </div>
  ),
  RfqDocumentsTab: () => <div data-testid="rfq-documents-tab" />,
  RfqLineItemsTab: () => <div data-testid="rfq-line-items-tab" />,
  RfqResponsesTab: () => <div data-testid="rfq-responses-tab" />,
  ResponsesViewToggle: () => <div data-testid="responses-view-toggle" />,
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({
    children,
    leftIcon,
  }: {
    children: React.ReactNode;
    leftIcon?: React.ReactNode;
    variant?: string;
    size?: string;
    onClick?: () => void;
  }) => (
    <button data-testid="btn">
      {leftIcon}
      {children}
    </button>
  ),
  Spinner: ({ size }: { size?: string }) => <div data-testid="spinner" data-size={size} />,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/download.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-download" {...props} />,
}));

vi.mock('../components/RfqDetailsTab', () => ({
  RfqDetailsTab: () => <div data-testid="rfq-details-tab" />,
}));

import RfqDetailPage from './RfqDetailPage';

const MOCK_RFQ = {
  id: 'RFQ-2024-008',
  name: 'Test RFQ',
  projectName: 'Test Project',
  status: 'IN_REVIEW',
  lineItems: [],
  quoteResponses: [],
  documents: [],
};

describe('RfqDetailPage', () => {
  const setSearchParams = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ id: 'RFQ-2024-008' });
    mockUseSearchParams.mockReturnValue([new URLSearchParams(), setSearchParams]);
  });

  it('renders spinner while loading', () => {
    mockUseRfq.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders error state when RFQ not found', () => {
    mockUseRfq.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('renders RFQ detail page with tabs and content', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('rfq-detail-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('rfq-details-tab')).toBeInTheDocument();
  });

  it('renders export button on details tab', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('right-slot')).toBeInTheDocument();
  });

  it('switches to documents tab', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });
    fireEvent.click(screen.getByTestId('tab-documents'));
    expect(setSearchParams).toHaveBeenCalledWith({ tab: 'documents' }, { replace: true });
  });

  it('renders line items tab content', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=lineItems'), setSearchParams]);
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('rfq-line-items-tab')).toBeInTheDocument();
  });

  it('renders responses tab content with view toggle', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=responses'), setSearchParams]);
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('rfq-responses-tab')).toBeInTheDocument();
  });

  it('renders documents tab content', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=documents'), setSearchParams]);
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('rfq-documents-tab')).toBeInTheDocument();
  });

  it('defaults to details tab for invalid tab param', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=invalid'), setSearchParams]);
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('rfq-details-tab')).toBeInTheDocument();
  });

  it('renders no data when rfq is null', () => {
    mockUseRfq.mockReturnValue({ data: null, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('handles missing id param by passing empty string', () => {
    mockUseParams.mockReturnValue({});
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });
    expect(mockUseRfq).toHaveBeenCalledWith('');
  });

  it('renders responses tab with view toggle in rightSlot', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=responses'), setSearchParams]);
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('responses-view-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('right-slot')).toBeInTheDocument();
  });

  it('does not render rightSlot for lineItems tab', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=lineItems'), setSearchParams]);
    render(<RfqDetailPage />, { wrapper });
    expect(screen.queryByTestId('right-slot')).not.toBeInTheDocument();
  });
});
