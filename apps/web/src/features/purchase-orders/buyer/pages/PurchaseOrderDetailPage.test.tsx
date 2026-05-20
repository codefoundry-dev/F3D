import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const mockUsePurchaseOrder = vi.hoisted(() => vi.fn());
const mockUseParams = vi.hoisted(() => vi.fn());
const mockUseSearchParams = vi.hoisted(() => vi.fn());
const mockExportPurchaseOrders = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useParams: mockUseParams,
  useSearchParams: mockUseSearchParams,
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: () => vi.fn(),
}));

vi.mock('@forethread/api-client', () => ({
  exportPurchaseOrders: mockExportPurchaseOrders,
}));

vi.mock('@forethread/po-shared', () => ({
  CreatePoWizard: (_props: any) => <div data-testid="create-po-wizard" />,
  usePurchaseOrder: mockUsePurchaseOrder,
  PoDetailTabs: ({
    activeTab,
    onTabChange,
    rightSlot,
  }: {
    activeTab: string;
    onTabChange: (tab: string) => void;
    rightSlot?: React.ReactNode;
  }) => (
    <div data-testid="po-detail-tabs" data-active={activeTab}>
      <button data-testid="tab-details" onClick={() => onTabChange('details')}>
        Details
      </button>
      <button data-testid="tab-lineItems" onClick={() => onTabChange('lineItems')}>
        Line Items
      </button>
      <button data-testid="tab-documents" onClick={() => onTabChange('documents')}>
        Documents
      </button>
      <button data-testid="tab-messages" onClick={() => onTabChange('messages')}>
        Messages
      </button>
      {rightSlot && <div data-testid="right-slot">{rightSlot}</div>}
    </div>
  ),
  PoDetailsTab: () => <div data-testid="po-details-tab" />,
  PoLineItemsTab: () => <div data-testid="po-line-items-tab" />,
  PoDocumentsTab: () => <div data-testid="po-documents-tab" />,
  PoMessagesTab: () => <div data-testid="po-messages-tab" />,
}));

vi.mock('@forethread/ui-components', () => ({
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
    <button data-testid="export-btn" onClick={onClick}>
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

import PurchaseOrderDetailPage from './PurchaseOrderDetailPage';

const MOCK_PO = {
  id: 'po-456',
  projectName: 'Test Project',
  status: 'DRAFT',
  poType: 'STANDARD',
  revision: 1,
  pickUp: false,
  deliveryLocation: null,
  pickUpLocation: null,
  totalAmount: null,
  lineItemCount: 0,
  deadlineStart: null,
  deadlineEnd: null,
  approvalStatus: null,
  approvedBy: null,
  createdBy: { id: '1', name: 'User' },
  vendor: { id: '1', name: 'Vendor' },
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  lineItems: [{ id: 'li-1', name: 'Item 1' }],
  documents: [{ id: 'doc-1', name: 'Doc 1' }],
};

describe('PurchaseOrderDetailPage', () => {
  const setSearchParams = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ id: 'po-456' });
    mockUseSearchParams.mockReturnValue([new URLSearchParams(), setSearchParams]);
  });

  it('renders spinner while loading', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<PurchaseOrderDetailPage />, { wrapper });
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders error state when PO fetch fails', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<PurchaseOrderDetailPage />, { wrapper });
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('renders no data when po is null', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: null, isLoading: false, isError: false });
    render(<PurchaseOrderDetailPage />, { wrapper });
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('renders PO detail page with tabs and details content', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: MOCK_PO, isLoading: false, isError: false });
    render(<PurchaseOrderDetailPage />, { wrapper });
    expect(screen.getByTestId('po-detail-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('po-details-tab')).toBeInTheDocument();
  });

  it('renders export button on details tab', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: MOCK_PO, isLoading: false, isError: false });
    render(<PurchaseOrderDetailPage />, { wrapper });
    expect(screen.getByTestId('right-slot')).toBeInTheDocument();
    expect(screen.getByText('actions.exportAs')).toBeInTheDocument();
  });

  it('calls exportPurchaseOrders and opens URL on export button click', async () => {
    mockUsePurchaseOrder.mockReturnValue({ data: MOCK_PO, isLoading: false, isError: false });
    mockExportPurchaseOrders.mockResolvedValue({ url: 'https://example.com/export.pdf' });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<PurchaseOrderDetailPage />, { wrapper });
    fireEvent.click(screen.getByTestId('export-btn'));

    await vi.waitFor(() => {
      expect(mockExportPurchaseOrders).toHaveBeenCalledWith('pdf', { search: 'po-456' });
    });
    await vi.waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith('https://example.com/export.pdf', '_blank');
    });

    openSpy.mockRestore();
  });

  it('switches tab when tab button is clicked', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: MOCK_PO, isLoading: false, isError: false });
    render(<PurchaseOrderDetailPage />, { wrapper });
    fireEvent.click(screen.getByTestId('tab-lineItems'));
    expect(setSearchParams).toHaveBeenCalledWith({ tab: 'lineItems' }, { replace: true });
  });

  it('renders line items tab content', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: MOCK_PO, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=lineItems'), setSearchParams]);
    render(<PurchaseOrderDetailPage />, { wrapper });
    expect(screen.getByTestId('po-line-items-tab')).toBeInTheDocument();
  });

  it('renders messages tab content', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: MOCK_PO, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=messages'), setSearchParams]);
    render(<PurchaseOrderDetailPage />, { wrapper });
    expect(screen.getByTestId('po-messages-tab')).toBeInTheDocument();
  });

  it('renders documents tab content', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: MOCK_PO, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=documents'), setSearchParams]);
    render(<PurchaseOrderDetailPage />, { wrapper });
    expect(screen.getByTestId('po-documents-tab')).toBeInTheDocument();
  });

  it('defaults to details tab for invalid tab param', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: MOCK_PO, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=invalid'), setSearchParams]);
    render(<PurchaseOrderDetailPage />, { wrapper });
    expect(screen.getByTestId('po-details-tab')).toBeInTheDocument();
  });

  it('does not render rightSlot for non-details tabs', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: MOCK_PO, isLoading: false, isError: false });
    mockUseSearchParams.mockReturnValue([new URLSearchParams('tab=lineItems'), setSearchParams]);
    render(<PurchaseOrderDetailPage />, { wrapper });
    expect(screen.queryByTestId('right-slot')).not.toBeInTheDocument();
  });

  it('handles missing id param by passing empty string', () => {
    mockUseParams.mockReturnValue({});
    mockUsePurchaseOrder.mockReturnValue({ data: MOCK_PO, isLoading: false, isError: false });
    render(<PurchaseOrderDetailPage />, { wrapper });
    expect(mockUsePurchaseOrder).toHaveBeenCalledWith('');
  });
});
