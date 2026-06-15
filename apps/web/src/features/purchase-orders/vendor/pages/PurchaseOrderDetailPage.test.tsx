import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockPoState = vi.hoisted(() => ({
  value: {
    data: {
      id: 'po-123',
      poNumber: 'PO-ABC12345',
      projectName: 'Test Project',
      lineItems: [],
      documents: [],
      createdBy: { id: 'user-1' },
    } as Record<string, unknown> | null,
    isLoading: false,
    isError: false,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'po-123' }) };
});

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/po-shared', () => ({
  usePurchaseOrder: () => mockPoState.value,
  usePoActionLog: () => ({ logs: [], isLoading: false }),
  PoDetailTabs: ({
    activeTab,
    rightSlot,
    onTabChange,
  }: {
    activeTab: string;
    rightSlot?: React.ReactNode;
    onTabChange?: (tab: string) => void;
  }) => (
    <div data-testid="po-tabs">
      {activeTab}
      {rightSlot && <div data-testid="right-slot">{rightSlot}</div>}
      {onTabChange && (
        <button data-testid="switch-tab" onClick={() => onTabChange('messages')}>
          switch
        </button>
      )}
    </div>
  ),
  PoDetailsTab: () => <div>details-tab</div>,
  PoLineItemsTab: () => <div>line-items-tab</div>,
  PoDocumentsTab: () => <div>documents-tab</div>,
  PoMessagesTab: () => <div>messages-tab</div>,
  PoPurchaseOrdersTab: () => <div>purchase-orders-tab</div>,
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: () => vi.fn(),
}));

const mockExportPurchaseOrders = vi.fn((_id: string, _format: string) =>
  Promise.resolve({ url: 'https://example.com/pdf' }),
);

vi.mock('@forethread/api-client', () => ({
  exportPurchaseOrders: (id: string, format: string) => mockExportPurchaseOrders(id, format),
  getVendorProfile: () => Promise.resolve({ warehouseLocations: [] }),
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  Spinner: () => <div data-testid="spinner" />,
}));

vi.mock('@forethread/ui-components/assets/icons/download.svg?react', () => ({
  default: () => <span />,
}));

import PurchaseOrderDetailPage from './PurchaseOrderDetailPage';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderWithProviders(ui: React.ReactElement, { initialEntries = ['/'] } = {}) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PurchaseOrderDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPoState.value = {
      data: {
        id: 'po-123',
        poNumber: 'PO-ABC12345',
        projectName: 'Test Project',
        lineItems: [],
        documents: [],
        createdBy: { id: 'user-1' },
      },
      isLoading: false,
      isError: false,
    };
  });

  it('renders details tab by default', () => {
    renderWithProviders(<PurchaseOrderDetailPage />);
    expect(screen.getByText('details-tab')).toBeInTheDocument();
  });

  it('renders tab bar', () => {
    renderWithProviders(<PurchaseOrderDetailPage />);
    expect(screen.getByTestId('po-tabs')).toBeInTheDocument();
  });

  it('shows spinner when loading', () => {
    mockPoState.value = { data: null, isLoading: true, isError: false };
    renderWithProviders(<PurchaseOrderDetailPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows error state when isError', () => {
    mockPoState.value = { data: null, isLoading: false, isError: true };
    renderWithProviders(<PurchaseOrderDetailPage />);
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('shows error state when no data', () => {
    mockPoState.value = { data: null, isLoading: false, isError: false };
    renderWithProviders(<PurchaseOrderDetailPage />);
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('renders download button on details tab', () => {
    renderWithProviders(<PurchaseOrderDetailPage />);
    expect(screen.getByText('actions.exportAs')).toBeInTheDocument();
  });

  it('clicking download button triggers export', () => {
    renderWithProviders(<PurchaseOrderDetailPage />);
    fireEvent.click(screen.getByText('actions.exportAs'));
    expect(mockExportPurchaseOrders).toHaveBeenCalledWith('pdf', { search: 'po-123' });
  });

  it('renders lineItems tab when selected', () => {
    renderWithProviders(<PurchaseOrderDetailPage />, { initialEntries: ['?tab=lineItems'] });
    expect(screen.getByText('line-items-tab')).toBeInTheDocument();
  });

  it('renders documents tab when selected', () => {
    renderWithProviders(<PurchaseOrderDetailPage />, { initialEntries: ['?tab=documents'] });
    expect(screen.getByText('documents-tab')).toBeInTheDocument();
  });

  it('renders messages tab when selected', () => {
    renderWithProviders(<PurchaseOrderDetailPage />, { initialEntries: ['?tab=messages'] });
    expect(screen.getByText('messages-tab')).toBeInTheDocument();
  });

  it('renders with undefined lineItems and documents', () => {
    mockPoState.value = {
      data: {
        id: 'po-123',
        poNumber: 'PO-ABC12345',
        projectName: 'Test Project',
        lineItems: undefined,
        documents: undefined,
        createdBy: { id: 'user-1' },
      },
      isLoading: false,
      isError: false,
    };
    renderWithProviders(<PurchaseOrderDetailPage />, { initialEntries: ['?tab=lineItems'] });
    expect(screen.getByText('line-items-tab')).toBeInTheDocument();
  });

  it('renders documents with undefined documents field', () => {
    mockPoState.value = {
      data: {
        id: 'po-123',
        poNumber: 'PO-ABC12345',
        projectName: 'Test Project',
        lineItems: [],
        documents: undefined,
        createdBy: { id: 'user-1' },
      },
      isLoading: false,
      isError: false,
    };
    renderWithProviders(<PurchaseOrderDetailPage />, { initialEntries: ['?tab=documents'] });
    expect(screen.getByText('documents-tab')).toBeInTheDocument();
  });

  it('falls back to details tab for invalid tab param', () => {
    renderWithProviders(<PurchaseOrderDetailPage />, { initialEntries: ['?tab=invalidTab'] });
    expect(screen.getByText('details-tab')).toBeInTheDocument();
  });
});
