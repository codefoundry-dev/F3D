// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mockOnClose = vi.hoisted(() => vi.fn());
const mockOnSelect = vi.hoisted(() => vi.fn());

const mockUseQueryReturn = vi.hoisted(() => ({
  list: {
    data: {
      items: [
        {
          id: 'rfq-1',
          rfqNumber: 'RFQ-001',
          projectName: 'Alpha Project',
          createdDate: '2025-06-01T00:00:00Z',
          createdBy: 'John Doe',
        },
        {
          id: 'rfq-2',
          rfqNumber: 'RFQ-002',
          projectName: 'Beta Project',
          createdDate: '2025-07-01T00:00:00Z',
          createdBy: 'Jane Smith',
        },
      ],
    },
    isLoading: false,
  },
  detail: {
    data: {
      id: 'rfq-1',
      name: 'Alpha RFQ',
      lineItems: [
        {
          id: 'li-1',
          materialName: 'Steel Beam',
          description: 'Heavy duty beam',
          quantity: 10,
          unit: 'pcs',
          projectName: 'Alpha Project',
          expectedDeliveryDate: '2025-08-01T00:00:00Z',
          deliveryLocation: 'Warehouse A',
        },
        {
          id: 'li-2',
          materialName: 'Copper Wire',
          description: 'Electrical wire',
          quantity: 50,
          unit: 'm',
          projectName: 'Alpha Project',
          expectedDeliveryDate: '2025-09-01T00:00:00Z',
          deliveryLocation: null,
        },
      ],
      quoteResponses: [
        {
          id: 'qr-1',
          vendorName: 'Vendor A',
          status: 'APPROVED',
          totalCost: 1000,
          discountPercent: 10,
          discountAmount: 100,
        },
      ],
    } as Record<string, unknown> | undefined,
    isLoading: false,
  },
}));

// ── Module mocks (before imports) ────────────────────────────────────────────

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'defaultValue' in opts) return opts.defaultValue as string;
      return key;
    },
  }),
}));

vi.mock('@forethread/api-client', () => ({
  getRfqs: vi.fn(),
  getRfq: vi.fn(),
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({ children, onClick, ...rest }: any) => (
    <button onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Modal: ({ children }: any) => <div data-testid="modal">{children}</div>,
  ModalGridBackground: () => <div data-testid="modal-grid-bg" />,
  ModalIconHeader: ({ title, subtitle, onClose }: any) => (
    <div data-testid="modal-icon-header">
      <span>{title}</span>
      <span>{subtitle}</span>
      <button data-testid="modal-close" onClick={onClose} />
    </div>
  ),
  CustomDropdown: ({ value, onChange }: any) => (
    <select
      data-testid="uom-dropdown"
      value={value}
      onChange={(e: any) => onChange(e.target.value)}
    >
      <option value="">All</option>
    </select>
  ),
  QueryContainer: ({ children, isLoading, isEmpty, emptyMessage }: any) => {
    if (isLoading) return <div>Loading...</div>;
    if (isEmpty) return <div>{emptyMessage}</div>;
    return <>{children}</>;
  },
  ItemMeta: ({ label, value }: any) => (
    <div data-testid="item-meta">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
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
        {onAction && <button onClick={onAction}>{actionLabel ?? 'Add items'}</button>}
      </div>
    ) : null,
}));

vi.mock('@forethread/ui-components/assets/icons/arrow-right.svg?react', () => ({
  default: () => <span data-testid="icon-arrow-right" />,
}));
vi.mock('@forethread/ui-components/assets/icons/back-arrow.svg?react', () => ({
  default: () => <span data-testid="icon-back-arrow" />,
}));
vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <span data-testid="icon-checkcircle" />,
}));
vi.mock('@forethread/ui-components/assets/icons/chevron-right.svg?react', () => ({
  default: () => <span data-testid="icon-chevron-right" />,
}));
vi.mock('@forethread/ui-components/assets/icons/coins.svg?react', () => ({
  default: () => <span data-testid="icon-coins" />,
}));
vi.mock('@forethread/ui-components/assets/icons/cross.svg?react', () => ({
  default: () => <span data-testid="icon-cross" />,
}));
vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <span data-testid="icon-cross-in-circle" />,
}));
vi.mock('@forethread/ui-components/assets/icons/date.svg?react', () => ({
  default: () => <span data-testid="icon-date" />,
}));
vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({
  default: () => <span data-testid="icon-delete" />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <span data-testid="icon-eye" />,
}));
vi.mock('@forethread/ui-components/assets/icons/filter.svg?react', () => ({
  default: () => <span data-testid="icon-filter" />,
}));
vi.mock('@forethread/ui-components/assets/icons/package.svg?react', () => ({
  default: () => <span data-testid="icon-package" />,
}));
vi.mock('@forethread/ui-components/assets/icons/plus-in-circle.svg?react', () => ({
  default: () => <span data-testid="icon-plus-in-circle" />,
}));
vi.mock('@forethread/ui-components/assets/icons/search.svg?react', () => ({
  default: () => <span data-testid="icon-search" />,
}));
vi.mock('@forethread/ui-components/assets/icons/tax.svg?react', () => ({
  default: () => <span data-testid="icon-tax" />,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'rfqs' && queryKey[1] === 'select-for-po') {
      return mockUseQueryReturn.list;
    }
    // detail query
    return mockUseQueryReturn.detail;
  },
}));

vi.mock('../utils/format', () => ({
  formatCurrency: (v: number) => `$${v.toFixed(2)}`,
  formatDate: (v: string | null) => v ?? '-',
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { render, screen, fireEvent } from '@testing-library/react';

import { SelectRfqModal } from './SelectRfqModal';

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderModal(
  props: Partial<{ open: boolean; onClose: () => void; onSelect: (...args: any[]) => void }> = {},
) {
  return render(
    <SelectRfqModal
      open={props.open ?? true}
      onClose={props.onClose ?? mockOnClose}
      onSelect={props.onSelect ?? mockOnSelect}
    />,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SelectRfqModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset detail data to default
    mockUseQueryReturn.detail.data = {
      id: 'rfq-1',
      name: 'Alpha RFQ',
      lineItems: [
        {
          id: 'li-1',
          materialName: 'Steel Beam',
          description: 'Heavy duty beam',
          quantity: 10,
          unit: 'pcs',
          projectName: 'Alpha Project',
          expectedDeliveryDate: '2025-08-01T00:00:00Z',
          deliveryLocation: 'Warehouse A',
        },
        {
          id: 'li-2',
          materialName: 'Copper Wire',
          description: 'Electrical wire',
          quantity: 50,
          unit: 'm',
          projectName: 'Alpha Project',
          expectedDeliveryDate: '2025-09-01T00:00:00Z',
          deliveryLocation: null,
        },
      ],
      quoteResponses: [
        {
          id: 'qr-1',
          vendorName: 'Vendor A',
          status: 'APPROVED',
          totalCost: 1000,
          discountPercent: 10,
          discountAmount: 100,
        },
      ],
    };
  });

  it('returns null when open is false', () => {
    const { container } = renderModal({ open: false });
    expect(container.innerHTML).toBe('');
  });

  it('renders modal with title and subtitle', () => {
    renderModal();
    expect(screen.getByText('selectRfqModal.title')).toBeInTheDocument();
    expect(screen.getByText('selectRfqModal.subtitle')).toBeInTheDocument();
  });

  it('shows list of RFQs from API', () => {
    renderModal();
    expect(screen.getByText('RFQ-001')).toBeInTheDocument();
    expect(screen.getByText('RFQ-002')).toBeInTheDocument();
  });

  it('clicking an RFQ calls onSelect', () => {
    renderModal();
    fireEvent.click(screen.getByText('RFQ-001'));
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rfq-1', rfqNumber: 'RFQ-001' }),
    );
  });

  it('eye icon opens detail view', () => {
    renderModal();

    // The eye icons are buttons with title="approvedQuotes.viewQuotes"
    const eyeButtons = screen.getAllByTitle('approvedQuotes.viewQuotes');
    fireEvent.click(eyeButtons[0]);

    // Should now be in detail view — shows the RFQ name and "Add all items" button
    expect(screen.getByText('Alpha RFQ')).toBeInTheDocument();
    expect(screen.getByText('selectRfqModal.addAllItems')).toBeInTheDocument();
  });

  it('"Add all items" button calls onSelect without selectedItemIds', () => {
    renderModal();

    // Navigate to detail
    const eyeButtons = screen.getAllByTitle('approvedQuotes.viewQuotes');
    fireEvent.click(eyeButtons[0]);

    // Click "Add all items"
    fireEvent.click(screen.getByText('selectRfqModal.addAllItems'));

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'rfq-1' }));
    // Should NOT have a second argument (selectedItemIds)
    expect(mockOnSelect.mock.calls[0]).toHaveLength(1);
  });

  it('vendor-level "Select all" / "Deselect all" toggle works', () => {
    renderModal();

    // Go to detail view
    const eyeButtons = screen.getAllByTitle('approvedQuotes.viewQuotes');
    fireEvent.click(eyeButtons[0]);

    // The vendor header should be visible with "Select all" button
    const selectAllBtn = screen.getByText('selectRfqModal.selectAll');
    expect(selectAllBtn).toBeInTheDocument();

    // Click "Select all"
    fireEvent.click(selectAllBtn);

    // Now it should toggle to "Deselect all"
    expect(screen.getByText('Deselect all')).toBeInTheDocument();

    // Click "Deselect all"
    fireEvent.click(screen.getByText('Deselect all'));

    // Should go back to "Select all"
    expect(screen.getByText('selectRfqModal.selectAll')).toBeInTheDocument();
  });

  it('selection bar: X icon clears selection', () => {
    renderModal();

    // Go to detail
    const eyeButtons = screen.getAllByTitle('approvedQuotes.viewQuotes');
    fireEvent.click(eyeButtons[0]);

    // Select all items via vendor button
    fireEvent.click(screen.getByText('selectRfqModal.selectAll'));

    // Selection bar should appear with count
    expect(screen.getByText(/2.*selectRfqModal.itemsSelected/)).toBeInTheDocument();

    // Click X icon (clear selection) — title is "Clear selection" from defaultValue
    const clearBtn = screen.getByTitle('Clear selection');
    fireEvent.click(clearBtn);

    // Selection bar should be gone — no more "itemsSelected" text
    expect(screen.queryByText(/selectRfqModal.itemsSelected/)).not.toBeInTheDocument();
  });

  it('selection bar: "Add items (N)" button calls onSelect with selectedItemIds (original lineItemIds)', () => {
    renderModal();

    // Go to detail
    const eyeButtons = screen.getAllByTitle('approvedQuotes.viewQuotes');
    fireEvent.click(eyeButtons[0]);

    // Select all vendor items
    fireEvent.click(screen.getByText('selectRfqModal.selectAll'));

    // Click "Add items (2)"
    const addItemsBtn = screen.getByText(/Add items.*\(2\)/);
    fireEvent.click(addItemsBtn);

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'rfq-1' }),
      expect.any(Set),
    );
    // The Set should contain original lineItemIds, not composite IDs
    const selectedIds: Set<string> = mockOnSelect.mock.calls[0][1];
    expect(selectedIds.has('li-1')).toBe(true);
    expect(selectedIds.has('li-2')).toBe(true);
    expect(selectedIds.size).toBe(2);
  });

  it('item-level Select/Deselect buttons toggle selection', () => {
    renderModal();

    // Go to detail
    const eyeButtons = screen.getAllByTitle('approvedQuotes.viewQuotes');
    fireEvent.click(eyeButtons[0]);

    // The vendor accordion should be expanded (first vendor auto-expands)
    // Find the Select button for the first item
    const selectButtons = screen.getAllByText('selectRfqModal.select');
    expect(selectButtons.length).toBe(2); // one per item

    // Click Select on first item
    fireEvent.click(selectButtons[0]);

    // Now there should be a Deselect button for that item
    expect(screen.getByText('selectRfqModal.deselect')).toBeInTheDocument();
    // And 1 item still shows "Select"
    expect(screen.getAllByText('selectRfqModal.select')).toHaveLength(1);

    // Selection counter should show 1
    expect(screen.getByText(/1.*selectRfqModal.itemsSelected/)).toBeInTheDocument();

    // Click Deselect on first item
    fireEvent.click(screen.getByText('selectRfqModal.deselect'));

    // Should go back to 2 "Select" buttons and no selection bar
    expect(screen.getAllByText('selectRfqModal.select')).toHaveLength(2);
    expect(screen.queryByText(/selectRfqModal.itemsSelected/)).not.toBeInTheDocument();
  });
});
