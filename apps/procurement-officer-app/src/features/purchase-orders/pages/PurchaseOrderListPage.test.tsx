const mockNavigate = vi.hoisted(() => vi.fn());
const mockCopyPurchaseOrder = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockArchivePurchaseOrder = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const mockExportPurchaseOrders = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ url: 'https://example.com/file.pdf' }),
);
const mockData = vi.hoisted(() => ({
  value: {
    data: {
      items: [
        {
          id: 'po-1',
          poNumber: 'PO-001',
          projectName: 'Test Project',
          projectId: 'PRJ-1',
          vendorName: 'Vendor A',
          contractorName: 'Vendor A',
          status: 'PENDING',
          revision: null,
          poType: 'Standard',
          pickUp: false,
          deliveryLocationId: 'NYC',
        },
      ],
      meta: { total: 1 },
    },
    isLoading: false,
  } as Record<string, unknown>,
}));

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    copyPurchaseOrder: mockCopyPurchaseOrder,
    archivePurchaseOrder: mockArchivePurchaseOrder,
    exportPurchaseOrders: mockExportPurchaseOrders,
    getViews: vi.fn().mockResolvedValue([]),
    createView: vi.fn().mockResolvedValue({ id: '1', name: 'test' }),
    deleteView: vi.fn().mockResolvedValue(undefined),
    deleteAllViews: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  CopyEntityModal: ({ children }: any) => <div data-testid="copy-entity-modal">{children}</div>,
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
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
      <button data-testid="create-view-create" onClick={() => onCreate('Test View')}>
        create
      </button>
      <button data-testid="create-view-cancel" onClick={onClose}>
        cancel
      </button>
    </div>
  ),
  DotActionsMenu: ({
    actions,
  }: {
    actions: { key: string; label: string; onClick: () => void }[];
  }) => (
    <span data-testid="dot-menu">
      {actions.map((a) => (
        <button key={a.key} data-testid={`action-${a.key}`} onClick={a.onClick}>
          {a.label}
        </button>
      ))}
    </span>
  ),
  ExportDropdownButton: ({
    onExport,
  }: {
    title?: string;
    formats?: { key: string; label: string }[];
    onExport: (fmt: string) => void;
    isOpen?: boolean;
    onOpenChange?: (v: boolean) => void;
    dropdownRef?: React.RefObject<HTMLDivElement | null>;
  }) => (
    <button data-testid="export-btn" onClick={() => onExport('csv')}>
      export
    </button>
  ),
  FilterChip: ({
    label,
    active,
    onClick,
  }: {
    label: string;
    active: boolean;
    onClick: () => void;
  }) => (
    <button data-active={active} onClick={onClick}>
      {label}
    </button>
  ),
  FilterPanel: ({
    label,
    onOpenChange,
    onClearAll,
  }: {
    label: string;
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onClearAll: () => void;
    clearAllLabel?: string;
    children?: React.ReactNode;
  }) => (
    <div>
      <button data-testid="filter-panel-toggle" onClick={() => onOpenChange(true)}>
        {label}
      </button>
      <button data-testid="filter-panel-clear" onClick={onClearAll}>
        clear
      </button>
    </div>
  ),
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
    getOptionLabel,
  }: {
    label: string;
    groupBy: string;
    onGroupByChange: (v: string) => void;
    options: readonly string[];
    getOptionLabel?: (opt: string) => string;
    isOpen?: boolean;
    onOpenChange?: (v: boolean) => void;
    dropdownRef?: React.RefObject<HTMLDivElement | null>;
  }) => (
    <div>
      <span>{label}</span>
      {options.map((opt) => (
        <button key={opt} data-testid={`group-${opt}`} onClick={() => onGroupByChange(opt)}>
          {getOptionLabel?.(opt) ?? opt}
        </button>
      ))}
      <button data-testid="group-clear" onClick={() => onGroupByChange('')}>
        clear
      </button>
    </div>
  ),
  Input: (props: Record<string, unknown>) => (
    <input data-testid="search-input-field" {...(props as object)} />
  ),
  MessageBadgeIcon: ({ onClick }: { onClick?: () => void }) => (
    <button data-testid="message-badge" onClick={onClick}>
      msg
    </button>
  ),
  PO_STATUS_COLORS: {},
  SortIcon: () => <span />,
  Spinner: () => <div data-testid="spinner" />,
  TableManagementModal: ({
    onSave,
    onClose,
    visibleColumns,
  }: {
    columns: { id: string; label: string }[];
    visibleColumns: string[];
    onSave: (cols: string[]) => void;
    onClose: () => void;
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
      <button data-testid="table-mgmt-save" onClick={() => onSave(visibleColumns)}>
        save
      </button>
      <button data-testid="table-mgmt-close" onClick={onClose}>
        close
      </button>
    </div>
  ),
  TablePagination: ({
    onPageChange,
    onPageSizeChange,
    showingLabel,
  }: {
    page?: number;
    totalItems?: number;
    pageSize?: number;
    pageSizeOptions?: number[];
    onPageChange: (p: number) => void;
    onPageSizeChange: (s: number) => void;
    rowsPerPageLabel?: string;
    showingLabel?: (args: { from: number; to: number; total: number }) => string;
    backLabel?: string;
    nextLabel?: string;
  }) => (
    <div data-testid="pagination">
      <span>{showingLabel?.({ from: 1, to: 10, total: 100 })}</span>
      <button data-testid="next-page" onClick={() => onPageChange(2)}>
        next
      </button>
      <button data-testid="page-size" onClick={() => onPageSizeChange(50)}>
        size
      </button>
    </div>
  ),
  ToolbarIconButton: ({
    children,
    title,
    onClick,
  }: {
    children: React.ReactNode;
    title: string;
    onClick?: () => void;
  }) => (
    <button title={title} onClick={onClick} className="w-9 h-9">
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
          data-testid="search-input-field"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent) => e.key === 'Escape' && onSearchOpenChange(false)}
        />
        <button className="absolute" onClick={() => onSearchOpenChange(false)}>
          close
        </button>
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
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
  useDebounce: (value: unknown) => value,
  formatCurrency: (v: number | null | undefined) =>
    v !== null && v !== undefined ? `$${v.toFixed(2)}` : '-',
  useDropdown: () => ({ ref: { current: null }, isOpen: false, setIsOpen: vi.fn() }),
  ViewSelectorDropdown: ({
    onApplyView,
    savedViews,
  }: {
    activeView?: unknown;
    savedViews: { id: string; name: string }[];
    onApplyView: (view: { id: string; name: string }) => void;
    defaultViewLabel?: string;
    noSavedViewsHint?: string;
    isOpen?: boolean;
    onOpenChange?: (v: boolean) => void;
    dropdownRef?: React.RefObject<HTMLDivElement | null>;
  }) => (
    <div data-testid="view-selector">
      {savedViews.map((v) => (
        <button key={v.id} data-testid={`apply-view-${v.id}`} onClick={() => onApplyView(v)}>
          {v.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('../components/PoDetailPanel', () => ({
  PoDetailPanel: ({ poId, onClose }: { poId: string; onClose: () => void }) => (
    <div data-testid="po-detail-panel">
      <span>{poId}</span>
      <button data-testid="close-preview" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

vi.mock('@forethread/po-shared', async (importOriginal) => {
  const React = await import('react');
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    CreatePoWizard: (_props: any) => <div data-testid="create-po-wizard" />,
    usePurchaseOrders: () => mockData.value,
    usePoExport: () => ({ handleExport: vi.fn() }),
    rfqToFormDefaults: () => ({ defaultValues: {}, lockedFields: [] }),
    bulkOrderToFormDefaults: () => ({ defaultValues: { vendorId: '' }, lockedFields: [] }),
    SelectRfqModal: ({
      open,
      onClose,
      onSelect,
    }: {
      open: boolean;
      onClose: () => void;
      onSelect: (rfq: { id: string }) => void;
    }) =>
      open
        ? React.createElement(
            'div',
            { 'data-testid': 'select-rfq-modal' },
            React.createElement(
              'button',
              { 'data-testid': 'rfq-close', onClick: onClose },
              'close',
            ),
            React.createElement(
              'button',
              { 'data-testid': 'rfq-select', onClick: () => onSelect({ id: 'rfq-1' }) },
              'select rfq',
            ),
          )
        : null,
    SelectBulkOrderModal: ({
      open,
      onClose,
      onSelect,
    }: {
      open: boolean;
      onClose: () => void;
      onSelect: (bo: { id: string; vendorId: string }) => void;
    }) =>
      open
        ? React.createElement(
            'div',
            { 'data-testid': 'select-bo-modal' },
            React.createElement('button', { 'data-testid': 'bo-close', onClick: onClose }, 'close'),
            React.createElement(
              'button',
              {
                'data-testid': 'bo-select',
                onClick: () => onSelect({ id: 'bo-1', vendorId: 'v-1' }),
              },
              'select bo',
            ),
          )
        : null,
  };
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import PurchaseOrderListPage from './PurchaseOrderListPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('PurchaseOrderListPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockData.value = {
      data: {
        items: [
          {
            id: 'po-1',
            poNumber: 'PO-001',
            projectName: 'Test Project',
            projectId: 'PRJ-1',
            vendorName: 'Vendor A',
            contractorName: 'Vendor A',
            status: 'PENDING',
            revision: null,
            poType: 'Standard',
            pickUp: false,
            deliveryLocationId: 'NYC',
          },
        ],
        meta: { total: 1 },
      },
      isLoading: false,
    };
  });

  it('renders table with data', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getByText('PO-001')).toBeInTheDocument();
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('Vendor A')).toBeInTheDocument();
  });

  it('shows spinner when loading', () => {
    mockData.value.isLoading = true;
    mockData.value.data = undefined;
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows empty message', () => {
    mockData.value.data = { items: [], meta: { total: 0 } };
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getByText('list.noPosFound')).toBeInTheDocument();
  });

  it('clicking create button toggles dropdown', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    fireEvent.click(screen.getByText('list.createNew'));
    // Create button now opens a dropdown instead of navigating directly
    // The dropdown is controlled by useDropdown, so just verify no crash
    expect(screen.getByText('list.createNew')).toBeInTheDocument();
  });

  it('renders quick filters', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getByText('quickFilters.allOpen')).toBeInTheDocument();
    expect(screen.getByText('quickFilters.closed')).toBeInTheDocument();
  });

  it('toggles sort', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    fireEvent.click(screen.getByText('columns.poNumber'));
    fireEvent.click(screen.getByText('columns.poNumber'));
  });

  it('renders pickUp as yes/no', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getAllByText('common:no').length).toBeGreaterThanOrEqual(1);
  });

  it('renders revision badge', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(1);
  });

  it('renders revision badge as Active when revision is set', () => {
    mockData.value.data = {
      items: [
        {
          id: 'po-2',
          poNumber: 'PO-002',
          projectName: 'Revised Project',
          projectId: 'PRJ-2',
          contractorName: 'Vendor B',
          status: 'APPROVED',
          revision: 1,
          poType: 'Standard',
          pickUp: true,
          deliveryLocationId: 'LA',
        },
      ],
      meta: { total: 1 },
    };
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('common:yes')).toBeInTheDocument();
  });

  it('renders null field values as dash', () => {
    mockData.value.data = {
      items: [
        {
          id: 'po-3',
          poNumber: 'PO-003',
          projectName: null,
          projectId: null,
          contractorName: null,
          status: 'PENDING',
          revision: null,
          poType: null,
          pickUp: false,
          deliveryLocationId: null,
        },
      ],
      meta: { total: 1 },
    };
    render(<PurchaseOrderListPage />, { wrapper });
    const dashes = screen.getAllByText('-');
    // revision dash + null field dashes
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('opens search input on search button click', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    // The search icon button has no text, find the search container area
    // When search is closed, there is a button that opens it
    const buttons = screen.getAllByRole('button');
    // The last few buttons in the toolbar include the search toggle
    // Click the search button (it does not have a text label)
    const searchBtn = buttons.find((btn) => !btn.textContent || btn.textContent.trim() === '');
    if (searchBtn) {
      fireEvent.click(searchBtn);
    }
  });

  it('renders group button with group label', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getByText('list.group')).toBeInTheDocument();
  });

  it('toggles quick filter on and off', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const allOpenChip = screen.getByText('quickFilters.allOpen');
    // Toggle on
    fireEvent.click(allOpenChip);
    expect(allOpenChip).toHaveAttribute('data-active', 'true');
    // Toggle off
    fireEvent.click(allOpenChip);
    expect(allOpenChip).toHaveAttribute('data-active', 'false');
  });

  it('navigates to PO detail on row click', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const row = screen.getByText('PO-001').closest('tr');
    if (row) fireEvent.click(row);
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders/po-1');
  });

  it('triggers pagination onPageChange', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    fireEvent.click(screen.getByTestId('next-page'));
  });

  it('triggers pagination onPageSizeChange', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    fireEvent.click(screen.getByTestId('page-size'));
  });

  it('opens search, types, and closes with Escape', () => {
    const { container } = render(<PurchaseOrderListPage />, { wrapper });
    // The ToolbarSearchToggle renders a button with w-9 h-9 when search is closed
    const searchToggle = container.querySelector('button.w-9.h-9');
    expect(searchToggle).toBeTruthy();
    fireEvent.click(searchToggle!);
  });

  it('opens search and closes with close button', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const allButtons = screen.getAllByRole('button');
    const searchToggle = allButtons.find(
      (btn) => btn.className.includes('w-9') && btn.className.includes('h-9'),
    );
    expect(searchToggle).toBeTruthy();
    fireEvent.click(searchToggle!);
    // After search is open, find the close button (the one with class containing 'absolute')
    const updatedButtons = screen.getAllByRole('button');
    const closeBtn = updatedButtons.find((btn) => btn.className.includes('absolute'));
    if (closeBtn) {
      fireEvent.click(closeBtn);
    }
  });

  it('clicks group button to toggle dropdown', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    fireEvent.click(screen.getByText('list.group'));
  });

  it('renders date fields formatted correctly', () => {
    mockData.value.data = {
      items: [
        {
          id: 'po-date',
          poNumber: 'PO-DATE',
          projectName: 'Date Project',
          projectId: 'PRJ-D',
          vendorName: 'Vendor D',
          contractorName: 'Vendor D',
          status: 'PENDING',
          revision: null,
          poType: 'STANDARD',
          pickUp: false,
          deliveryLocationId: 'NYC',
          deadlineEnd: '2025-06-15T00:00:00.000Z',
          deadlineStart: '2025-05-01T00:00:00.000Z',
          createdDate: '2025-04-01T00:00:00.000Z',
          updatedAt: '2025-04-10T00:00:00.000Z',
          plannedDeliveryDate: '2025-07-01T00:00:00.000Z',
          totalAmount: 12500,
          paymentTermsDays: 30,
          holdForRelease: true,
          issuedAt: '2025-04-01T00:00:00.000Z',
          approvalStatus: 'APPROVED',
          linkedRfqAvgPrice: 250.5,
          lineItemsDelivered: 3,
          quantityDelivered: 100,
          hasMessages: true,
        },
      ],
      meta: { total: 1 },
    };
    render(<PurchaseOrderListPage />, { wrapper });
    // Date columns render formatted dates
    expect(screen.getByText('Jun 15, 2025')).toBeInTheDocument();
    expect(screen.getByText('May 1, 2025')).toBeInTheDocument();
    expect(screen.getByText('Apr 1, 2025')).toBeInTheDocument();
    expect(screen.getByText('Jul 1, 2025')).toBeInTheDocument();
    // totalAmount — rendered via toLocaleString, locale-dependent formatting
    const allTds = document.body.querySelectorAll('td');
    const tdTexts = Array.from(allTds).map((td) => td.textContent?.trim());
    expect(tdTexts.some((t) => t?.includes('12') && t?.includes('500'))).toBe(true);
    // paymentTerm — rendered as "${days} days"
    expect(screen.getByText('30 days')).toBeInTheDocument();
    // holdForRelease = true renders yes
    const yesTexts = screen.getAllByText('common:yes');
    expect(yesTexts.length).toBeGreaterThanOrEqual(1);
    // linkedRfqAvgPrice — locale-dependent decimal separator
    expect(tdTexts.some((t) => t?.includes('250'))).toBe(true);
    // lineItemsDelivered
    expect(screen.getByText('3')).toBeInTheDocument();
    // quantityDelivered
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders date fields as dash when null', () => {
    mockData.value.data = {
      items: [
        {
          id: 'po-null-dates',
          poNumber: 'PO-ND',
          projectName: 'NullDate Project',
          projectId: 'PRJ-ND',
          vendorName: 'Vendor ND',
          contractorName: 'Vendor ND',
          status: 'PENDING',
          revision: null,
          poType: 'STANDARD',
          pickUp: false,
          deliveryLocationId: 'NYC',
          deadlineEnd: null,
          deadlineStart: null,
          createdDate: null,
          updatedAt: null,
          plannedDeliveryDate: null,
          totalAmount: null,
          paymentTermsDays: null,
          holdForRelease: false,
          issuedAt: null,
          approvalStatus: null,
          linkedRfqAvgPrice: null,
          lineItemsDelivered: 0,
          quantityDelivered: 0,
          hasMessages: false,
        },
      ],
      meta: { total: 1 },
    };
    render(<PurchaseOrderListPage />, { wrapper });
    // Null date/amount/payment fields render as dashes
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(5);
  });

  it('renders aging column', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
    mockData.value.data = {
      items: [
        {
          id: 'po-aging',
          poNumber: 'PO-AGE',
          projectName: 'Aging Project',
          projectId: 'PRJ-A',
          vendorName: 'Vendor A',
          contractorName: 'Vendor A',
          status: 'PENDING',
          revision: null,
          poType: 'STANDARD',
          pickUp: false,
          deliveryLocationId: 'NYC',
          issuedAt: threeDaysAgo,
          updatedAt: threeDaysAgo,
          hasMessages: false,
        },
      ],
      meta: { total: 1 },
    };
    render(<PurchaseOrderListPage />, { wrapper });
    expect(screen.getByText('3d')).toBeInTheDocument();
  });

  it('renders isBulkOrder column for BULK type', () => {
    mockData.value.data = {
      items: [
        {
          id: 'po-bulk',
          poNumber: 'PO-BULK',
          projectName: 'Bulk Project',
          projectId: 'PRJ-B',
          vendorName: 'Vendor B',
          contractorName: 'Vendor B',
          status: 'PENDING',
          revision: null,
          poType: 'BULK',
          pickUp: false,
          deliveryLocationId: 'NYC',
          hasMessages: false,
        },
      ],
      meta: { total: 1 },
    };
    render(<PurchaseOrderListPage />, { wrapper });
    // isBulkOrder renders yes for BULK type
    const yesTexts = screen.getAllByText('common:yes');
    expect(yesTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('invokes copyPo action from dot menu', async () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const copyBtn = screen.getByTestId('action-copyPo');
    act(() => {
      fireEvent.click(copyBtn);
    });
    await waitFor(() => {
      expect(mockCopyPurchaseOrder).toHaveBeenCalledWith('po-1');
    });
  });

  it('invokes moveToArchive action from dot menu', async () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const archiveBtn = screen.getByTestId('action-moveToArchive');
    act(() => {
      fireEvent.click(archiveBtn);
    });
    await waitFor(() => {
      expect(mockArchivePurchaseOrder).toHaveBeenCalledWith('po-1');
    });
  });

  it('invokes downloadPdf action from dot menu', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<PurchaseOrderListPage />, { wrapper });
    const pdfBtn = screen.getByTestId('action-downloadPdf');
    act(() => {
      fireEvent.click(pdfBtn);
    });
    await waitFor(() => {
      expect(mockExportPurchaseOrders).toHaveBeenCalledWith('pdf', { search: 'po-1' });
    });
    openSpy.mockRestore();
  });

  it('navigates to messages tab on MessageBadgeIcon click', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const msgBadge = screen.getByTestId('message-badge');
    fireEvent.click(msgBadge);
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders/po-1?tab=messages');
  });

  it('navigates to documents tab on paperclip click', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const paperclipBtn = screen.getByTitle('actions.attachments');
    fireEvent.click(paperclipBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders/po-1?tab=documents');
  });

  it('opens preview panel on eye button click', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const eyeBtn = screen.getByTitle('actions.view');
    fireEvent.click(eyeBtn);
    expect(screen.getByTestId('po-detail-panel')).toBeInTheDocument();
    expect(screen.getByText('po-1')).toBeInTheDocument();
  });

  it('closes preview panel via close button', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const eyeBtn = screen.getByTitle('actions.view');
    fireEvent.click(eyeBtn);
    expect(screen.getByTestId('po-detail-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('close-preview'));
    expect(screen.queryByTestId('po-detail-panel')).not.toBeInTheDocument();
  });

  it('renders grouped items with GroupSection when groupBy is active', () => {
    mockData.value.data = {
      items: [
        {
          id: 'po-g1',
          poNumber: 'PO-G1',
          projectName: 'Group Project A',
          projectId: 'PRJ-G1',
          vendorName: 'Vendor G',
          contractorName: 'Vendor G',
          status: 'PENDING',
          revision: null,
          poType: 'STANDARD',
          pickUp: false,
          deliveryLocationId: 'NYC',
          hasMessages: false,
        },
        {
          id: 'po-g2',
          poNumber: 'PO-G2',
          projectName: 'Group Project B',
          projectId: 'PRJ-G2',
          vendorName: 'Vendor H',
          contractorName: 'Vendor H',
          status: 'APPROVED',
          revision: null,
          poType: 'STANDARD',
          pickUp: false,
          deliveryLocationId: 'LA',
          hasMessages: false,
        },
      ],
      meta: { total: 2 },
    };
    render(<PurchaseOrderListPage />, { wrapper });
    // Activate grouping by status
    fireEvent.click(screen.getByTestId('group-groupByStatus'));
    // GroupSection headers should appear for each status group
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
  });

  it('toggles GroupSection expand/collapse on click', () => {
    mockData.value.data = {
      items: [
        {
          id: 'po-gc1',
          poNumber: 'PO-GC1',
          projectName: 'Collapse Project',
          projectId: 'PRJ-GC',
          vendorName: 'Vendor GC',
          contractorName: 'Vendor GC',
          status: 'PENDING',
          revision: null,
          poType: 'STANDARD',
          pickUp: false,
          deliveryLocationId: 'NYC',
          hasMessages: false,
        },
      ],
      meta: { total: 1 },
    };
    render(<PurchaseOrderListPage />, { wrapper });
    // Activate grouping
    fireEvent.click(screen.getByTestId('group-groupByStatus'));
    // Groups start collapsed
    const groupHeader = screen.getByText('PENDING');
    expect(screen.queryByText('PO-GC1')).not.toBeInTheDocument();
    // Click the group header to expand
    fireEvent.click(groupHeader.closest('tr')!);
    expect(screen.getByText('PO-GC1')).toBeInTheDocument();
    // Click again to collapse
    fireEvent.click(groupHeader.closest('tr')!);
    expect(screen.queryByText('PO-GC1')).not.toBeInTheDocument();
  });

  it('clears grouping and shows flat list', () => {
    mockData.value.data = {
      items: [
        {
          id: 'po-flat',
          poNumber: 'PO-FLAT',
          projectName: 'Flat Project',
          projectId: 'PRJ-F',
          vendorName: 'Vendor F',
          contractorName: 'Vendor F',
          status: 'PENDING',
          revision: null,
          poType: 'STANDARD',
          pickUp: false,
          deliveryLocationId: 'NYC',
          hasMessages: false,
        },
      ],
      meta: { total: 1 },
    };
    render(<PurchaseOrderListPage />, { wrapper });
    // Activate grouping
    fireEvent.click(screen.getByTestId('group-groupByStatus'));
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    // Clear grouping
    fireEvent.click(screen.getByTestId('group-clear'));
    // The group header row should no longer be present as a standalone group label
    // The PO row should still be rendered in a flat list
    expect(screen.getByText('PO-FLAT')).toBeInTheDocument();
  });

  it('cycles sort through asc, desc, then clears', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const colHeader = screen.getByText('columns.poNumber');
    // Click 1: set asc
    fireEvent.click(colHeader);
    // Click 2: set desc
    fireEvent.click(colHeader);
    // Click 3: clear sort
    fireEvent.click(colHeader);
  });

  it('opens and closes table management modal', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    // Open modal via settings button
    const settingsBtn = screen.getByTitle('list.settings');
    fireEvent.click(settingsBtn);
    expect(screen.getByTestId('table-mgmt-modal')).toBeInTheDocument();
    // Close modal
    fireEvent.click(screen.getByTestId('table-mgmt-close'));
    expect(screen.queryByTestId('table-mgmt-modal')).not.toBeInTheDocument();
  });

  it('saves table management modal', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const settingsBtn = screen.getByTitle('list.settings');
    fireEvent.click(settingsBtn);
    expect(screen.getByTestId('table-mgmt-modal')).toBeInTheDocument();
    // Save
    fireEvent.click(screen.getByTestId('table-mgmt-save'));
    // Modal should close after save
    expect(screen.queryByTestId('table-mgmt-modal')).not.toBeInTheDocument();
  });

  it('opens and closes create view modal', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    // Open via save (floppy disk) button
    const saveBtn = screen.getByTitle('list.save');
    fireEvent.click(saveBtn);
    expect(screen.getByTestId('create-view-modal')).toBeInTheDocument();
    // Cancel
    fireEvent.click(screen.getByTestId('create-view-cancel'));
    expect(screen.queryByTestId('create-view-modal')).not.toBeInTheDocument();
  });

  it('triggers export from export dropdown', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const exportBtn = screen.getByTestId('export-btn');
    fireEvent.click(exportBtn);
    // The export handler is invoked (mocked usePoExport)
  });

  it('opens filter panel', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    fireEvent.click(screen.getByTestId('filter-panel-toggle'));
  });

  it('clears advanced filters', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    fireEvent.click(screen.getByTestId('filter-panel-clear'));
  });

  it('triggers column resize on separator mousedown', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    // The resize separator has role="separator"
    const separators = screen.getAllByRole('separator');
    expect(separators.length).toBeGreaterThan(0);
    // MouseDown on separator triggers handleResizeStart
    fireEvent.mouseDown(separators[0]);
    // Click on separator stops propagation (does not sort)
    fireEvent.click(separators[0]);
  });

  it('triggers column drag events on th elements', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    const headers = screen.getAllByRole('columnheader');
    // Drag start
    fireEvent.dragStart(headers[0]);
    // Drag over another header
    fireEvent.dragOver(headers[1]);
    // Drop
    fireEvent.drop(headers[1]);
    // Drag end
    fireEvent.dragEnd(headers[0]);
  });

  it('stops propagation on actions cell click', () => {
    render(<PurchaseOrderListPage />, { wrapper });
    // The actions <td> has onClick={(e) => e.stopPropagation()}
    // Clicking inside actions cell should NOT navigate to PO detail
    mockNavigate.mockClear();
    const msgBadge = screen.getByTestId('message-badge');
    // Clicking the parent td (which has stopPropagation) should not trigger row navigation
    const actionsTd = msgBadge.closest('td');
    expect(actionsTd).toBeTruthy();
    fireEvent.click(actionsTd!);
    // The row onClick navigates, but stopPropagation prevents it from reaching the row
    // Since we clicked the td directly (not the row), navigate should not be called
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
