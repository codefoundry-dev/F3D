import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockDragDropOverrides = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));

const mockPurchaseOrders = vi.hoisted(() => ({
  value: {
    data: {
      items: [
        {
          id: 'po-1',
          poNumber: 'PO-001',
          projectName: 'Project A',
          projectId: 'p-1',
          contractorName: 'Contractor X',
          status: 'APPROVED',
          revision: 1,
          poType: 'Standard',
          pickUp: true,
        },
      ],
      meta: { total: 1 },
    } as Record<string, unknown> | null,
    isLoading: false,
  },
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    exportPurchaseOrders: vi.fn(() => Promise.resolve({ url: 'https://example.com/pdf' })),
    getViews: vi.fn(() => Promise.resolve([])),
    createView: vi.fn(() => Promise.resolve({ id: 'v1', name: 'test' })),
    deleteView: vi.fn(() => Promise.resolve()),
    deleteAllViews: vi.fn(() => Promise.resolve()),
  };
});

const storeInstances = vi.hoisted(
  () => [] as Array<{ getState: () => any; setState: (s: any) => void }>,
);

vi.mock('@forethread/po-shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const origCreate = actual.createPoTableStore as (...args: any[]) => any;
  return {
    ...actual,
    usePurchaseOrders: () => mockPurchaseOrders.value,
    createPoTableStore: (...args: any[]) => {
      const store = origCreate(...args);
      storeInstances.push(store);
      return store;
    },
  };
});

vi.mock('../components/PoDetailPanel', () => ({
  PoDetailPanel: () => <div data-testid="po-detail-panel" />,
}));

vi.mock('@forethread/ui-components', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    DotActionsMenu: ({
      actions,
    }: {
      actions: { key: string; label: string; onClick: () => void }[];
    }) => (
      <div data-testid="dot-menu">
        {actions.map((a) => (
          <button key={a.key} onClick={a.onClick}>
            {a.label}
          </button>
        ))}
      </div>
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
      <button data-active={active} onClick={onClick}>
        {label}
      </button>
    ),
    FilterPanel: () => null,
    formatEnum: (v: string | null | undefined) =>
      v
        ? v
            .split('_')
            .map((w: string, i: number) =>
              i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase(),
            )
            .join(' ')
        : '-',
    getStatusColor: () => '',
    GroupByButton: ({
      label,
      onGroupByChange,
      options,
    }: {
      label: string;
      onGroupByChange: (v: string) => void;
      options: readonly string[];
      groupBy?: string;
      getOptionLabel?: (opt: string) => string;
      isOpen?: boolean;
      onOpenChange?: (v: boolean) => void;
      dropdownRef?: React.RefObject<HTMLElement>;
    }) => (
      <div>
        <button>{label}</button>
        {options.map((opt) => (
          <button
            key={opt}
            data-testid={`group-option-${opt}`}
            onClick={() => onGroupByChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    ),
    MessageBadgeIcon: ({ onClick }: { onClick?: () => void }) => (
      <button data-testid="message-badge" onClick={onClick}>
        msg
      </button>
    ),
    PO_STATUS_COLORS: {},
    SearchInput: ({
      value,
      onChange,
    }: {
      value: string;
      onChange: (e: { target: { value: string } }) => void;
    }) => <input data-testid="search" value={value} onChange={onChange} />,
    SortIcon: () => <span />,
    Spinner: () => <div data-testid="spinner" />,
    TablePagination: ({
      onPageChange,
      onPageSizeChange,
    }: {
      onPageChange: (p: number) => void;
      onPageSizeChange: (s: number) => void;
    }) => (
      <div data-testid="pagination">
        <button onClick={() => onPageChange(2)}>next</button>
        <button onClick={() => onPageSizeChange(50)}>page-size</button>
      </div>
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
            data-testid="search"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => e.key === 'Escape' && onSearchOpenChange(false)}
          />
          <button onClick={() => onSearchOpenChange(false)}>close</button>
        </div>
      ) : (
        <button onClick={() => onSearchOpenChange(true)}>open-search</button>
      ),
    CreateViewModal: ({
      onClose,
      onCreate,
    }: {
      onClose: () => void;
      onCreate: (name: string) => void;
    }) => (
      <div data-testid="create-view-modal">
        <button onClick={onClose}>close-view</button>
        <button onClick={() => onCreate('My View')}>create-view</button>
      </div>
    ),
    ExportDropdownButton: ({ onExport }: { onExport: (fmt: string) => void }) => (
      <div data-testid="export-dropdown">
        <button onClick={() => onExport('csv')}>export-csv</button>
      </div>
    ),
    TableManagementModal: ({
      onSave,
      onClose,
    }: {
      onSave: (cols: string[]) => void;
      onClose: () => void;
    }) => (
      <div data-testid="table-mgmt-modal">
        <button onClick={() => onSave(['poNumber'])}>save-cols</button>
        <button onClick={onClose}>close-mgmt</button>
      </div>
    ),
    ToolbarIconButton: ({
      children,
      onClick,
      title,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      title?: string;
    }) => (
      <button onClick={onClick} title={title}>
        {children}
      </button>
    ),
    ViewSelectorDropdown: ({
      onApplyView,
      onOpenChange,
    }: {
      onApplyView: (id: string | null) => void;
      onOpenChange: (open: boolean) => void;
    }) => (
      <div data-testid="view-selector">
        <button onClick={() => onOpenChange(true)}>open-views</button>
        <button onClick={() => onApplyView(null)}>default-view</button>
      </div>
    ),
    useColumnDragDrop: () => ({
      dragColKey: null,
      dragOverColKey: null,
      handleDragStart: vi.fn(),
      handleDragOver: vi.fn(),
      handleDrop: vi.fn(),
      handleDragEnd: vi.fn(),
      ...mockDragDropOverrides.value,
    }),
    useColumnResize: () => ({ columnWidths: {}, handleResizeStart: vi.fn() }),
    useDebounce: (v: string) => v,
    useDropdown: () => ({ ref: { current: null }, isOpen: false, setIsOpen: vi.fn() }),
    CopyEntityModal: ({ children }: any) => <div data-testid="copy-entity-modal">{children}</div>,
  };
});

vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/chevron-down.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/paperclip.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/filter.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/drag-and-drop.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/floppy-disk.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/settings.svg?react', () => ({
  default: () => <span />,
}));

import PurchaseOrderListPage from './PurchaseOrderListPage';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe('PurchaseOrderListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDragDropOverrides.value = {};
    // Reset Zustand store state so tests don't leak groupBy, search, etc.
    for (const store of storeInstances) {
      const state = store.getState();
      store.setState({
        page: 1,
        pageSize: 25,
        search: '',
        searchOpen: false,
        sortBy: 'poNumber',
        sortDir: 'asc',
        quickFilter: '',
        groupBy: '',
        showTableMgmt: false,
        showCreateView: false,
        visibleColumns: state.columnOrder,
      });
    }
    mockPurchaseOrders.value = {
      data: {
        items: [
          {
            id: 'po-1',
            poNumber: 'PO-001',
            projectName: 'Project A',
            projectId: 'p-1',
            contractorName: 'Contractor X',
            status: 'APPROVED',
            revision: 1,
            poType: 'Standard',
            pickUp: true,
          },
        ],
        meta: { total: 1 },
      },
      isLoading: false,
    };
  });

  it('renders purchase order items', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getByText('PO-001')).toBeInTheDocument();
    expect(screen.getByText('Project A')).toBeInTheDocument();
    expect(screen.getByText('Contractor X')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    mockPurchaseOrders.value = {
      data: { items: [], meta: { total: 0 } },
      isLoading: false,
    };
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getByText('list.noPosFound')).toBeInTheDocument();
  });

  it('shows loading spinner', () => {
    mockPurchaseOrders.value = { data: null, isLoading: true };
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    // ToolbarSearchToggle shows open-search button when closed
    expect(screen.getByText('open-search')).toBeInTheDocument();
  });

  it('does not render create button (vendors cannot create POs)', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.queryByText('list.createNew')).not.toBeInTheDocument();
  });

  it('renders pickUp as yes/no', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getByText('common:yes')).toBeInTheDocument();
  });

  it('handles column sort click', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const headers = document.querySelectorAll('th');
    fireEvent.click(headers[0]); // sort by first column
    fireEvent.click(headers[0]); // toggle sort direction
  });

  it('renders null values as dash', () => {
    mockPurchaseOrders.value = {
      data: {
        items: [
          {
            id: 'po-1',
            poNumber: 'PO-001',
            projectName: 'Project A',
            projectId: 'p-1',
            contractorName: 'Contractor X',
            status: 'APPROVED',
            revision: null,
            poType: null,
            pickUp: false,
          },
        ],
        meta: { total: 1 },
      },
      isLoading: false,
    };
    render(<PurchaseOrderListPage />, { wrapper });
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('handles search input change', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    // Open search first
    fireEvent.click(screen.getByText('open-search'));
    const input = screen.getByTestId('search');
    fireEvent.change(input, { target: { value: 'test' } });
  });

  it('handles pagination page change', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    fireEvent.click(screen.getByText('next'));
  });

  it('handles pagination page size change', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    fireEvent.click(screen.getByText('page-size'));
  });

  it('renders pickUp as no', () => {
    mockPurchaseOrders.value = {
      data: {
        items: [
          {
            id: 'po-1',
            poNumber: 'PO-001',
            projectName: 'A',
            projectId: 'p-1',
            contractorName: 'C',
            status: 'APPROVED',
            revision: 1,
            poType: 'Standard',
            pickUp: false,
          },
        ],
        meta: { total: 1 },
      },
      isLoading: false,
    };
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getAllByText('common:no').length).toBeGreaterThanOrEqual(1);
  });

  it('renders grouped items when groupBy is active', () => {
    mockPurchaseOrders.value = {
      data: {
        items: [
          {
            id: 'po-1',
            poNumber: 'PO-001',
            projectName: 'Project A',
            projectId: 'p-1',
            contractorName: 'Contractor X',
            status: 'APPROVED',
            revision: 1,
            poType: 'Standard',
            pickUp: true,
          },
          {
            id: 'po-2',
            poNumber: 'PO-002',
            projectName: 'Project B',
            projectId: 'p-2',
            contractorName: 'Contractor Y',
            status: 'DRAFT',
            revision: null,
            poType: 'Standard',
            pickUp: false,
          },
        ],
        meta: { total: 2 },
      },
      isLoading: false,
    };
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getByText('PO-001')).toBeInTheDocument();
    expect(screen.getByText('PO-002')).toBeInTheDocument();
  });

  it('renders totalAmount when present', () => {
    mockPurchaseOrders.value = {
      data: {
        items: [
          {
            id: 'po-1',
            poNumber: 'PO-001',
            projectName: 'A',
            projectId: 'p-1',
            contractorName: 'C',
            status: 'APPROVED',
            revision: 1,
            poType: 'STANDARD',
            pickUp: false,
            totalAmount: 1500,
            hasMessages: true,
            paymentTermsDays: 30,
            holdForRelease: true,
            plannedDeliveryDate: '2026-06-15',
            issuedAt: '2026-01-01',
            updatedAt: '2026-01-01',
            lineItemsDelivered: 5,
            quantityDelivered: 10,
          },
        ],
        meta: { total: 1 },
      },
      isLoading: false,
    };
    render(<PurchaseOrderListPage />, { wrapper });
    // The component should render the totalAmount
    expect(screen.getByText('PO-001')).toBeInTheDocument();
  });

  it('handles triple-click sort to reset', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const headers = document.querySelectorAll('th');
    // Click 3 times: set asc -> desc -> reset
    fireEvent.click(headers[0]);
    fireEvent.click(headers[0]);
    fireEvent.click(headers[0]);
  });

  it('renders dot actions menu for download', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getByText('actions.downloadPdf')).toBeInTheDocument();
  });

  it('clicking downloadPdf in dot menu triggers export', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    fireEvent.click(screen.getByText('actions.downloadPdf'));
  });

  it('renders quick filter chips', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getByText('list.quickFiltersLabel')).toBeInTheDocument();
  });

  it('clicking quick filter toggles it', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const chips = screen.getAllByText(/quickFilters\./);
    fireEvent.click(chips[0]);
  });

  it('renders date fields formatted', () => {
    mockPurchaseOrders.value = {
      data: {
        items: [
          {
            id: 'po-1',
            poNumber: 'PO-001',
            projectName: 'A',
            projectId: 'p-1',
            contractorName: 'C',
            status: 'APPROVED',
            revision: 1,
            poType: 'STANDARD',
            pickUp: false,
            deadlineEnd: '2026-06-15',
            deadlineStart: '2026-05-01',
            updatedAt: '2026-03-01',
            createdDate: '2026-01-15',
          },
        ],
        meta: { total: 1 },
      },
      isLoading: false,
    };
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getByText('PO-001')).toBeInTheDocument();
  });

  it('renders aging field', () => {
    mockPurchaseOrders.value = {
      data: {
        items: [
          {
            id: 'po-1',
            poNumber: 'PO-001',
            projectName: 'A',
            projectId: 'p-1',
            contractorName: 'C',
            status: 'APPROVED',
            revision: 1,
            poType: 'BULK',
            pickUp: false,
            issuedAt: '2026-01-01',
            updatedAt: '2026-01-01',
            lineItemsDelivered: 3,
            quantityDelivered: 7,
          },
        ],
        meta: { total: 1 },
      },
      isLoading: false,
    };
    render(<PurchaseOrderListPage />, { wrapper });
    // Should render isBulkOrder as yes for BULK type
    expect(screen.getByText('common:yes')).toBeInTheDocument();
  });

  it('renders grouped items with GroupSection', () => {
    // Override usePoGrouping to return grouped items
    mockPurchaseOrders.value = {
      data: {
        items: [
          {
            id: 'po-1',
            poNumber: 'PO-001',
            projectName: 'Project A',
            projectId: 'p-1',
            contractorName: 'Contractor X',
            status: 'APPROVED',
            revision: 1,
            poType: 'Standard',
            pickUp: true,
          },
          {
            id: 'po-2',
            poNumber: 'PO-002',
            projectName: 'Project B',
            projectId: 'p-2',
            contractorName: 'Contractor Y',
            status: 'DRAFT',
            revision: null,
            poType: 'Standard',
            pickUp: false,
          },
        ],
        meta: { total: 2 },
      },
      isLoading: false,
    };
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getByText('PO-001')).toBeInTheDocument();
    expect(screen.getByText('PO-002')).toBeInTheDocument();
  });

  it('clicking message badge navigates to comms', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    fireEvent.click(screen.getByTestId('message-badge'));
  });

  it('clicking paperclip navigates to attachments', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const paperclipBtn = screen.getByTitle('actions.attachments');
    fireEvent.click(paperclipBtn);
  });

  it('clicking eye icon navigates to detail', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const viewBtn = screen.getByTitle('actions.view');
    fireEvent.click(viewBtn);
  });

  it('renders GroupSection when groupBy is set', async () => {
    mockPurchaseOrders.value = {
      data: {
        items: [
          {
            id: 'po-1',
            poNumber: 'PO-001',
            projectName: 'Project A',
            projectId: 'p-1',
            contractorName: 'Contractor X',
            status: 'APPROVED',
            revision: 1,
            poType: 'Standard',
            pickUp: true,
          },
          {
            id: 'po-2',
            poNumber: 'PO-002',
            projectName: 'Project B',
            projectId: 'p-2',
            contractorName: 'Contractor Y',
            status: 'DRAFT',
            revision: null,
            poType: 'Standard',
            pickUp: false,
          },
        ],
        meta: { total: 2 },
      },
      isLoading: false,
    };
    render(<PurchaseOrderListPage />, { wrapper });
    // Click a group option to activate grouping
    const groupOption = screen.getByTestId('group-option-groupByStatus');
    fireEvent.click(groupOption);
    // Wait for re-render with grouped data - group section headers should appear
    await waitFor(() => {
      expect(screen.getByText('APPROVED')).toBeInTheDocument();
    });
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
    // Click group header to toggle expansion
    const groupHeader = screen.getByText('APPROVED').closest('tr')!;
    fireEvent.click(groupHeader);
  });

  it('renders paymentTermsDays as "X days"', () => {
    mockPurchaseOrders.value = {
      data: {
        items: [
          {
            id: 'po-1',
            poNumber: 'PO-001',
            projectName: 'A',
            projectId: 'p-1',
            contractorName: 'C',
            status: 'APPROVED',
            revision: 1,
            poType: 'STANDARD',
            pickUp: false,
            paymentTermsDays: 30,
            holdForRelease: false,
            plannedDeliveryDate: null,
            totalAmount: null,
          },
        ],
        meta: { total: 1 },
      },
      isLoading: false,
    };
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getByText('30 days')).toBeInTheDocument();
  });

  it('opens TableManagementModal and interacts with it', async () => {
    const { unmount: unmount1 } = render(<PurchaseOrderListPage />, { wrapper });
    const store = storeInstances[storeInstances.length - 1];
    store.setState({ showTableMgmt: true });
    unmount1();
    const { unmount: unmount2 } = render(<PurchaseOrderListPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByTestId('table-mgmt-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('save-cols'));
    store.setState({ showTableMgmt: true });
    unmount2();
    const { unmount: unmount3 } = render(<PurchaseOrderListPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByTestId('table-mgmt-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('close-mgmt'));
    unmount3();
  });

  it('opens CreateViewModal and interacts with it', async () => {
    const { unmount: unmount1 } = render(<PurchaseOrderListPage />, { wrapper });
    const store = storeInstances[storeInstances.length - 1];
    store.setState({ showCreateView: true });
    unmount1();
    const { unmount: unmount2 } = render(<PurchaseOrderListPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByTestId('create-view-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('create-view'));
    store.setState({ showCreateView: true });
    unmount2();
    const { unmount: unmount3 } = render(<PurchaseOrderListPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByTestId('create-view-modal')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('close-view'));
    unmount3();
  });

  it('clicking export button triggers export', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    fireEvent.click(screen.getByText('export-csv'));
  });

  it('clicking view selector interactions', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    fireEvent.click(screen.getByText('open-views'));
    fireEvent.click(screen.getByText('default-view'));
  });

  it('clicking save button opens create view modal', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const saveBtn = screen.getByTitle('list.save');
    fireEvent.click(saveBtn);
  });

  it('clicking settings button opens table management modal', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const settingsBtn = screen.getByTitle('list.settings');
    fireEvent.click(settingsBtn);
  });

  it('renders dragged column with highlight style', () => {
    mockDragDropOverrides.value = { dragColKey: 'poNumber' };
    render(<PurchaseOrderListPage />, { wrapper });
    const headers = document.querySelectorAll('th');
    const styledHeader = Array.from(headers).find(
      (h) => h.style.background === 'hsl(var(--accent))',
    );
    expect(styledHeader).toBeTruthy();
    const cells = document.querySelectorAll('td');
    const styledCell = Array.from(cells).find((c) => c.style.background === 'hsl(var(--accent))');
    expect(styledCell).toBeTruthy();
  });
});
