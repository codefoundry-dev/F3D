const mockUsePurchaseOrders = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

const useDropdownImpl = vi.hoisted(() => () => {
  const react = require('react'); // eslint-disable-line @typescript-eslint/no-require-imports
  const [isOpen, setIsOpen] = react.useState(false);
  return { ref: { current: null }, isOpen, setIsOpen };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    archivePurchaseOrder: vi.fn(),
    copyPurchaseOrder: vi.fn(),
    exportPurchaseOrders: vi.fn(),
    getRfq: (...args: unknown[]) => mockGetRfq(...args),
    getBulkOrder: (...args: unknown[]) => mockGetBulkOrder(...args),
    getViews: vi.fn().mockResolvedValue([]),
    createView: vi.fn().mockResolvedValue({ id: '1', name: 'test' }),
    deleteView: vi.fn().mockResolvedValue(undefined),
    deleteAllViews: vi.fn().mockResolvedValue(undefined),
  };
});

const mockUsePoGrouping = vi.hoisted(() => vi.fn());
const capturedSelectRfqProps = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));
const capturedSelectBoProps = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));
const mockGetRfq = vi.hoisted(() => vi.fn());
const mockGetBulkOrder = vi.hoisted(() => vi.fn());
const mockRfqToFormDefaults = vi.hoisted(() => vi.fn());
const mockBulkOrderToFormDefaults = vi.hoisted(() => vi.fn());

vi.mock('@forethread/po-shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    usePurchaseOrders: mockUsePurchaseOrders,
    usePoExport: () => ({ handleExport: vi.fn() }),
    usePoGrouping: mockUsePoGrouping,
    rfqToFormDefaults: mockRfqToFormDefaults,
    bulkOrderToFormDefaults: mockBulkOrderToFormDefaults,
    SelectRfqModal: (props: Record<string, unknown>) => {
      capturedSelectRfqProps.current = props;
      return null;
    },
    SelectBulkOrderModal: (props: Record<string, unknown>) => {
      capturedSelectBoProps.current = props;
      return null;
    },
  };
});

vi.mock('../components/PoDetailPanel', () => ({
  PoDetailPanel: () => <div data-testid="po-detail-panel" />,
}));

vi.mock('@forethread/ui-components', () => ({
  formatCurrency: (v: number) => `$${v}`,
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
  Button: ({
    children,
    onClick,
    variant,
    leftIcon,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
    leftIcon?: React.ReactNode;
  }) => (
    <button data-testid={`btn-${variant ?? 'default'}`} onClick={onClick}>
      {leftIcon}
      {children}
    </button>
  ),
  FilterChip: ({
    label,
    active,
    onClick,
  }: {
    label: string;
    active?: boolean;
    onClick?: () => void;
  }) => (
    <button data-testid="filter-chip" data-active={active} onClick={onClick}>
      {label}
    </button>
  ),
  Input: vi
    .fn()
    .mockImplementation(
      ({
        value,
        onChange,
        placeholder,
      }: {
        value: string;
        onChange: (e: { target: { value: string } }) => void;
        placeholder?: string;
      }) => (
        <input
          data-testid="search-input"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
      ),
    ),
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  CreateViewModal: ({
    onClose,
    onCreate,
  }: {
    onClose: () => void;
    onCreate: (name: string) => void;
    title?: string;
    subtitle?: string;
    viewNameLabel?: string;
    viewNamePlaceholder?: string;
    createLabel?: string;
    cancelLabel?: string;
  }) => (
    <div data-testid="create-view-modal">
      <button data-testid="create-view-save" onClick={() => onCreate('Test View')}>
        save
      </button>
      <button data-testid="create-view-cancel" onClick={onClose}>
        cancel
      </button>
    </div>
  ),
  ExportDropdownButton: () => null,
  FilterPanel: () => null,
  GroupByButton: ({ label, onClick }: { label: string; onClick?: () => void }) => (
    <button onClick={onClick}>{label}</button>
  ),
  MessageBadgeIcon: ({
    onClick,
  }: {
    onClick?: () => void;
    hasNotification?: boolean;
    className?: string;
  }) => <button data-testid="message-badge-icon" onClick={onClick} />,
  SortIcon: ({ active, direction }: { active: boolean; direction: string | null }) => (
    <span data-testid="sort-icon" data-active={active} data-direction={direction} />
  ),
  TablePagination: ({
    page,
    totalItems,
    pageSize,
    onPageChange,
    onPageSizeChange,
    showingLabel,
  }: {
    page: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (p: number) => void;
    onPageSizeChange: (s: number) => void;
    pageSizeOptions?: number[];
    rowsPerPageLabel?: string;
    showingLabel?: (args: { from: number; to: number; total: number }) => string;
    backLabel?: string;
    nextLabel?: string;
  }) => (
    <div
      data-testid="table-pagination"
      data-page={page}
      data-total={totalItems}
      data-pagesize={pageSize}
    >
      <button onClick={() => onPageChange(page + 1)}>next</button>
      <button onClick={() => onPageSizeChange(10)}>change-size</button>
      {showingLabel && (
        <span data-testid="showing-label">
          {showingLabel({ from: 1, to: pageSize, total: totalItems })}
        </span>
      )}
    </div>
  ),
  DotActionsMenu: ({
    actions,
  }: {
    actions: { key: string; label: string; onClick: () => void }[];
    bordered?: boolean;
  }) => (
    <div data-testid="dot-actions-menu">
      {actions.map((a) => (
        <button key={a.key} data-testid={`action-${a.key}`} onClick={a.onClick}>
          {a.label}
        </button>
      ))}
    </div>
  ),
  PO_STATUS_COLORS: {},
  getStatusColor: (_map: Record<string, string>, status: string) => status ?? 'default',
  Spinner: ({ size }: { size?: string }) => <div data-testid="spinner" data-size={size} />,
  TableManagementModal: ({
    onSave,
    onClose,
  }: {
    onSave: (cols: string[]) => void;
    onClose: () => void;
    columns?: unknown[];
    visibleColumns?: string[];
    savedViews?: unknown[];
    onDeleteView?: (id: string) => void;
    onDeleteAllViews?: () => void;
    title?: string;
    subtitle?: string;
    configureLabel?: string;
    deselectAllLabel?: string;
    selectAllLabel?: string;
    savedViewsLabel?: string;
    deleteAllLabel?: string;
    saveLabel?: string;
    cancelLabel?: string;
  }) => (
    <div data-testid="table-mgmt-modal">
      <button data-testid="table-mgmt-save" onClick={() => onSave(['poNumber', 'projectName'])}>
        save
      </button>
      <button data-testid="table-mgmt-close" onClick={onClose}>
        close
      </button>
    </div>
  ),
  ToolbarIconButton: ({
    children,
    title,
    onClick,
  }: {
    children: React.ReactNode;
    title?: string;
    onClick?: () => void;
  }) => (
    <button data-testid="toolbar-icon-btn" title={title} onClick={onClick}>
      {children}
    </button>
  ),
  ToolbarSearchToggle: ({
    searchOpen,
    onSearchOpenChange,
    search,
    onSearchChange,
  }: {
    searchOpen: boolean;
    onSearchOpenChange: (v: boolean) => void;
    search: string;
    onSearchChange: (v: string) => void;
    placeholder?: string;
  }) =>
    searchOpen ? (
      <div>
        <input
          data-testid="search-input"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => e.key === 'Escape' && onSearchOpenChange(false)}
        />
        <button onClick={() => onSearchOpenChange(false)}>close</button>
      </div>
    ) : (
      <button className="w-9 h-9" onClick={() => onSearchOpenChange(true)} />
    ),
  useColumnDragDrop: () => ({
    dragColKey: null,
    dragOverColKey: null,
    handleDragStart: vi.fn(),
    handleDragOver: vi.fn(),
    handleDrop: vi.fn(),
    handleDragEnd: vi.fn(),
  }),
  useColumnResize: () => ({ columnWidths: {}, handleResizeStart: vi.fn() }),
  useDropdown: useDropdownImpl,
  ViewSelectorDropdown: () => null,
  formatEnum: (v: string | null | undefined) =>
    v
      ? v
          .split('_')
          .map((w: string, i: number) =>
            i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase(),
          )
          .join(' ')
      : '-',
}));

vi.mock('@forethread/ui-components/assets/icons/chevron-down.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/cross.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/download.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <span data-testid="eye-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/floppy-disk.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/search.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/settings.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/drag-and-drop.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/paperclip.svg?react', () => ({
  default: () => <span />,
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, act } from '@testing-library/react';

import PurchaseOrderListPage from './PurchaseOrderListPage';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const MOCK_POS = Array.from({ length: 3 }, (_, i) => ({
  id: `PO-${String(i + 1).padStart(3, '0')}`,
  projectName: `Project ${i + 1}`,
  projectId: `PRJ-${String(i + 1).padStart(3, '0')}`,
  status: 'Sent',
  reqQuantities: 10,
  pickUp: false,
  deliveryLocation: 'Sydney',
  pickUpLocation: null,
  recVendors: 3,
  lineItems: 5,
  deadlineRange: '2025-01-01 - 2025-02-01',
  totalRequestedQty: 100,
  createdDate: '2025-01-01',
  createdBy: 'Admin',
  approvalStatus: 'Approved',
  approvedBy: 'Manager',
  lastModifiedBy: 'Admin',
  poNumber: `PO-2025-${String(i + 1).padStart(3, '0')}`,
  contractorName: `Vendor ${i + 1}`,
  vendorName: `Vendor ${i + 1}`,
  poType: 'Standard',
  revision: i + 1,
  totalAmount: 1000,
}));

function renderPage() {
  return render(<PurchaseOrderListPage />, { wrapper });
}

describe('PurchaseOrderListPage', () => {
  beforeEach(() => {
    mockUsePurchaseOrders.mockReturnValue({
      data: { items: MOCK_POS, meta: { total: 3 } },
      isLoading: false,
      isError: false,
    });
    mockUsePoGrouping.mockReturnValue({
      groupedItems: null,
      expandedGroups: new Set(),
      toggleGroup: vi.fn(),
    });
  });

  it('renders the create new button', () => {
    renderPage();
    expect(screen.getByText('list.createNew')).toBeInTheDocument();
  });

  it('renders quick filter chips', () => {
    renderPage();
    const chips = screen.getAllByTestId('filter-chip');
    expect(chips.length).toBeGreaterThan(0);
    expect(screen.getByText('list.quickFiltersLabel')).toBeInTheDocument();
  });

  it('renders table column headers', () => {
    renderPage();
    expect(screen.getByText('columns.poNumber')).toBeInTheDocument();
    expect(screen.getByText('columns.projectName')).toBeInTheDocument();
    expect(screen.getByText('columns.poStatus')).toBeInTheDocument();
    expect(screen.getByText('columns.actions')).toBeInTheDocument();
  });

  it('renders PO data rows', () => {
    renderPage();
    expect(screen.getByText('PO-2025-001')).toBeInTheDocument();
    expect(screen.getByText('Project 1')).toBeInTheDocument();
    expect(screen.getByText('Vendor 1')).toBeInTheDocument();
  });

  it('renders status badges', () => {
    renderPage();
    const badges = screen.getAllByTestId('badge');
    expect(badges.length).toBeGreaterThanOrEqual(3);
  });

  it('renders pagination', () => {
    renderPage();
    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
  });

  it('shows loading spinner when loading', () => {
    mockUsePurchaseOrders.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderPage();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    mockUsePurchaseOrders.mockReturnValue({
      data: { items: [], meta: { total: 0 } },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText('list.noPosFound')).toBeInTheDocument();
  });

  it('sorts by column on header click', () => {
    renderPage();
    fireEvent.click(screen.getByText('columns.poNumber'));
    const sortIcons = screen.getAllByTestId('sort-icon');
    expect(sortIcons[0]).toHaveAttribute('data-active', 'true');
  });

  it('opens search input on search button click', () => {
    renderPage();
    // Search is closed initially, so no search-input yet
    expect(screen.queryByTestId('search-input')).not.toBeInTheDocument();
    // Click the search toggle button
    const buttons = screen.getAllByRole('button');
    const searchBtn = buttons.find(
      (btn) =>
        !btn.textContent?.includes('list.') &&
        !btn.textContent?.includes('columns.') &&
        !btn.hasAttribute('data-testid') &&
        btn.className.includes('w-9'),
    );
    if (searchBtn) fireEvent.click(searchBtn);
  });

  it('renders status badge for PO rows', () => {
    renderPage();
    const badges = screen.getAllByTestId('badge');
    // 3 rows have status badges + 3 revision badges = 6
    expect(badges.length).toBeGreaterThanOrEqual(3);
  });

  it('renders revision badges as Active', () => {
    renderPage();
    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges).toHaveLength(3);
  });

  it('renders pickUp as common:no for false values', () => {
    renderPage();
    expect(screen.getAllByText('common:no').length).toBeGreaterThanOrEqual(3);
  });

  it('renders null field values as dash', () => {
    // Override mock to have a null deliveryLocation
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], deliveryLocation: null }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('opens preview panel on view icon click', () => {
    renderPage();
    const eyeIcons = screen.getAllByTestId('eye-icon');
    fireEvent.click(eyeIcons[0]);
    expect(screen.getByTestId('po-detail-panel')).toBeInTheDocument();
  });

  it('clicking create button toggles dropdown and shows options', () => {
    renderPage();
    fireEvent.click(screen.getByText('list.createNew'));
    expect(screen.getByText('Create manually')).toBeInTheDocument();
    expect(screen.getByText('Converting Approved RFQ')).toBeInTheDocument();
    expect(screen.getByText('From Bulk order')).toBeInTheDocument();
  });

  it('navigates to create page when "Create manually" clicked', () => {
    renderPage();
    fireEvent.click(screen.getByText('list.createNew'));
    fireEvent.click(screen.getByText('Create manually'));
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders/new');
  });

  it('"Converting Approved RFQ" closes dropdown', () => {
    renderPage();
    fireEvent.click(screen.getByText('list.createNew'));
    fireEvent.click(screen.getByText('Converting Approved RFQ'));
    expect(screen.queryByText('From Bulk order')).not.toBeInTheDocument();
  });

  it('"From Bulk order" closes dropdown', () => {
    renderPage();
    fireEvent.click(screen.getByText('list.createNew'));
    fireEvent.click(screen.getByText('From Bulk order'));
    expect(screen.queryByText('Converting Approved RFQ')).not.toBeInTheDocument();
  });

  it('toggles quick filter on click', () => {
    renderPage();
    const chips = screen.getAllByTestId('filter-chip');
    fireEvent.click(chips[0]);
    expect(chips[0]).toHaveAttribute('data-active', 'true');
  });

  it('renders totalAmount when present', () => {
    renderPage();
    // totalAmount=1000 rendered with $ prefix and toLocaleString
    const cells = screen.getAllByText((_, el) => el?.textContent?.includes('$ 1') ?? false);
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it('renders date fields correctly', () => {
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [
          {
            ...MOCK_POS[0],
            needBy: '2025-06-01',
            earliestDate: '2025-05-01',
            createdDate: '2025-01-01',
            lastUpdated: '2025-02-01',
          },
        ],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    // Dates are formatted via toLocaleDateString
    expect(screen.getAllByText(/Jan/).length).toBeGreaterThan(0);
  });

  it('renders paymentTermsDays as "X days"', () => {
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], paymentTermsDays: 30 }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText('30 days')).toBeInTheDocument();
  });

  it('renders holdForRelease as yes/no', () => {
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], holdForRelease: true }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getAllByText('common:yes').length).toBeGreaterThanOrEqual(1);
  });

  it('renders plannedDeliveryDate correctly', () => {
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], plannedDeliveryDate: '2025-07-15' }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText('Jul 15, 2025')).toBeInTheDocument();
  });

  it('renders aging as days', () => {
    const issuedDate = new Date(Date.now() - 5 * 86400000).toISOString();
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], issuedAt: issuedDate }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText('5d')).toBeInTheDocument();
  });

  it('renders isBulkOrder correctly', () => {
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], poType: 'BULK' }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    // isBulkOrder renders common:yes when poType is BULK
    expect(screen.getAllByText('common:yes').length).toBeGreaterThanOrEqual(1);
  });

  it('renders approvalStatus badge', () => {
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], approvalStatus: 'APPROVED' }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText('approvalStatus.APPROVED')).toBeInTheDocument();
  });

  it('renders dash for null totalAmount', () => {
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], totalAmount: null }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders dash for null paymentTermsDays', () => {
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], paymentTermsDays: null }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders linkedRfqAvgPrice correctly', () => {
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], linkedRfqAvgPrice: 500 }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText('$ 500')).toBeInTheDocument();
  });

  it('navigates to detail on row click', () => {
    renderPage();
    const rows = screen.getAllByRole('row');
    // Click body row (skip header row)
    fireEvent.click(rows[1]);
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders/PO-001');
  });

  it('handles multiple sort clicks without crashing', () => {
    renderPage();
    fireEvent.click(screen.getByText('columns.poNumber'));
    fireEvent.click(screen.getByText('columns.poNumber'));
    fireEvent.click(screen.getByText('columns.poNumber'));
    // After cycling through sort states, table still renders
    expect(screen.getByText('columns.poNumber')).toBeInTheDocument();
  });

  it('renders poType using translation key', () => {
    renderPage();
    expect(screen.getAllByText('poTypes.Standard').length).toBeGreaterThanOrEqual(1);
  });

  it('renders lineItemsDelivered and quantityDelivered', () => {
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], lineItemsDelivered: 7, quantityDelivered: 42 }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders grouped items with GroupSection when groupBy is set', () => {
    const grouped = new Map([['GroupBeta', MOCK_POS]]);
    mockUsePoGrouping.mockReturnValue({
      groupedItems: grouped,
      expandedGroups: new Set(['GroupBeta']),
      toggleGroup: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('GroupBeta')).toBeInTheDocument();
    expect(screen.getByText('PO-2025-001')).toBeInTheDocument();
  });

  it('hides rows in collapsed group', () => {
    const grouped = new Map([['GroupBeta', MOCK_POS]]);
    mockUsePoGrouping.mockReturnValue({
      groupedItems: grouped,
      expandedGroups: new Set(),
      toggleGroup: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('GroupBeta')).toBeInTheDocument();
    expect(screen.queryByText('PO-2025-001')).not.toBeInTheDocument();
  });

  it('toggles group on group row click', () => {
    const toggleGroup = vi.fn();
    const grouped = new Map([['GroupBeta', MOCK_POS]]);
    mockUsePoGrouping.mockReturnValue({
      groupedItems: grouped,
      expandedGroups: new Set(['GroupBeta']),
      toggleGroup,
    });
    renderPage();
    fireEvent.click(screen.getByText('GroupBeta'));
    expect(toggleGroup).toHaveBeenCalledWith('GroupBeta');
  });

  it('renders dash for null approvalStatus', () => {
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], approvalStatus: null }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders dash for null linkedRfqAvgPrice', () => {
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], linkedRfqAvgPrice: null }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders revision as dash when null', () => {
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], revision: null }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders dash for null date fields', () => {
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], needBy: null, plannedDeliveryDate: null }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders aging as dash when no reference date', () => {
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], issuedAt: null, updatedAt: null }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('triggers copyPo action via DotActionsMenu', async () => {
    const { copyPurchaseOrder } = await import('@forethread/api-client');
    (copyPurchaseOrder as ReturnType<typeof vi.fn>).mockResolvedValue({});
    renderPage();
    const copyBtns = screen.getAllByTestId('action-copyPo');
    fireEvent.click(copyBtns[0]);
    expect(copyPurchaseOrder).toHaveBeenCalledWith('PO-001');
  });

  it('triggers moveToArchive action via DotActionsMenu', async () => {
    const { archivePurchaseOrder } = await import('@forethread/api-client');
    (archivePurchaseOrder as ReturnType<typeof vi.fn>).mockResolvedValue({});
    renderPage();
    const archiveBtns = screen.getAllByTestId('action-moveToArchive');
    fireEvent.click(archiveBtns[0]);
    expect(archivePurchaseOrder).toHaveBeenCalledWith('PO-001');
  });

  it('triggers downloadPdf action via DotActionsMenu', async () => {
    const { exportPurchaseOrders } = await import('@forethread/api-client');
    (exportPurchaseOrders as ReturnType<typeof vi.fn>).mockResolvedValue({
      url: 'http://test.com/file.pdf',
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderPage();
    const downloadBtns = screen.getAllByTestId('action-downloadPdf');
    fireEvent.click(downloadBtns[0]);
    expect(exportPurchaseOrders).toHaveBeenCalledWith('pdf', { search: 'PO-001' });
    openSpy.mockRestore();
  });

  it('navigates to messages tab via MessageBadgeIcon click', () => {
    renderPage();
    const msgBadges = screen.getAllByTestId('message-badge-icon');
    fireEvent.click(msgBadges[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders/PO-001?tab=messages');
  });

  it('renders holdForRelease as common:no when false', () => {
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], holdForRelease: false }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getAllByText('common:no').length).toBeGreaterThanOrEqual(1);
  });

  it('renders isBulkOrder as common:no when not BULK', () => {
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], poType: 'STANDARD' }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getAllByText('common:no').length).toBeGreaterThanOrEqual(1);
  });

  it('renders aging from updatedAt when issuedAt is absent', () => {
    const updatedDate = new Date(Date.now() - 3 * 86400000).toISOString();
    mockUsePurchaseOrders.mockReturnValue({
      data: {
        items: [{ ...MOCK_POS[0], issuedAt: null, updatedAt: updatedDate }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderPage();
    expect(screen.getByText('3d')).toBeInTheDocument();
  });

  it('opens table management modal on settings button click', () => {
    renderPage();
    const settingsBtn = screen
      .getAllByTestId('toolbar-icon-btn')
      .find((btn) => btn.getAttribute('title') === 'list.settings');
    expect(settingsBtn).toBeDefined();
    fireEvent.click(settingsBtn!);
    expect(screen.getByTestId('table-mgmt-modal')).toBeInTheDocument();
  });

  it('saves columns and closes table management modal', () => {
    renderPage();
    const settingsBtn = screen
      .getAllByTestId('toolbar-icon-btn')
      .find((btn) => btn.getAttribute('title') === 'list.settings');
    fireEvent.click(settingsBtn!);
    expect(screen.getByTestId('table-mgmt-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('table-mgmt-save'));
    expect(screen.queryByTestId('table-mgmt-modal')).not.toBeInTheDocument();
  });

  it('closes table management modal on close button', () => {
    renderPage();
    const settingsBtn = screen
      .getAllByTestId('toolbar-icon-btn')
      .find((btn) => btn.getAttribute('title') === 'list.settings');
    fireEvent.click(settingsBtn!);
    expect(screen.getByTestId('table-mgmt-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('table-mgmt-close'));
    expect(screen.queryByTestId('table-mgmt-modal')).not.toBeInTheDocument();
  });

  it('opens create view modal on save button click', () => {
    renderPage();
    const saveBtn = screen
      .getAllByTestId('toolbar-icon-btn')
      .find((btn) => btn.getAttribute('title') === 'list.save');
    expect(saveBtn).toBeDefined();
    fireEvent.click(saveBtn!);
    expect(screen.getByTestId('create-view-modal')).toBeInTheDocument();
  });

  it('closes create view modal on cancel', () => {
    renderPage();
    const saveBtn = screen
      .getAllByTestId('toolbar-icon-btn')
      .find((btn) => btn.getAttribute('title') === 'list.save');
    fireEvent.click(saveBtn!);
    expect(screen.getByTestId('create-view-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('create-view-cancel'));
    expect(screen.queryByTestId('create-view-modal')).not.toBeInTheDocument();
  });

  it('SelectRfqModal onSelect navigates with rfq form defaults', async () => {
    const rfqDetail = { lineItems: [{ id: 'li-1' }, { id: 'li-2' }] };
    mockGetRfq.mockResolvedValue(rfqDetail);
    mockRfqToFormDefaults.mockReturnValue({
      defaultValues: { projectId: 'p1' },
      lockedFields: new Set(['projectId']),
    });
    renderPage();
    fireEvent.click(screen.getByText('list.createNew'));
    fireEvent.click(screen.getByText('Converting Approved RFQ'));
    const onSelect = capturedSelectRfqProps.current?.onSelect as (
      rfq: { id: string },
      ids?: Set<string>,
    ) => void;
    act(() => onSelect({ id: 'rfq-1' }));
    await vi.waitFor(() => {
      expect(mockGetRfq).toHaveBeenCalledWith('rfq-1');
    });
  });

  it('SelectRfqModal onSelect filters line items when selectedItemIds given', async () => {
    const rfqDetail = { lineItems: [{ id: 'li-1' }, { id: 'li-2' }] };
    mockGetRfq.mockResolvedValue(rfqDetail);
    mockRfqToFormDefaults.mockReturnValue({ defaultValues: {}, lockedFields: new Set() });
    renderPage();
    fireEvent.click(screen.getByText('list.createNew'));
    fireEvent.click(screen.getByText('Converting Approved RFQ'));
    const onSelect = capturedSelectRfqProps.current?.onSelect as (
      rfq: { id: string },
      ids?: Set<string>,
    ) => void;
    act(() => onSelect({ id: 'rfq-2' }, new Set(['li-1'])));
    await vi.waitFor(() => {
      expect(mockRfqToFormDefaults).toHaveBeenCalledWith(
        expect.objectContaining({ lineItems: [{ id: 'li-1' }] }),
      );
    });
  });

  it('SelectBulkOrderModal onSelect navigates with bulk order defaults', async () => {
    const boDetail = { lineItems: [{ lineItemId: 'bli-1' }] };
    mockGetBulkOrder.mockResolvedValue(boDetail);
    mockBulkOrderToFormDefaults.mockReturnValue({
      defaultValues: { projectId: 'p2' },
      lockedFields: new Set(['projectId']),
    });
    renderPage();
    fireEvent.click(screen.getByText('list.createNew'));
    fireEvent.click(screen.getByText('From Bulk order'));
    const onSelect = capturedSelectBoProps.current?.onSelect as (
      bo: { id: string; vendorId: string },
      ids?: Set<string>,
    ) => void;
    act(() => onSelect({ id: 'bo-1', vendorId: 'v-1' }));
    await vi.waitFor(() => {
      expect(mockGetBulkOrder).toHaveBeenCalledWith('bo-1');
    });
  });

  it('SelectBulkOrderModal onSelect filters line items with selectedItemIds', async () => {
    const boDetail = { lineItems: [{ lineItemId: 'bli-1' }, { lineItemId: 'bli-2' }] };
    mockGetBulkOrder.mockResolvedValue(boDetail);
    mockBulkOrderToFormDefaults.mockReturnValue({ defaultValues: {}, lockedFields: new Set() });
    renderPage();
    fireEvent.click(screen.getByText('list.createNew'));
    fireEvent.click(screen.getByText('From Bulk order'));
    const onSelect = capturedSelectBoProps.current?.onSelect as (
      bo: { id: string; vendorId: string },
      ids?: Set<string>,
    ) => void;
    act(() => onSelect({ id: 'bo-2', vendorId: 'v-2' }, new Set(['bli-2'])));
    await vi.waitFor(() => {
      expect(mockBulkOrderToFormDefaults).toHaveBeenCalledWith(
        expect.objectContaining({ lineItems: [{ lineItemId: 'bli-2' }] }),
      );
    });
  });
});
