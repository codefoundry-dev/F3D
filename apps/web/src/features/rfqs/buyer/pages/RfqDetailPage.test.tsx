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
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
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
  RfqResponsesTab: () => <div data-testid="rfq-responses-tab" />,
  ResponsesViewToggle: ({
    viewMode,
    onViewModeChange,
  }: {
    viewMode: string;
    onViewModeChange: (mode: 'list' | 'table') => void;
  }) => (
    <button
      data-testid="responses-view-toggle"
      onClick={() => onViewModeChange(viewMode === 'list' ? 'table' : 'list')}
    >
      {viewMode}
    </button>
  ),
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
  Button: ({
    children,
    leftIcon,
    onClick,
  }: {
    children: React.ReactNode;
    leftIcon?: React.ReactNode;
    variant?: string;
    size?: string;
    onClick?: () => void;
  }) => (
    <button data-testid="btn" onClick={onClick}>
      {leftIcon}
      {children}
    </button>
  ),
  Spinner: ({ size }: { size?: string }) => <div data-testid="spinner" data-size={size} />,
}));

vi.mock('@forethread/ui-components/assets/icons/caret-left.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-back" {...props} />,
}));
vi.mock('@forethread/ui-components/assets/icons/download.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-download" {...props} />,
}));

vi.mock('../components/RfqDetailsTab', () => ({
  RfqDetailsTab: () => <div data-testid="rfq-details-tab" />,
}));
vi.mock('../components/RfqDocumentsTab', () => ({
  RfqDocumentsTab: () => <div data-testid="rfq-documents-tab" />,
}));
vi.mock('../components/RfqLineItemsTab', () => ({
  RfqLineItemsTab: () => <div data-testid="rfq-line-items-tab" />,
}));

import RfqDetailPage from './RfqDetailPage';

const MOCK_RFQ = {
  id: 'RFQ-2024-008',
  name: 'Test RFQ',
  projectName: 'Test Project',
  projectId: 'PRJ-001',
  status: 'IN_REVIEW',
  rfqType: 'Standard',
  paymentTerms: 'Net 30',
  pickUp: false,
  pickUpDate: null,
  deliveryLocation: '123 Main St',
  pickUpLocation: null,
  deadlineStart: '2024-03-01',
  deadlineEnd: '2024-03-15',
  needByDate: '2024-04-01',
  totalRequestedQty: 500,
  approvalStatus: 'Pending',
  approvedBy: null,
  createdBy: { id: '1', name: 'John Doe' },
  lastModifiedBy: null,
  lineItems: [],
  vendors: [],
  quoteResponses: [],
  documents: [],
  createdAt: '2024-01-15T00:00:00Z',
  updatedAt: '2024-01-20T00:00:00Z',
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

  it('renders tab navigation with export button', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('rfq-detail-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('right-slot')).toBeInTheDocument();
  });

  it('renders details tab by default', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('rfq-details-tab')).toBeInTheDocument();
  });

  it('switches to documents tab', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });
    fireEvent.click(screen.getByTestId('tab-documents'));
    expect(setSearchParams).toHaveBeenCalledWith({ tab: 'documents' }, { replace: true });
  });

  it('renders error message when RFQ fails to load', () => {
    mockUseRfq.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('switches to lineItems tab', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });
    fireEvent.click(screen.getByTestId('tab-lineItems'));
    expect(setSearchParams).toHaveBeenCalledWith({ tab: 'lineItems' }, { replace: true });
  });

  it('switches to responses tab', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });
    fireEvent.click(screen.getByTestId('tab-responses'));
    expect(setSearchParams).toHaveBeenCalledWith({ tab: 'responses' }, { replace: true });
  });

  it('renders responses tab content when tab=responses in URL', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=responses'), setSearchParams]);
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('rfq-responses-tab')).toBeInTheDocument();
  });

  it('renders lineItems tab content when tab=lineItems in URL', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=lineItems'), setSearchParams]);
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('rfq-line-items-tab')).toBeInTheDocument();
  });

  it('renders documents tab content when tab=documents in URL', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=documents'), setSearchParams]);
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('rfq-documents-tab')).toBeInTheDocument();
  });

  it('renders responses view toggle when on responses tab', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=responses'), setSearchParams]);
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('responses-view-toggle')).toBeInTheDocument();
  });

  it('defaults to details tab for invalid tab param', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=invalid'), setSearchParams]);
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('rfq-details-tab')).toBeInTheDocument();
  });

  it('renders no data when rfq is null but not error', () => {
    mockUseRfq.mockReturnValue({ data: null, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('toggles responses view mode', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=responses'), setSearchParams]);
    render(<RfqDetailPage />, { wrapper });
    const toggle = screen.getByTestId('responses-view-toggle');
    expect(toggle).toHaveTextContent('list');
    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent('table');
  });

  it('hides right slot on lineItems tab', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=lineItems'), setSearchParams]);
    render(<RfqDetailPage />, { wrapper });
    expect(screen.queryByTestId('right-slot')).not.toBeInTheDocument();
  });

  it('clicks export button and calls exportRfqs', async () => {
    const { exportRfqs } = await import('@forethread/api-client');
    (exportRfqs as ReturnType<typeof vi.fn>).mockResolvedValue({ url: 'http://test.com/file.pdf' });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });
    const btns = screen.getAllByTestId('btn');
    const exportBtn = btns.find((b) => b.textContent?.includes('actions.exportAs'));
    expect(exportBtn).toBeTruthy();
    fireEvent.click(exportBtn!);
    expect(exportRfqs).toHaveBeenCalledWith('pdf', { search: 'RFQ-2024-008' });
    openSpy.mockRestore();
  });

  it('hides right slot on documents tab', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=documents'), setSearchParams]);
    render(<RfqDetailPage />, { wrapper });
    expect(screen.queryByTestId('right-slot')).not.toBeInTheDocument();
  });
});
