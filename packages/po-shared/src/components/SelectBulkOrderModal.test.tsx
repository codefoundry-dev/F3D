const mockOnClose = vi.hoisted(() => vi.fn());
const mockOnSelect = vi.hoisted(() => vi.fn());
const mockUseQuery = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', () => ({
  getBulkOrders: vi.fn(),
  getBulkOrder: vi.fn(),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'defaultValue' in opts) return opts.defaultValue as string;
      return key;
    },
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  Modal: ({ children }: any) => <div data-testid="modal">{children}</div>,
  ModalGridBackground: () => <div data-testid="modal-grid-bg" />,
  ModalIconHeader: ({ title, subtitle, onClose }: any) => (
    <div data-testid="modal-icon-header">
      <span>{title}</span>
      <span>{subtitle}</span>
      <button data-testid="header-close" onClick={onClose} />
    </div>
  ),
  CustomDropdown: ({ value, onChange, options }: any) => (
    <select
      data-testid="uom-dropdown"
      value={value}
      onChange={(e: any) => onChange(e.target.value)}
    >
      <option value="">All UoM</option>
      {options?.map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
  QueryContainer: ({ children, isLoading, isEmpty, emptyMessage }: any) => {
    if (isLoading) return <div data-testid="loading">Loading...</div>;
    if (isEmpty) return <div data-testid="empty">{emptyMessage}</div>;
    return <>{children}</>;
  },
  FiltersButton: ({ onClick, label }: any) => (
    <button data-testid="filters-button" onClick={onClick}>
      {label}
    </button>
  ),
  SearchInput: (props: any) => <input data-testid="search-input" {...props} />,
  ModalFilterPanel: ({ children }: any) => <div data-testid="filter-panel">{children}</div>,
  SelectionBar: ({
    selectedCount,
    onClear,
    onAction,
    actionLabel,
    clearTitle,
    selectedLabel,
  }: any) =>
    selectedCount > 0 ? (
      <div data-testid="selection-bar">
        <button title={clearTitle ?? 'Clear selection'} onClick={onClear}>
          clear
        </button>
        <span>
          {selectedCount} {selectedLabel ?? 'items selected'}
        </span>
        {onAction && <button onClick={onAction}>{actionLabel ?? 'Add selected'}</button>}
      </div>
    ) : null,
  ItemMeta: ({ label, value }: any) => (
    <span data-testid="item-meta">
      {label}: {value}
    </span>
  ),
  formatCurrency: (v: number) => `$${v.toFixed(2)}`,
  formatDate: (v: string) => v,
}));

vi.mock('@forethread/ui-components/assets/icons/back-arrow.svg?react', () => ({
  default: () => <span data-testid="icon-back" />,
}));
vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/coins.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/cross.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <span data-testid="icon-cross-circle" />,
}));
vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <span data-testid="icon-eye" />,
}));
vi.mock('@forethread/ui-components/assets/icons/filter.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/package.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/plus-in-circle.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/search.svg?react', () => ({
  default: () => <span />,
}));

vi.mock('@tanstack/react-query', () => ({ useQuery: mockUseQuery }));

import { render, screen, fireEvent } from '@testing-library/react';

import { SelectBulkOrderModal } from './SelectBulkOrderModal';

const bulkOrders = [
  {
    id: 'bo-1',
    projectName: 'Alpha Project',
    vendorName: 'Vendor One',
    validUntil: '2026-12-31',
  },
  {
    id: 'bo-2',
    projectName: 'Beta Project',
    vendorName: 'Vendor Two',
    validUntil: null,
  },
];

const lineItems = [
  {
    lineItemId: 'li-1',
    itemReference: 'Steel Rod 12mm',
    description: 'Structural steel rod',
    unit: 'kg',
    pricePerUnit: 15.5,
    qtyRemaining: 100,
    totalLineInc: 1550,
  },
  {
    lineItemId: 'li-2',
    itemReference: 'Concrete Mix',
    description: 'Ready-mix concrete',
    unit: 'm3',
    pricePerUnit: 120,
    qtyRemaining: 50,
    totalLineInc: 6000,
  },
];

function setupQueryMock(
  listData: { items: typeof bulkOrders } | undefined = { items: bulkOrders },
  detailData:
    | (typeof lineItems extends (infer U)[] ? { projectName: string; lineItems: U[] } : never)
    | undefined = undefined,
) {
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'bulk-orders' && queryKey[1] === 'select-for-po') {
      return { data: listData, isLoading: false };
    }
    // detail query
    return {
      data: detailData,
      isLoading: false,
    };
  });
}

describe('SelectBulkOrderModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when not open', () => {
    setupQueryMock();
    const { container } = render(
      <SelectBulkOrderModal open={false} onClose={mockOnClose} onSelect={mockOnSelect} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders modal with title and subtitle', () => {
    setupQueryMock();
    render(<SelectBulkOrderModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />);
    expect(screen.getByText('selectBoModal.title')).toBeInTheDocument();
    expect(screen.getByText('selectBoModal.subtitle')).toBeInTheDocument();
  });

  it('shows list of bulk orders from API', () => {
    setupQueryMock();
    render(<SelectBulkOrderModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />);
    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    expect(screen.getByText('Beta Project')).toBeInTheDocument();
  });

  it('clicking a bulk order calls onSelect with that item', () => {
    setupQueryMock();
    render(<SelectBulkOrderModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />);
    fireEvent.click(screen.getByText('Alpha Project'));
    expect(mockOnSelect).toHaveBeenCalledWith(bulkOrders[0]);
  });

  it('eye icon button opens detail view', () => {
    setupQueryMock({ items: bulkOrders }, { projectName: 'Alpha Project', lineItems });
    render(<SelectBulkOrderModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />);
    // Find the eye icon buttons (one per bulk order row)
    const eyeButtons = screen.getAllByTitle('bulkOrdersModal.viewItems');
    fireEvent.click(eyeButtons[0]);

    // Should now show the detail view with the project name heading
    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    // "Add all items" button should be visible
    expect(screen.getByText('bulkOrdersModal.addAllItems')).toBeInTheDocument();
  });

  it('detail view: "Add all items" button calls onSelect with the bulk order', () => {
    setupQueryMock({ items: bulkOrders }, { projectName: 'Alpha Project', lineItems });
    render(<SelectBulkOrderModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />);
    const eyeButtons = screen.getAllByTitle('bulkOrdersModal.viewItems');
    fireEvent.click(eyeButtons[0]);

    fireEvent.click(screen.getByText('bulkOrdersModal.addAllItems'));
    expect(mockOnSelect).toHaveBeenCalledWith(bulkOrders[0]);
  });

  it('detail view: items can be selected and deselected', () => {
    setupQueryMock({ items: bulkOrders }, { projectName: 'Alpha Project', lineItems });
    render(<SelectBulkOrderModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />);
    const eyeButtons = screen.getAllByTitle('bulkOrdersModal.viewItems');
    fireEvent.click(eyeButtons[0]);

    // Both items should show "Select" buttons
    const selectBtns = screen.getAllByText('Select');
    expect(selectBtns).toHaveLength(2);

    // Select the first item
    fireEvent.click(selectBtns[0]);

    // Now one button should say "Deselect", the other "Select"
    expect(screen.getByText('Deselect')).toBeInTheDocument();
    expect(screen.getByText('Select')).toBeInTheDocument();

    // Deselect the item
    fireEvent.click(screen.getByText('Deselect'));
    expect(screen.queryByText('Deselect')).not.toBeInTheDocument();
    expect(screen.getAllByText('Select')).toHaveLength(2);
  });

  it('selection bar: X icon clears selection', () => {
    setupQueryMock({ items: bulkOrders }, { projectName: 'Alpha Project', lineItems });
    render(<SelectBulkOrderModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />);
    const eyeButtons = screen.getAllByTitle('bulkOrdersModal.viewItems');
    fireEvent.click(eyeButtons[0]);

    // Select an item to show the selection bar
    fireEvent.click(screen.getAllByText('Select')[0]);
    expect(screen.getByText(/1 bulkOrdersModal.itemsSelected/)).toBeInTheDocument();

    // Click the clear (X) button in the selection bar
    const clearBtn = screen.getByTitle('Clear selection');
    fireEvent.click(clearBtn);

    // Selection bar should disappear
    expect(screen.queryByText(/bulkOrdersModal.itemsSelected/)).not.toBeInTheDocument();
  });

  it('selection bar: "Add items (N)" calls onSelect with selectedItemIds', () => {
    setupQueryMock({ items: bulkOrders }, { projectName: 'Alpha Project', lineItems });
    render(<SelectBulkOrderModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />);
    const eyeButtons = screen.getAllByTitle('bulkOrdersModal.viewItems');
    fireEvent.click(eyeButtons[0]);

    // Select both items
    const selectBtns = screen.getAllByText('Select');
    fireEvent.click(selectBtns[0]);
    fireEvent.click(selectBtns[1]);

    // Click "Add items" (action button in selection bar)
    const addItemsBtn = screen.getByText('Add items');
    fireEvent.click(addItemsBtn);

    expect(mockOnSelect).toHaveBeenCalledWith(bulkOrders[0], new Set(['li-1', 'li-2']));
  });

  it('search filters the bulk order list', () => {
    setupQueryMock();
    render(<SelectBulkOrderModal open={true} onClose={mockOnClose} onSelect={mockOnSelect} />);

    const searchInput = screen.getByPlaceholderText('selectBoModal.searchPlaceholder');
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });

    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    expect(screen.queryByText('Beta Project')).not.toBeInTheDocument();
  });
});
