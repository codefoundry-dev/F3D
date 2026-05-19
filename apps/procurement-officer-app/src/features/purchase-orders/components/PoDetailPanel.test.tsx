const mockNavigate = vi.hoisted(() => vi.fn());
const mockExportPurchaseOrders = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ url: 'https://example.com/file.pdf' }),
);
const mockPoData = vi.hoisted(() => ({
  value: {
    data: {
      id: 'po-1',
      poNumber: 'PO-001',
      projectName: 'Test Project',
      status: 'PENDING',
      lineItems: [],
      documents: [],
    },
    isLoading: false,
    isError: false,
  } as Record<string, unknown>,
}));

vi.mock('@forethread/api-client', () => ({
  exportPurchaseOrders: mockExportPurchaseOrders,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/po-shared', () => ({
  CreatePoWizard: (_props: any) => <div data-testid="create-po-wizard" />,
  usePurchaseOrder: () => mockPoData.value,
  PoDetailTabs: ({
    activeTab,
    onTabChange,
  }: {
    activeTab: string;
    onTabChange: (t: string) => void;
  }) => (
    <div data-testid="po-tabs">
      <button data-testid="tab-details" onClick={() => onTabChange('details')}>
        details
      </button>
      <button data-testid="tab-lineItems" onClick={() => onTabChange('lineItems')}>
        lineItems
      </button>
      <button data-testid="tab-documents" onClick={() => onTabChange('documents')}>
        documents
      </button>
      <span>{activeTab}</span>
    </div>
  ),
  PoDetailsTab: () => <div data-testid="po-details-tab" />,
  PoLineItemsTab: () => <div data-testid="po-line-items-tab" />,
  PoDocumentsTab: () => <div data-testid="po-documents-tab" />,
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: {
    purchaseOrderDetail: '/purchase-orders/:id',
    purchaseOrderComms: '/purchase-orders/:id/comms',
    purchaseOrders: '/purchase-orders',
  },
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
  getStatusColor: () => 'bg-gray-100',
  PO_STATUS_COLORS: {},
  Spinner: () => <div data-testid="spinner" />,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

import { render, screen, fireEvent } from '@testing-library/react';

import { PoDetailPanel } from './PoDetailPanel';

describe('PoDetailPanel', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPoData.value = {
      data: {
        id: 'po-1',
        poNumber: 'PO-001',
        projectName: 'Test Project',
        status: 'PENDING',
        lineItems: [],
        documents: [],
      },
      isLoading: false,
      isError: false,
    };
  });

  it('renders loading spinner', () => {
    mockPoData.value.isLoading = true;
    mockPoData.value.data = null;
    render(<PoDetailPanel poId="po-1" onClose={onClose} />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders error message', () => {
    mockPoData.value.isError = true;
    mockPoData.value.data = null;
    render(<PoDetailPanel poId="po-1" onClose={onClose} />);
    expect(screen.getByText('detail.failedToLoad')).toBeInTheDocument();
  });

  it('renders PO details when data loads', () => {
    render(<PoDetailPanel poId="po-1" onClose={onClose} />);
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByTestId('po-details-tab')).toBeInTheDocument();
  });

  it('calls onClose and navigates on fullscreen click', () => {
    render(<PoDetailPanel poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByTitle('actions.fullscreen'));
    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders/po-1');
  });

  it('calls onClose on collapse click', () => {
    render(<PoDetailPanel poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByTitle('actions.collapse'));
    expect(onClose).toHaveBeenCalled();
  });

  it('switches to lineItems tab', () => {
    render(<PoDetailPanel poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('tab-lineItems'));
    expect(screen.getByTestId('po-line-items-tab')).toBeInTheDocument();
  });

  it('switches to documents tab', () => {
    render(<PoDetailPanel poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('tab-documents'));
    expect(screen.getByTestId('po-documents-tab')).toBeInTheDocument();
  });

  it('download button calls export on details tab', () => {
    render(<PoDetailPanel poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByTitle('actions.download'));
    expect(mockExportPurchaseOrders).toHaveBeenCalledWith('pdf', { search: 'po-1' });
  });

  it('hides download button on non-details tab', () => {
    render(<PoDetailPanel poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('tab-lineItems'));
    expect(screen.queryByTitle('actions.download')).not.toBeInTheDocument();
  });
});
