import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockPo = {
  id: 'po-123',
  poNumber: 'PO-ABC12345',
  projectName: 'Test Project',
  lineItems: [],
  documents: [],
};

const mockUsePurchaseOrder = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'po-123' }) };
});

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/po-shared', () => ({
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
    <div data-testid="po-tabs">
      {activeTab}
      {rightSlot}
      <button data-testid="tab-lineItems" onClick={() => onTabChange('lineItems')}>
        lineItems
      </button>
      <button data-testid="tab-documents" onClick={() => onTabChange('documents')}>
        documents
      </button>
      <button data-testid="tab-messages" onClick={() => onTabChange('messages')}>
        messages
      </button>
    </div>
  ),
  PoDetailsTab: () => <div>details-tab</div>,
  PoLineItemsTab: () => <div>line-items-tab</div>,
  PoDocumentsTab: () => <div>documents-tab</div>,
  PoMessagesTab: () => <div>messages-tab</div>,
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: () => vi.fn(),
}));

vi.mock('@forethread/api-client', () => ({
  exportPurchaseOrders: vi.fn().mockResolvedValue({ url: 'http://test.com/file.pdf' }),
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
    leftIcon?: React.ReactNode;
  }) => (
    <button data-testid="ui-btn" onClick={onClick}>
      {children}
    </button>
  ),
  Spinner: ({ size }: { size?: string }) => <div data-testid="spinner" data-size={size} />,
}));

vi.mock('@forethread/ui-components/assets/icons/download.svg?react', () => ({
  default: () => <span />,
}));

import PurchaseOrderDetailPage from './PurchaseOrderDetailPage';

describe('PurchaseOrderDetailPage', () => {
  beforeEach(() => {
    mockUsePurchaseOrder.mockReturnValue({ data: mockPo, isLoading: false, isError: false });
  });

  it('renders details tab by default', () => {
    render(
      <MemoryRouter>
        <PurchaseOrderDetailPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('details-tab')).toBeInTheDocument();
  });

  it('renders tab bar', () => {
    render(
      <MemoryRouter>
        <PurchaseOrderDetailPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('po-tabs')).toBeInTheDocument();
  });

  it('renders spinner while loading', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(
      <MemoryRouter>
        <PurchaseOrderDetailPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders error state when isError', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(
      <MemoryRouter>
        <PurchaseOrderDetailPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('renders error state when no data', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: null, isLoading: false, isError: false });
    render(
      <MemoryRouter>
        <PurchaseOrderDetailPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('switches to lineItems tab', () => {
    render(
      <MemoryRouter>
        <PurchaseOrderDetailPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('tab-lineItems'));
    expect(screen.getByText('line-items-tab')).toBeInTheDocument();
  });

  it('switches to documents tab', () => {
    render(
      <MemoryRouter>
        <PurchaseOrderDetailPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('tab-documents'));
    expect(screen.getByText('documents-tab')).toBeInTheDocument();
  });

  it('switches to messages tab', () => {
    render(
      <MemoryRouter>
        <PurchaseOrderDetailPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('tab-messages'));
    expect(screen.getByText('messages-tab')).toBeInTheDocument();
  });

  it('renders export button on details tab', () => {
    render(
      <MemoryRouter>
        <PurchaseOrderDetailPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('actions.exportAs')).toBeInTheDocument();
  });

  it('hides export button on non-details tab', () => {
    render(
      <MemoryRouter>
        <PurchaseOrderDetailPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('tab-lineItems'));
    expect(screen.queryByText('actions.exportAs')).not.toBeInTheDocument();
  });

  it('reads tab from search params', () => {
    render(
      <MemoryRouter initialEntries={['/?tab=documents']}>
        <PurchaseOrderDetailPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('documents-tab')).toBeInTheDocument();
  });

  it('clicks export button and calls exportPurchaseOrders', async () => {
    const { exportPurchaseOrders } = await import('@forethread/api-client');
    (exportPurchaseOrders as ReturnType<typeof vi.fn>).mockResolvedValue({
      url: 'http://test.com/file.pdf',
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <MemoryRouter>
        <PurchaseOrderDetailPage />
      </MemoryRouter>,
    );
    const exportBtn = screen.getByText('actions.exportAs');
    fireEvent.click(exportBtn);
    expect(exportPurchaseOrders).toHaveBeenCalledWith('pdf', { search: 'po-123' });
    openSpy.mockRestore();
  });
});
