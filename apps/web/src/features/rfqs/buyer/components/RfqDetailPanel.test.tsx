import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const mockUseRfq = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockExportRfqs = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', () => ({
  exportRfqs: mockExportRfqs,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/rfq-shared', () => ({
  useRfq: mockUseRfq,
  RfqDetailTabs: ({
    activeTab,
    onTabChange,
  }: {
    activeTab: string;
    onTabChange: (tab: string) => void;
  }) => (
    <div data-testid="rfq-detail-tabs" data-active={activeTab}>
      <button data-testid="tab-lineItems" onClick={() => onTabChange('lineItems')}>
        Line items
      </button>
    </div>
  ),
  RfqResponsesTab: () => <div data-testid="rfq-responses-tab" />,
}));

vi.mock('@forethread/ui-components', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
  Spinner: ({ size }: { size?: string }) => <div data-testid="spinner" data-size={size} />,
  getStatusColor: (_map: Record<string, string>, status: string) => status ?? 'default',
  RFQ_STATUS_COLORS: {},
}));

/* Stub SVG icons */
vi.mock('@forethread/ui-components/assets/icons/arrow-line-right.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-collapse" {...props} />,
}));
vi.mock('@forethread/ui-components/assets/icons/arrows-out-simple.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-fullscreen" {...props} />,
}));
vi.mock('@forethread/ui-components/assets/icons/download.svg?react', () => ({
  default: (props: Record<string, unknown>) => <svg data-testid="icon-download" {...props} />,
}));

/* Stub child components */
vi.mock('./RfqDetailsTab', () => ({
  RfqDetailsTab: () => <div data-testid="rfq-details-tab" />,
}));
vi.mock('./RfqDocumentsTab', () => ({
  RfqDocumentsTab: () => <div data-testid="rfq-documents-tab" />,
}));
vi.mock('./RfqLineItemsTab', () => ({
  RfqLineItemsTab: () => <div data-testid="rfq-line-items-tab" />,
}));

import { RfqDetailPanel } from './RfqDetailPanel';

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

describe('RfqDetailPanel', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders spinner while loading', () => {
    mockUseRfq.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<RfqDetailPanel rfqId="RFQ-2024-008" onClose={onClose} />, { wrapper });
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders error state', () => {
    mockUseRfq.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<RfqDetailPanel rfqId="RFQ-2024-008" onClose={onClose} />, { wrapper });
    expect(screen.getByText('detail.failedToLoad')).toBeInTheDocument();
  });

  it('renders RFQ detail with title and status badge', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPanel rfqId="RFQ-2024-008" onClose={onClose} />, { wrapper });
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByTestId('badge')).toHaveTextContent('status.IN_REVIEW');
  });

  it('renders tab navigation', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPanel rfqId="RFQ-2024-008" onClose={onClose} />, { wrapper });
    expect(screen.getByTestId('rfq-detail-tabs')).toBeInTheDocument();
  });

  it('renders details tab by default', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPanel rfqId="RFQ-2024-008" onClose={onClose} />, { wrapper });
    expect(screen.getByTestId('rfq-details-tab')).toBeInTheDocument();
  });

  it('calls onClose when collapse button is clicked', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPanel rfqId="RFQ-2024-008" onClose={onClose} />, { wrapper });
    fireEvent.click(screen.getByTitle('actions.collapse'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('navigates to fullscreen when fullscreen button is clicked', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPanel rfqId="RFQ-2024-008" onClose={onClose} />, { wrapper });
    fireEvent.click(screen.getByTitle('actions.fullscreen'));
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs/RFQ-2024-008');
  });

  it('switches tabs when tab is clicked', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPanel rfqId="RFQ-2024-008" onClose={onClose} />, { wrapper });
    fireEvent.click(screen.getByTestId('tab-lineItems'));
    expect(screen.getByTestId('rfq-line-items-tab')).toBeInTheDocument();
  });

  it('renders download button on details tab', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPanel rfqId="RFQ-2024-008" onClose={onClose} />, { wrapper });
    expect(screen.getByTitle('actions.download')).toBeInTheDocument();
  });

  it('calls exportRfqs when download button clicked', () => {
    mockExportRfqs.mockResolvedValue({ url: 'http://test.com/file.pdf' });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPanel rfqId="RFQ-2024-008" onClose={onClose} />, { wrapper });
    fireEvent.click(screen.getByTitle('actions.download'));
    expect(mockExportRfqs).toHaveBeenCalledWith('pdf', { search: 'RFQ-2024-008' });
    openSpy.mockRestore();
  });

  it('calls onClose and navigates on fullscreen click', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPanel rfqId="RFQ-2024-008" onClose={onClose} />, { wrapper });
    fireEvent.click(screen.getByTitle('actions.fullscreen'));
    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs/RFQ-2024-008');
  });
});
