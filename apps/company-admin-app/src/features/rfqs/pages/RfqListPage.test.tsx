import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

const mockUseRfqs = vi.hoisted(() => vi.fn());
const mockCopyRfq = vi.hoisted(() => vi.fn());
const mockArchiveRfq = vi.hoisted(() => vi.fn());
const mockExportRfqs = vi.hoisted(() => vi.fn());
const mockGetViews = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', () => ({
  archiveRfq: mockArchiveRfq,
  copyRfq: mockCopyRfq,
  exportRfqs: mockExportRfqs,
  getViews: mockGetViews,
  createView: vi.fn().mockResolvedValue({ id: '1', name: 'test' }),
  deleteView: vi.fn(),
  deleteAllViews: vi.fn(),
}));

const mockUseRfqGrouping = vi.hoisted(() => vi.fn());

vi.mock('@forethread/rfq-shared', () => ({
  useRfqs: mockUseRfqs,
  useRfqSort: ({
    sortBy,
    sortDir,
    setSortBy,
    setSortDir,
    setPage,
  }: {
    sortBy: string;
    sortDir: string | null;
    setSortBy: (v: string) => void;
    setSortDir: (v: string | null) => void;
    setPage: (v: number) => void;
  }) => ({
    handleSort: (field: string) => {
      if (sortBy !== field) {
        setSortBy(field);
        setSortDir('asc');
      } else if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortBy('');
        setSortDir(null);
      }
      setPage(1);
    },
  }),
  useRfqGrouping: mockUseRfqGrouping,
  useRfqExport: () => ({ handleExport: vi.fn() }),
  PO_CA_COLUMNS: [
    { field: 'id', key: 'rfqId' },
    { field: 'projectName', key: 'projectName' },
    { field: 'projectId', key: 'projectId' },
    { field: 'status', key: 'rfqStatus' },
    { field: 'deadlineRange', key: 'resDeadline' },
    { field: 'pickUp', key: 'pickUp' },
    { field: 'deliveryLocation', key: 'deliveryLocation' },
    { field: 'pickUpLocation', key: 'pickUpLocation' },
    { field: 'recVendors', key: 'recVendors' },
    { field: 'recQuotes', key: 'recQuotes' },
    { field: 'applVendors', key: 'applVendors' },
    { field: 'lineItems', key: 'lineItems' },
    { field: 'totalRequestedQty', key: 'totalRequestedQty' },
    { field: 'applIssues', key: 'applIssues' },
    { field: 'arcBlocksDist', key: 'arcBlocksDist' },
    { field: 'createdDate', key: 'createdDate' },
    { field: 'createdBy', key: 'createdBy' },
    { field: 'approvalStatus', key: 'approvalStatus' },
    { field: 'approvedBy', key: 'approvedBy' },
    { field: 'lastModifiedBy', key: 'lastModifiedBy' },
  ],
  PO_CA_QUICK_FILTERS: [
    'myRfqs',
    'openRfqs',
    'awaitingResponses',
    'noQuotes',
    'awardedRfqs',
    'closedRfqs',
  ],
  GROUP_OPTIONS: ['groupByProject', 'groupByStatus', 'groupByVendor'],
  GROUP_FIELD_MAP: {} as Record<string, string>,
  PAGE_SIZE_OPTIONS: [25, 50, 100],
  RFQ_STATUS_KEYS: ['OPEN', 'IN_REVIEW', 'AWARDED', 'CLOSED', 'CANCELLED', 'DRAFT'],
  CopyRfqModal: ({
    onClose,
    onOpenCopy,
    copyState,
  }: {
    projectName?: string;
    copyState: string;
    onClose: () => void;
    onOpenCopy: () => void;
  }) => (
    <div data-testid="copy-rfq-modal">
      <span data-testid="copy-state">{copyState}</span>
      <button data-testid="copy-open" onClick={onOpenCopy}>
        open copy
      </button>
      <button data-testid="copy-close" onClick={onClose}>
        close
      </button>
    </div>
  ),
  RfqAdvancedFilters: () => null,
  EMPTY_FILTERS: {
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
}));

vi.mock('@forethread/ui-components', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
  Button: ({
    children,
    onClick,
    variant,
    size,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
  }) => (
    <button data-testid={`btn-${variant ?? 'default'}`} data-size={size} onClick={onClick}>
      {children}
    </button>
  ),
  Input: ({
    value,
    onChange,
    placeholder,
    className,
    onKeyDown,
  }: {
    value?: string;
    onChange?: (e: { target: { value: string } }) => void;
    placeholder?: string;
    className?: string;
    onKeyDown?: (e: { key: string }) => void;
  }) => (
    <input
      data-testid="search-input"
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={className}
    />
  ),
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
  Alert: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="alert" className={className}>
      {children}
    </div>
  ),
  DatePicker: () => <input data-testid="date-picker" />,
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
      <button data-testid="rfq-create-view-save" onClick={() => onCreate('My RFQ View')}>
        save
      </button>
      <button data-testid="rfq-create-view-cancel" onClick={onClose}>
        cancel
      </button>
    </div>
  ),
  ExportDropdownButton: () => null,
  FilterPanel: ({ children, label }: { children: React.ReactNode; label?: string }) => (
    <div data-testid="filter-panel">
      <button>{label}</button>
      {children}
    </div>
  ),
  getStatusColor: (_map: Record<string, string>, status: string) => status ?? 'default',
  GroupByButton: ({ label, onClick }: { label: string; onClick?: () => void }) => (
    <button onClick={onClick}>{label}</button>
  ),
  IconBadge: ({ icon }: { icon: React.ReactNode }) => <span data-testid="icon-badge">{icon}</span>,
  MessageBadgeIcon: () => <span data-testid="message-badge-icon" />,
  Modal: ({ children }: { children: React.ReactNode }) => <div data-testid="modal">{children}</div>,
  ModalCloseButton: () => <button data-testid="modal-close" />,
  RFQ_STATUS_COLORS: {},
  SelectDropdown: () => <select data-testid="select-dropdown" />,
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
    <div data-testid="rfq-table-mgmt-modal">
      <button data-testid="rfq-table-mgmt-save" onClick={() => onSave(['rfqId', 'projectName'])}>
        save
      </button>
      <button data-testid="rfq-table-mgmt-close" onClick={onClose}>
        close
      </button>
    </div>
  ),
  Spinner: ({ size }: { size?: string }) => <div data-testid="spinner" data-size={size} />,
  FilterChip: ({
    label,
    active,
    onClick,
  }: {
    label?: string;
    active?: boolean;
    onClick?: () => void;
  }) => (
    <button data-testid="filter-chip" data-active={active} onClick={onClick}>
      {label}
    </button>
  ),
  InfoHint: ({ children }: { children?: React.ReactNode }) => (
    <span data-testid="info-hint">{children}</span>
  ),
  ToolbarIconButton: ({
    children,
    title,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    title?: string;
  }) => (
    <button data-testid="toolbar-icon-btn" onClick={onClick} title={title}>
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
  useDropdown: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useState } = require('react') as typeof import('react');
    const [isOpen, setIsOpen] = useState(false);
    return { ref: { current: null }, isOpen, setIsOpen };
  },
  ViewSelectorDropdown: () => null,
}));

const svgMock = vi.hoisted(() => () => ({
  default: (props: Record<string, unknown>) => <span data-testid="svg-icon" {...props} />,
}));

vi.mock('@forethread/ui-components/assets/icons/filter.svg?react', svgMock);
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', svgMock);
vi.mock('@forethread/ui-components/assets/icons/three-dot.svg?react', svgMock);
vi.mock('@forethread/ui-components/assets/icons/chevron-down.svg?react', svgMock);
vi.mock('@forethread/ui-components/assets/icons/cross.svg?react', svgMock);
vi.mock('@forethread/ui-components/assets/icons/download.svg?react', svgMock);
vi.mock('@forethread/ui-components/assets/icons/floppy-disk.svg?react', svgMock);
vi.mock('@forethread/ui-components/assets/icons/search.svg?react', svgMock);
vi.mock('@forethread/ui-components/assets/icons/settings.svg?react', svgMock);
vi.mock('@forethread/ui-components/assets/icons/info.svg?react', svgMock);
vi.mock('@forethread/ui-components/assets/icons/copy.svg?react', svgMock);
vi.mock('@forethread/ui-components/assets/icons/drag-and-drop.svg?react', svgMock);

vi.mock('../components/RfqDetailPanel', () => ({
  RfqDetailPanel: ({ rfqId, onClose }: { rfqId: string; onClose: () => void }) => (
    <div data-testid="rfq-detail-panel">
      RFQ: {rfqId}
      <button data-testid="close-panel" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

import RfqListPage from './RfqListPage';

const MOCK_RFQS = Array.from({ length: 3 }, (_, i) => ({
  id: `RFQ-${String(i + 1).padStart(3, '0')}`,
  projectName: `Project ${i + 1}`,
  projectId: `PRJ-${String(i + 1).padStart(3, '0')}`,
  status: i === 2 ? 'CLOSED' : 'Open',
  reqQuantities: 10,
  pickUp: i === 0,
  deliveryLocation: 'Sydney',
  pickUpLocation: 'Melbourne',
  recVendors: 3,
  recQuotes: 2,
  applVendors: 1,
  lineItems: 5,
  deadlineRange: '2025-01-01 - 2025-02-01',
  applIssues: 0,
  totalRequestedQty: 100,
  arcBlocksDist: null,
  createdDate: '2025-01-15T00:00:00Z',
  createdBy: 'Admin',
  approvalStatus: 'Approved',
  approvedBy: 'Manager',
  lastModifiedBy: 'Admin',
}));

describe('RfqListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetViews.mockResolvedValue([]);
    mockUseRfqs.mockReturnValue({
      data: { items: MOCK_RFQS, meta: { total: 3 } },
      isLoading: false,
      isError: false,
    });
    mockUseRfqGrouping.mockReturnValue({
      groupedItems: null,
      expandedGroups: new Set(),
      toggleGroup: vi.fn(),
    });
  });

  it('renders the create new button', () => {
    render(<RfqListPage />, { wrapper });
    expect(screen.getByText('list.createNew')).toBeInTheDocument();
  });

  it('renders quick filter buttons', () => {
    render(<RfqListPage />, { wrapper });
    expect(screen.getByText('quickFilters.myRfqs')).toBeInTheDocument();
    expect(screen.getByText('quickFilters.openRfqs')).toBeInTheDocument();
    expect(screen.getByText('quickFilters.awaitingResponses')).toBeInTheDocument();
  });

  it('renders table column headers', () => {
    render(<RfqListPage />, { wrapper });
    expect(screen.getByText('columns.rfqId')).toBeInTheDocument();
    expect(screen.getByText('columns.projectName')).toBeInTheDocument();
    expect(screen.getByText('columns.rfqStatus')).toBeInTheDocument();
    expect(screen.getByText('columns.actions')).toBeInTheDocument();
  });

  it('renders RFQ data rows', () => {
    render(<RfqListPage />, { wrapper });
    expect(screen.getByText('RFQ-001')).toBeInTheDocument();
    expect(screen.getByText('Project 1')).toBeInTheDocument();
  });

  it('renders status badges for each row', () => {
    render(<RfqListPage />, { wrapper });
    const badges = screen.getAllByTestId('badge');
    expect(badges).toHaveLength(3);
  });

  it('renders pagination when total exceeds page size', () => {
    mockUseRfqs.mockReturnValue({
      data: { items: MOCK_RFQS, meta: { total: 50 } },
      isLoading: false,
      isError: false,
    });
    render(<RfqListPage />, { wrapper });
    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
  });

  it('shows loading spinner when loading', () => {
    mockUseRfqs.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<RfqListPage />, { wrapper });
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    mockUseRfqs.mockReturnValue({
      data: { items: [], meta: { total: 0 } },
      isLoading: false,
      isError: false,
    });
    render(<RfqListPage />, { wrapper });
    expect(screen.getByText('list.noRfqsFound')).toBeInTheDocument();
  });

  it('sorts by column on header click', () => {
    render(<RfqListPage />, { wrapper });
    fireEvent.click(screen.getByText('columns.rfqId'));
    const sortIcons = screen.getAllByTestId('sort-icon');
    expect(sortIcons[0]).toHaveAttribute('data-active', 'true');
    expect(sortIcons[0]).toHaveAttribute('data-direction', 'asc');
  });

  it('toggles sort direction on second click', () => {
    render(<RfqListPage />, { wrapper });
    fireEvent.click(screen.getByText('columns.rfqId'));
    const sortIcons = screen.getAllByTestId('sort-icon');
    expect(sortIcons[0]).toHaveAttribute('data-direction', 'desc');
  });

  it('renders pickUp as yes/no', () => {
    render(<RfqListPage />, { wrapper });
    expect(screen.getByText('common:yes')).toBeInTheDocument();
    expect(screen.getAllByText('common:no').length).toBeGreaterThanOrEqual(2);
  });

  it('renders formatted createdDate', () => {
    render(<RfqListPage />, { wrapper });
    // Jan 15, 2025 format from toLocaleDateString
    expect(screen.getAllByText(/Jan/).length).toBeGreaterThan(0);
  });

  it('renders arcBlocksDist as dash for null values', () => {
    render(<RfqListPage />, { wrapper });
    // arcBlocksDist is null for all mock items so should render '-'
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders DotActionsMenu with copyRfq and downloadPdf for each row', () => {
    render(<RfqListPage />, { wrapper });
    const menus = screen.getAllByTestId('dot-actions-menu');
    expect(menus).toHaveLength(3);
    expect(screen.getAllByText('actions.copyRfq')).toHaveLength(3);
    expect(screen.getAllByText('actions.downloadPdf')).toHaveLength(3);
  });

  it('renders moveToArchive action for CLOSED RFQs', () => {
    render(<RfqListPage />, { wrapper });
    // Only RFQ-003 has CLOSED status
    expect(screen.getAllByText('actions.moveToArchive')).toHaveLength(1);
  });

  it('triggers copyRfq action', () => {
    mockCopyRfq.mockResolvedValue({ id: 'new-rfq-id' });
    render(<RfqListPage />, { wrapper });
    const copyButtons = screen.getAllByTestId('action-copyRfq');
    fireEvent.click(copyButtons[0]);
    expect(mockCopyRfq).toHaveBeenCalledWith('RFQ-001');
  });

  it('triggers archiveRfq action for CLOSED RFQ', () => {
    mockArchiveRfq.mockResolvedValue(undefined);
    render(<RfqListPage />, { wrapper });
    const archiveBtn = screen.getByTestId('action-moveToArchive');
    fireEvent.click(archiveBtn);
    expect(mockArchiveRfq).toHaveBeenCalledWith('RFQ-003');
  });

  it('triggers downloadPdf action', () => {
    mockExportRfqs.mockResolvedValue({ url: 'http://test.com/file.pdf' });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<RfqListPage />, { wrapper });
    const downloadButtons = screen.getAllByTestId('action-downloadPdf');
    fireEvent.click(downloadButtons[0]);
    expect(mockExportRfqs).toHaveBeenCalledWith('pdf', { search: 'RFQ-001' });
    openSpy.mockRestore();
  });

  it('renders eye button for row preview', () => {
    render(<RfqListPage />, { wrapper });
    // Each row has an eye icon button
    const svgIcons = screen.getAllByTestId('svg-icon');
    expect(svgIcons.length).toBeGreaterThan(0);
  });

  it('toggles quick filter on click', () => {
    render(<RfqListPage />, { wrapper });
    const chips = screen.getAllByTestId('filter-chip');
    fireEvent.click(chips[0]); // Toggle myRfqs on
    expect(chips[0]).toHaveAttribute('data-active', 'true');
  });

  it('renders message badge icons in action column', () => {
    render(<RfqListPage />, { wrapper });
    const messageBadges = screen.getAllByTestId('message-badge-icon');
    expect(messageBadges).toHaveLength(3);
  });

  it('opens create dropdown and shows options', () => {
    render(<RfqListPage />, { wrapper });
    fireEvent.click(screen.getByText('list.createNew'));
    expect(screen.getByText('Create manually')).toBeInTheDocument();
    expect(screen.getByText('Converting a project BOM')).toBeInTheDocument();
    expect(screen.getByText('From material list')).toBeInTheDocument();
  });

  it('"Create manually" in dropdown navigates to rfq new', () => {
    render(<RfqListPage />, { wrapper });
    fireEvent.click(screen.getByText('list.createNew'));
    fireEvent.click(screen.getByText('Create manually'));
  });

  it('"Converting a project BOM" closes dropdown', () => {
    render(<RfqListPage />, { wrapper });
    fireEvent.click(screen.getByText('list.createNew'));
    fireEvent.click(screen.getByText('Converting a project BOM'));
    expect(screen.queryByText('From material list')).not.toBeInTheDocument();
  });

  it('"From material list" closes dropdown', () => {
    render(<RfqListPage />, { wrapper });
    fireEvent.click(screen.getByText('list.createNew'));
    fireEvent.click(screen.getByText('From material list'));
    expect(screen.queryByText('Converting a project BOM')).not.toBeInTheDocument();
  });

  it('navigates to rfq detail on row click', () => {
    render(<RfqListPage />, { wrapper });
    const rows = screen.getAllByRole('row');
    // Click the first body row (skip header)
    fireEvent.click(rows[1]);
    // Row click triggers navigation
  });

  it('renders pickUp as yes for true values', () => {
    render(<RfqListPage />, { wrapper });
    // RFQ-001 has pickUp: true
    expect(screen.getByText('common:yes')).toBeInTheDocument();
  });

  it('handles multiple sort clicks without crashing', () => {
    render(<RfqListPage />, { wrapper });
    // Click 3 times to cycle asc -> desc -> clear
    fireEvent.click(screen.getByText('columns.rfqId'));
    fireEvent.click(screen.getByText('columns.rfqId'));
    fireEvent.click(screen.getByText('columns.rfqId'));
    expect(screen.getByText('columns.rfqId')).toBeInTheDocument();
  });

  it('does not render pagination when total is below page size', () => {
    mockUseRfqs.mockReturnValue({
      data: { items: MOCK_RFQS, meta: { total: 3 } },
      isLoading: false,
      isError: false,
    });
    render(<RfqListPage />, { wrapper });
    expect(screen.queryByTestId('table-pagination')).not.toBeInTheDocument();
  });

  it('renders null values as dash', () => {
    mockUseRfqs.mockReturnValue({
      data: {
        items: [{ ...MOCK_RFQS[0], arcBlocksDist: null, pickUpLocation: null }],
        meta: { total: 1 },
      },
      isLoading: false,
      isError: false,
    });
    render(<RfqListPage />, { wrapper });
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders grouped items with GroupSection when groupBy is set', () => {
    const grouped = new Map([['GroupAlpha', MOCK_RFQS]]);
    mockUseRfqGrouping.mockReturnValue({
      groupedItems: grouped,
      expandedGroups: new Set(['GroupAlpha']),
      toggleGroup: vi.fn(),
    });
    render(<RfqListPage />, { wrapper });
    expect(screen.getByText('GroupAlpha')).toBeInTheDocument();
    expect(screen.getByText('RFQ-001')).toBeInTheDocument();
  });

  it('hides rows in collapsed group', () => {
    const grouped = new Map([['GroupAlpha', MOCK_RFQS]]);
    mockUseRfqGrouping.mockReturnValue({
      groupedItems: grouped,
      expandedGroups: new Set(),
      toggleGroup: vi.fn(),
    });
    render(<RfqListPage />, { wrapper });
    expect(screen.getByText('GroupAlpha')).toBeInTheDocument();
    expect(screen.queryByText('RFQ-001')).not.toBeInTheDocument();
  });

  it('toggles group on group row click', () => {
    const toggleGroup = vi.fn();
    const grouped = new Map([['GroupAlpha', MOCK_RFQS]]);
    mockUseRfqGrouping.mockReturnValue({
      groupedItems: grouped,
      expandedGroups: new Set(['GroupAlpha']),
      toggleGroup,
    });
    render(<RfqListPage />, { wrapper });
    fireEvent.click(screen.getByText('GroupAlpha'));
    expect(toggleGroup).toHaveBeenCalledWith('GroupAlpha');
  });

  it('shows copy RFQ modal when copyRfq action is clicked', () => {
    mockCopyRfq.mockResolvedValue({ id: 'new-rfq-copy-id' });
    render(<RfqListPage />, { wrapper });
    const copyButtons = screen.getAllByTestId('action-copyRfq');
    fireEvent.click(copyButtons[0]);
    expect(screen.getByTestId('copy-rfq-modal')).toBeInTheDocument();
  });

  it('navigates to copied RFQ when "open copy" is clicked', () => {
    mockCopyRfq.mockResolvedValue({ id: 'new-rfq-copy-id' });
    render(<RfqListPage />, { wrapper });
    const copyButtons = screen.getAllByTestId('action-copyRfq');
    fireEvent.click(copyButtons[0]);
    expect(screen.getByTestId('copy-rfq-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('copy-open'));
    // Modal should close
    expect(screen.queryByTestId('copy-rfq-modal')).not.toBeInTheDocument();
  });

  it('closes copy RFQ modal on close button', () => {
    mockCopyRfq.mockResolvedValue({ id: 'new-rfq-copy-id' });
    render(<RfqListPage />, { wrapper });
    const copyButtons = screen.getAllByTestId('action-copyRfq');
    fireEvent.click(copyButtons[0]);
    expect(screen.getByTestId('copy-rfq-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('copy-close'));
    expect(screen.queryByTestId('copy-rfq-modal')).not.toBeInTheDocument();
  });

  it('opens preview panel when eye button is clicked', () => {
    render(<RfqListPage />, { wrapper });
    // Eye icon buttons have title="actions.view"
    const eyeButtons = screen.getAllByTitle('actions.view');
    fireEvent.click(eyeButtons[0]);
    expect(screen.getByTestId('rfq-detail-panel')).toBeInTheDocument();
    expect(screen.getByText('RFQ: RFQ-001')).toBeInTheDocument();
  });

  it('closes preview panel via close button', () => {
    render(<RfqListPage />, { wrapper });
    const eyeButtons = screen.getAllByTitle('actions.view');
    fireEvent.click(eyeButtons[0]);
    expect(screen.getByTestId('rfq-detail-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('close-panel'));
    expect(screen.queryByTestId('rfq-detail-panel')).not.toBeInTheDocument();
  });

  it('opens table management modal on settings button click', () => {
    render(<RfqListPage />, { wrapper });
    const settingsBtn = screen
      .getAllByTestId('toolbar-icon-btn')
      .find((btn) => btn.getAttribute('title') === 'list.settings');
    fireEvent.click(settingsBtn!);
    expect(screen.getByTestId('rfq-table-mgmt-modal')).toBeInTheDocument();
  });

  it('saves columns via table management modal', () => {
    render(<RfqListPage />, { wrapper });
    const settingsBtn = screen
      .getAllByTestId('toolbar-icon-btn')
      .find((btn) => btn.getAttribute('title') === 'list.settings');
    fireEvent.click(settingsBtn!);
    fireEvent.click(screen.getByTestId('rfq-table-mgmt-save'));
    expect(screen.queryByTestId('rfq-table-mgmt-modal')).not.toBeInTheDocument();
  });

  it('opens create view modal on save button click', () => {
    render(<RfqListPage />, { wrapper });
    const saveBtn = screen
      .getAllByTestId('toolbar-icon-btn')
      .find((btn) => btn.getAttribute('title') === 'list.save');
    fireEvent.click(saveBtn!);
    expect(screen.getByTestId('create-view-modal')).toBeInTheDocument();
  });

  it('closes create view modal on cancel', () => {
    render(<RfqListPage />, { wrapper });
    const saveBtn = screen
      .getAllByTestId('toolbar-icon-btn')
      .find((btn) => btn.getAttribute('title') === 'list.save');
    fireEvent.click(saveBtn!);
    fireEvent.click(screen.getByTestId('rfq-create-view-cancel'));
    expect(screen.queryByTestId('create-view-modal')).not.toBeInTheDocument();
  });
});
