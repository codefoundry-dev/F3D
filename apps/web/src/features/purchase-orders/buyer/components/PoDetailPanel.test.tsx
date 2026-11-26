const mockNavigate = vi.hoisted(() => vi.fn());
const mockExportSinglePo = vi.hoisted(() =>
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
      createdBy: { id: 'user-1' },
    },
    isLoading: false,
    isError: false,
  } as Record<string, unknown>,
}));

vi.mock('@forethread/api-client', () => ({
  exportSinglePo: mockExportSinglePo,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ currentUser: { id: 'user-1' } }),
}));

vi.mock('@forethread/po-shared', () => ({
  CreatePoWizard: (_props: any) => <div data-testid="create-po-wizard" />,
  usePurchaseOrder: () => mockPoData.value,
  usePoActionLog: () => ({ logs: [], isLoading: false }),
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
      <button data-testid="tab-messages" onClick={() => onTabChange('messages')}>
        messages
      </button>
      <button data-testid="tab-actionLog" onClick={() => onTabChange('actionLog')}>
        actionLog
      </button>
      <span>{activeTab}</span>
    </div>
  ),
  PoDetailsTab: () => <div data-testid="po-details-tab" />,
  PoLineItemsTab: () => <div data-testid="po-line-items-tab" />,
  PoDocumentsTab: () => <div data-testid="po-documents-tab" />,
  PoMessagesTab: () => <div data-testid="po-messages-tab" />,
  PoActionLogTab: () => <div data-testid="po-action-log-tab" />,
}));

vi.mock('./PoSendButton', () => ({
  PoSendButton: () => <div data-testid="po-send-button" />,
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
        createdBy: { id: 'user-1' },
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
    // Panel title is the PO number (Figma US 2.07), not the project name
    expect(screen.getByText('PO-001')).toBeInTheDocument();
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

  it('switches to messages tab (FOR-353)', () => {
    render(<PoDetailPanel poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('tab-messages'));
    expect(screen.getByTestId('po-messages-tab')).toBeInTheDocument();
  });

  it('switches to action log tab (FOR-353)', () => {
    render(<PoDetailPanel poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('tab-actionLog'));
    expect(screen.getByTestId('po-action-log-tab')).toBeInTheDocument();
  });

  it('download button calls export on details tab', () => {
    render(<PoDetailPanel poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByTitle('actions.download'));
    expect(mockExportSinglePo).toHaveBeenCalledWith('po-1', 'pdf');
  });

  it('hides download button on non-details tab', () => {
    render(<PoDetailPanel poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('tab-lineItems'));
    expect(screen.queryByTitle('actions.download')).not.toBeInTheDocument();
  });
});
