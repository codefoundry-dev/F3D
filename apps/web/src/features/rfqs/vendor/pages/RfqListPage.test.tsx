import { render, screen, fireEvent } from '@testing-library/react';

/* ─── Hoisted spies / mutable mock state ─────────────────────────────────── */

const h = vi.hoisted(() => ({
  setPageTitle: vi.fn(),
  loadViews: vi.fn(),
  setShowCreateView: vi.fn(),
  setShowTableMgmt: vi.fn(),
  setQuickFilter: vi.fn(),
  rfqsResult: {
    data: {
      items: [
        {
          id: 'rfq-1',
          rfqNumber: 'RFQ-2025-001',
          projectName: 'Riverside Park Development',
          projectId: 'PRJ-1',
          status: 'INCOMING',
          createdBy: 'Contractor Co',
          deliveryLocation: 'Boston, MA',
          pickUpLocation: null,
          pickUp: false,
          deadlineRange: '2025-01-15 - 2025-01-15',
          lineItems: 2,
          recQuotes: 3,
          totalRequestedQty: 123,
          createdDate: '2025-01-01',
        },
      ],
      meta: { total: 1 },
    },
    isLoading: false,
  } as { data: unknown; isLoading: boolean },
}));

const mockNavigate = vi.fn();

/* ─── Module mocks ───────────────────────────────────────────────────────── */

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/api-client', () => ({
  exportRfqs: vi.fn(() => Promise.resolve({ url: 'https://example.com/pdf' })),
}));

const storeState = {
  savedViews: [] as unknown[],
  activeViewId: null,
  page: 1,
  pageSize: 25,
  search: '',
  searchOpen: false,
  sortBy: 'deadlineRange',
  sortDir: 'asc',
  quickFilter: '',
  groupBy: '',
  columnOrder: [
    'rfqId',
    'projectName',
    'contractorCompany',
    'contractorName',
    'rfqStatus',
    'resDeadline',
    'pickUp',
    'deliveryLocation',
    'pickUpLocation',
    'lineItems',
    'totalRespondedQuotes',
  ],
  visibleColumns: [
    'rfqId',
    'projectName',
    'contractorCompany',
    'contractorName',
    'rfqStatus',
    'resDeadline',
    'pickUp',
    'deliveryLocation',
    'pickUpLocation',
    'lineItems',
    'totalRespondedQuotes',
  ],
  advancedFilters: {
    status: [],
    projectId: [],
    deliveryLocation: [],
    createdByUserId: [],
    createdDateFrom: '',
    createdDateTo: '',
    deadlineFrom: '',
    deadlineTo: '',
    minApprovedQuotes: '',
    minApprovedVendors: '',
  },
  filtersOpen: false,
  showTableMgmt: false,
  showCreateView: false,
  previewOpen: false,
  previewRfqId: null,
  setPage: vi.fn(),
  setPageSize: vi.fn(),
  setSearch: vi.fn(),
  setSearchOpen: vi.fn(),
  setSortBy: vi.fn(),
  setSortDir: vi.fn(),
  setQuickFilter: h.setQuickFilter,
  setGroupBy: vi.fn(),
  setColumnOrder: vi.fn(),
  setVisibleColumns: vi.fn(),
  setAdvancedFilters: vi.fn(),
  clearAdvancedFilters: vi.fn(),
  setFiltersOpen: vi.fn(),
  setShowTableMgmt: h.setShowTableMgmt,
  setShowCreateView: h.setShowCreateView,
  applyView: vi.fn(),
  loadViews: h.loadViews,
  addSavedView: vi.fn(),
  deleteSavedView: vi.fn(),
  deleteAllSavedViews: vi.fn(),
  openPreview: vi.fn(),
  closePreview: vi.fn(),
};

vi.mock('@forethread/rfq-shared', () => ({
  createRfqTableStore: () => () => storeState,
  usePageTitleStore: (selector: (s: { setTitle: typeof h.setPageTitle }) => unknown) =>
    selector({ setTitle: h.setPageTitle }),
  useRfqs: () => h.rfqsResult,
  useRfqSort: () => ({ handleSort: vi.fn() }),
  useRfqGrouping: () => ({ groupedItems: null, expandedGroups: new Set(), toggleGroup: vi.fn() }),
  useRfqExport: () => ({ handleExport: vi.fn() }),
  RfqAdvancedFilters: () => <div data-testid="advanced-filters" />,
  VENDOR_COLUMNS: [
    { field: 'rfqNumber', key: 'rfqId' },
    { field: 'projectName', key: 'projectName' },
    { field: 'createdBy', key: 'contractorCompany' },
    { field: 'createdBy', key: 'contractorName' },
    { field: 'status', key: 'rfqStatus' },
    { field: 'deadlineRange', key: 'resDeadline' },
    { field: 'pickUp', key: 'pickUp' },
    { field: 'deliveryLocation', key: 'deliveryLocation' },
    { field: 'pickUpLocation', key: 'pickUpLocation' },
    { field: 'lineItems', key: 'lineItems' },
    { field: 'recQuotes', key: 'totalRespondedQuotes' },
  ],
  VENDOR_QUICK_FILTERS: ['myRfqs', 'openRfqs', 'approvedForMe', 'closedRfqs'],
  VENDOR_GROUP_OPTIONS: ['groupByStatus'],
  VENDOR_GROUP_FIELD_MAP: { groupByStatus: 'status' },
  VENDOR_RFQ_STATUS_KEYS: ['INCOMING', 'RESPONDED', 'APPROVED', 'REJECTED', 'CLOSED'],
  PAGE_SIZE_OPTIONS: [25, 50, 100],
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  CreateViewModal: () => <div data-testid="create-view-modal" />,
  DotActionsMenu: () => <button type="button" aria-label="more" />,
  ExportDropdownButton: () => <button type="button">export-dropdown</button>,
  FilterChip: ({ label, onClick }: { label: string; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
  FilterPanel: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <span>{label}</span>
      {children}
    </div>
  ),
  getStatusColor: () => '',
  GroupByButton: ({ label }: { label: string }) => <button type="button">{label}</button>,
  MessageBadgeIcon: ({ onClick }: { onClick?: () => void }) => (
    <button type="button" aria-label="messages" onClick={onClick} />
  ),
  VENDOR_RFQ_STATUS_COLORS: {},
  SortIcon: () => <span />,
  Spinner: () => <div data-testid="spinner" />,
  TableManagementModal: () => <div data-testid="table-management-modal" />,
  TablePagination: () => <div data-testid="pagination" />,
  ToolbarIconButton: ({
    title,
    children,
    onClick,
  }: {
    title?: string;
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" title={title} onClick={onClick}>
      {children}
    </button>
  ),
  ToolbarSearchToggle: () => <button type="button" aria-label="search-toggle" />,
  useColumnDragDrop: () => ({
    dragColKey: null,
    dragOverColKey: null,
    handleDragStart: vi.fn(),
    handleDragOver: vi.fn(),
    handleDrop: vi.fn(),
    handleDragEnd: vi.fn(),
  }),
  useDropdown: () => ({ isOpen: false, setIsOpen: vi.fn(), ref: { current: null } }),
  ViewSelectorDropdown: () => <button type="button">view-selector</button>,
}));

vi.mock('@forethread/ui-components/assets/icons/chevron-down.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/drag-and-drop.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/floppy-disk.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/settings.svg?react', () => ({
  default: () => <span />,
}));

vi.mock('../components/RfqDetailPanel', () => ({
  RfqDetailPanel: () => <div data-testid="rfq-detail-panel" />,
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: { rfqDetail: '/rfqs/:id', rfqResponse: '/rfqs/:id/response' },
}));

import RfqListPage from './RfqListPage';

describe('Vendor RfqListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.showTableMgmt = false;
    storeState.showCreateView = false;
    storeState.previewOpen = false;
    // Restore a known-good data shape each test.
    h.rfqsResult = {
      data: {
        items: [
          {
            id: 'rfq-1',
            rfqNumber: 'RFQ-2025-001',
            projectName: 'Riverside Park Development',
            projectId: 'PRJ-1',
            status: 'INCOMING',
            createdBy: 'Contractor Co',
            deliveryLocation: 'Boston, MA',
            pickUpLocation: null,
            pickUp: false,
            deadlineRange: '2025-01-15 - 2025-01-15',
            lineItems: 2,
            recQuotes: 3,
            totalRequestedQty: 123,
            createdDate: '2025-01-01',
          },
        ],
        meta: { total: 1 },
      },
      isLoading: false,
    };
  });

  it('sets the page title via the page-title store and clears on unmount', () => {
    const { unmount } = render(<RfqListPage />);
    expect(h.setPageTitle).toHaveBeenCalledWith('list.title', 'list.subtitle');
    unmount();
    expect(h.setPageTitle).toHaveBeenLastCalledWith(null);
  });

  it('loads saved views on mount', () => {
    render(<RfqListPage />);
    expect(h.loadViews).toHaveBeenCalled();
  });

  it('does NOT render a "Create new" button (vendors cannot create RFQs)', () => {
    render(<RfqListPage />);
    expect(screen.queryByText('list.createNew')).not.toBeInTheDocument();
  });

  it('renders the shared toolbar controls (view / export / group / search)', () => {
    render(<RfqListPage />);
    expect(screen.getByText('view-selector')).toBeInTheDocument();
    expect(screen.getByText('export-dropdown')).toBeInTheDocument();
    expect(screen.getByText('list.group')).toBeInTheDocument();
    expect(screen.getByLabelText('search-toggle')).toBeInTheDocument();
  });

  it('renders the four vendor quick filters', () => {
    render(<RfqListPage />);
    expect(screen.getByText('quickFilters.myRfqs')).toBeInTheDocument();
    expect(screen.getByText('quickFilters.openRfqs')).toBeInTheDocument();
    expect(screen.getByText('quickFilters.approvedForMe')).toBeInTheDocument();
    expect(screen.getByText('quickFilters.closedRfqs')).toBeInTheDocument();
  });

  it('renders RFQ rows with mapped column data', () => {
    render(<RfqListPage />);
    expect(screen.getByText('RFQ-2025-001')).toBeInTheDocument();
    expect(screen.getByText('Riverside Park Development')).toBeInTheDocument();
    // contractorCompany + contractorName both render createdBy.
    expect(screen.getAllByText('Contractor Co').length).toBe(2);
    expect(screen.getByText('Boston, MA')).toBeInTheDocument();
  });

  it('shows the spinner while loading', () => {
    h.rfqsResult = { data: undefined, isLoading: true };
    render(<RfqListPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows an empty state when there are no RFQs', () => {
    h.rfqsResult = { data: { items: [], meta: { total: 0 } }, isLoading: false };
    render(<RfqListPage />);
    expect(screen.getByText('list.noRfqsFound')).toBeInTheDocument();
  });

  it('clicking a quick filter calls setQuickFilter', () => {
    render(<RfqListPage />);
    fireEvent.click(screen.getByText('quickFilters.myRfqs'));
    expect(h.setQuickFilter).toHaveBeenCalledWith('myRfqs');
  });
});
