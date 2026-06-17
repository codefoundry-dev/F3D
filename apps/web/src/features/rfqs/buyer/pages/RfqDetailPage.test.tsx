import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const mockUseRfq = vi.hoisted(() => vi.fn());
const mockUseParams = vi.hoisted(() => vi.fn());
const mockUseSearchParams = vi.hoisted(() => vi.fn());
const mockSendRfq = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
}));
const mockUpdateRfq = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
}));
const mockCreateDraftPoMutate = vi.hoisted(() => vi.fn());
const mockUseCreateDraftPoFromQuote = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../services/rfqs.service', () => ({
  useSendRfq: () => mockSendRfq,
  useUpdateRfq: () => mockUpdateRfq,
}));

// Lightweight stand-in so the detail-page test doesn't depend on the dialog's
// internals (Modal, CC parsing — those are covered by SendRfqDialog's own test).
vi.mock('../components/create/SendRfqDialog', () => ({
  SendRfqDialog: ({ vendorCount, isError, onSend, onCancel }: any) => (
    <div role="dialog" data-testid="send-dialog">
      <span data-testid="send-dialog-count">{vendorCount}</span>
      {isError && <span data-testid="send-dialog-error">error</span>}
      <button data-testid="dialog-confirm" onClick={() => onSend(['ops@acme.com'])}>
        confirm
      </button>
      <button data-testid="dialog-cancel" onClick={onCancel}>
        cancel
      </button>
    </div>
  ),
}));

// Lightweight stand-in — the dialog's seeding/save internals are covered by
// ManageVendorsDialog's own test.
vi.mock('../components/ManageVendorsDialog', () => ({
  ManageVendorsDialog: ({ currentVendorIds, isError, onSave, onCancel }: any) => (
    <div role="dialog" data-testid="vendors-dialog">
      <span data-testid="vendors-dialog-count">{currentVendorIds.length}</span>
      {isError && <span data-testid="vendors-dialog-error">error</span>}
      <button data-testid="vendors-dialog-save" onClick={() => onSave(['company-9'])}>
        save
      </button>
      <button data-testid="vendors-dialog-cancel" onClick={onCancel}>
        cancel
      </button>
    </div>
  ),
}));

vi.mock('@forethread/api-client', () => ({
  exportRfqs: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useParams: mockUseParams,
  useSearchParams: mockUseSearchParams,
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('@forethread/rfq-shared', () => ({
  useRfq: mockUseRfq,
  useCreateDraftPoFromQuote: mockUseCreateDraftPoFromQuote,
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
    disabled,
    title,
    ...props
  }: {
    children: React.ReactNode;
    leftIcon?: React.ReactNode;
    variant?: string;
    size?: string;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
    'data-testid'?: string;
  }) => (
    <button
      data-testid={props['data-testid'] ?? 'btn'}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {leftIcon}
      {children}
    </button>
  ),
  Spinner: ({ size }: { size?: string }) => <div data-testid="spinner" data-size={size} />,
  toast: mockToast,
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
    mockSendRfq.isPending = false;
    mockSendRfq.isError = false;
    mockSendRfq.mutateAsync.mockResolvedValue({ ...MOCK_RFQ, status: 'OPEN' });
    mockUpdateRfq.isPending = false;
    mockUpdateRfq.isError = false;
    mockUpdateRfq.mutateAsync.mockResolvedValue({ ...MOCK_RFQ });
    mockUseCreateDraftPoFromQuote.mockReturnValue({
      mutate: mockCreateDraftPoMutate,
      isPending: false,
    });
  });

  /** An AWARDED RFQ whose winning quote is the APPROVED response. */
  const AWARDED_RFQ = {
    ...MOCK_RFQ,
    status: 'AWARDED',
    quoteResponses: [
      { id: 'qr-1', vendorId: 'company-1', vendorName: 'Acme', status: 'DECLINED' },
      { id: 'qr-2', vendorId: 'company-2', vendorName: 'BuildCo', status: 'APPROVED' },
    ],
  };

  /** A sendable DRAFT RFQ (status DRAFT, with line items + vendors). */
  const DRAFT_RFQ = {
    ...MOCK_RFQ,
    status: 'DRAFT',
    lineItems: [
      { id: 'li-1', materialName: 'Cement', quantity: 5, unit: 'bag', description: null },
    ],
    vendors: [
      { id: 'rv-1', vendorId: 'company-1', vendorName: 'Acme' },
      { id: 'rv-2', vendorId: 'company-2', vendorName: 'BuildCo' },
    ],
  };

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

  // ── Send to vendors (DRAFT only) ──────────────────────────────────────────

  it('shows the Send to vendors button for a DRAFT RFQ', () => {
    mockUseRfq.mockReturnValue({ data: DRAFT_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('send-to-vendors')).toBeInTheDocument();
  });

  it('hides the Send to vendors button when the RFQ is not a draft', () => {
    mockUseRfq.mockReturnValue({
      data: { ...DRAFT_RFQ, status: 'OPEN' },
      isLoading: false,
      isError: false,
    });
    render(<RfqDetailPage />, { wrapper });
    expect(screen.queryByTestId('send-to-vendors')).not.toBeInTheDocument();
  });

  it('disables Send when the draft has no line items or no vendors', () => {
    mockUseRfq.mockReturnValue({
      data: { ...DRAFT_RFQ, vendors: [] },
      isLoading: false,
      isError: false,
    });
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('send-to-vendors')).toBeDisabled();
  });

  it('opens the dialog with the vendor count and sends with the RFQ id + CC', async () => {
    mockUseRfq.mockReturnValue({ data: DRAFT_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });

    fireEvent.click(screen.getByTestId('send-to-vendors'));
    expect(screen.getByTestId('send-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('send-dialog-count')).toHaveTextContent('2');

    fireEvent.click(screen.getByTestId('dialog-confirm'));
    await waitFor(() =>
      expect(mockSendRfq.mutateAsync).toHaveBeenCalledWith({
        id: 'RFQ-2024-008',
        cc: ['ops@acme.com'],
      }),
    );
  });

  it('surfaces the send error in the dialog', () => {
    mockSendRfq.isError = true;
    mockUseRfq.mockReturnValue({ data: DRAFT_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });

    fireEvent.click(screen.getByTestId('send-to-vendors'));
    expect(screen.getByTestId('send-dialog-error')).toBeInTheDocument();
  });

  // ── Select vendors (DRAFT only) ───────────────────────────────────────────

  it('shows the Select vendors button for a DRAFT RFQ with no vendors', () => {
    mockUseRfq.mockReturnValue({
      data: { ...DRAFT_RFQ, vendors: [] },
      isLoading: false,
      isError: false,
    });
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('select-vendors')).toHaveTextContent('actions.selectVendors');
  });

  it('labels the button Edit vendors once the draft has vendors', () => {
    mockUseRfq.mockReturnValue({ data: DRAFT_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('select-vendors')).toHaveTextContent('actions.editVendors');
  });

  it('hides the Select vendors button when the RFQ is not a draft', () => {
    mockUseRfq.mockReturnValue({
      data: { ...DRAFT_RFQ, status: 'OPEN' },
      isLoading: false,
      isError: false,
    });
    render(<RfqDetailPage />, { wrapper });
    expect(screen.queryByTestId('select-vendors')).not.toBeInTheDocument();
  });

  it('opens the vendors dialog seeded with current vendors and saves vendorIds', async () => {
    mockUseRfq.mockReturnValue({ data: DRAFT_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });

    fireEvent.click(screen.getByTestId('select-vendors'));
    expect(screen.getByTestId('vendors-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('vendors-dialog-count')).toHaveTextContent('2');

    fireEvent.click(screen.getByTestId('vendors-dialog-save'));
    await waitFor(() =>
      expect(mockUpdateRfq.mutateAsync).toHaveBeenCalledWith({
        id: 'RFQ-2024-008',
        dto: { vendorIds: ['company-9'] },
      }),
    );
  });

  // ── Create draft PO (AWARDED fallback) ────────────────────────────────────

  it('shows the Create draft PO button for an AWARDED RFQ with an approved quote', () => {
    mockUseRfq.mockReturnValue({ data: AWARDED_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });
    expect(screen.getByTestId('create-draft-po')).toBeInTheDocument();
  });

  it('hides the Create draft PO button when the RFQ is not awarded', () => {
    mockUseRfq.mockReturnValue({ data: MOCK_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });
    expect(screen.queryByTestId('create-draft-po')).not.toBeInTheDocument();
  });

  it('hides the Create draft PO button when an awarded RFQ has no approved quote', () => {
    mockUseRfq.mockReturnValue({
      data: { ...AWARDED_RFQ, quoteResponses: [{ id: 'qr-1', status: 'DECLINED' }] },
      isLoading: false,
      isError: false,
    });
    render(<RfqDetailPage />, { wrapper });
    expect(screen.queryByTestId('create-draft-po')).not.toBeInTheDocument();
  });

  it('creates a draft PO from the approved quote, then toasts and navigates to it', () => {
    mockCreateDraftPoMutate.mockImplementation(
      (_quoteId: string, opts: { onSuccess: (p: unknown) => void }) =>
        opts.onSuccess([{ id: 'PO-1', poNumber: 'PO-2024-001' }]),
    );
    mockUseRfq.mockReturnValue({ data: AWARDED_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });

    fireEvent.click(screen.getByTestId('create-draft-po'));

    expect(mockCreateDraftPoMutate).toHaveBeenCalledWith('qr-2', expect.any(Object));
    expect(mockToast.success).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders/PO-1');
  });

  it('surfaces an error toast when draft PO creation fails', () => {
    mockCreateDraftPoMutate.mockImplementation(
      (_quoteId: string, opts: { onError: (e: unknown) => void }) =>
        opts.onError(new Error('boom')),
    );
    mockUseRfq.mockReturnValue({ data: AWARDED_RFQ, isLoading: false, isError: false });
    render(<RfqDetailPage />, { wrapper });

    fireEvent.click(screen.getByTestId('create-draft-po'));

    expect(mockToast.error).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
