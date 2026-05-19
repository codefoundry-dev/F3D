import {
  DataTable,
  DataTableSearch,
  DataTableQuickFilters,
  DataTableBulkActions,
  DataTableActions,
  type ColumnDef,
} from '@forethread/ui-components';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Mock SVG imports used by sub-components
vi.mock('@forethread/ui-components/assets/icons/search.svg?react', () => ({
  default: (props: any) => <svg data-testid="search-icon" {...props} />,
}));
vi.mock('@forethread/ui-components/assets/icons/checkmark.svg?react', () => ({
  default: (props: any) => <svg data-testid="checkmark-icon" {...props} />,
}));
vi.mock('@forethread/ui-components/assets/icons/arrow-down.svg?react', () => ({
  default: (props: any) => <svg data-testid="arrow-down-icon" {...props} />,
}));
vi.mock('@forethread/ui-components/assets/icons/chevron-down.svg?react', () => ({
  default: (props: any) => <svg data-testid="chevron-down-icon" {...props} />,
}));

interface TestRow {
  id: string;
  name: string;
  status: string;
}

const testColumns: ColumnDef<TestRow>[] = [
  { id: 'name', header: 'Name', accessor: 'name', sortable: true },
  { id: 'status', header: 'Status', accessor: 'status' },
];

const testData: TestRow[] = [
  { id: '1', name: 'Alice', status: 'ACTIVE' },
  { id: '2', name: 'Bob', status: 'INACTIVE' },
  { id: '3', name: 'Charlie', status: 'ACTIVE' },
];

const defaultProps = {
  columns: testColumns,
  data: testData,
  page: 1,
  pageSize: 25,
  totalCount: 3,
  onPageChange: vi.fn(),
  onPageSizeChange: vi.fn(),
};

describe('DataTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders all data rows', () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(<DataTable {...defaultProps} data={[]} totalCount={0} emptyMessage="No results" />);
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('shows empty state with description', () => {
    render(
      <DataTable
        {...defaultProps}
        data={[]}
        totalCount={0}
        emptyMessage="No results"
        emptyDescription="Try adjusting your filters"
      />,
    );
    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument();
  });

  it('shows skeleton rows when loading', () => {
    const { container } = render(<DataTable {...defaultProps} loading />);
    const skeletonCells = container.querySelectorAll('.animate-pulse');
    expect(skeletonCells.length).toBeGreaterThan(0);
  });

  it('does not render data rows when loading', () => {
    render(<DataTable {...defaultProps} loading />);
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('calls onSort when clicking a sortable column header', () => {
    const onSort = vi.fn();
    render(<DataTable {...defaultProps} onSort={onSort} />);
    fireEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith('name');
  });

  it('does not call onSort for non-sortable columns', () => {
    const onSort = vi.fn();
    render(<DataTable {...defaultProps} onSort={onSort} />);
    fireEvent.click(screen.getByText('Status'));
    expect(onSort).not.toHaveBeenCalled();
  });

  it('renders custom cell renderer', () => {
    const columnsWithCell: ColumnDef<TestRow>[] = [
      {
        id: 'name',
        header: 'Name',
        accessor: 'name',
        cell: (row) => <strong data-testid="custom-cell">{row.name}</strong>,
      },
    ];
    render(<DataTable {...defaultProps} columns={columnsWithCell} />);
    expect(screen.getAllByTestId('custom-cell')).toHaveLength(3);
  });

  it('renders accessor function values', () => {
    const columnsWithFn: ColumnDef<TestRow>[] = [
      {
        id: 'display',
        header: 'Display',
        accessor: (row) => `${row.name} - ${row.status}`,
      },
    ];
    render(<DataTable {...defaultProps} columns={columnsWithFn} />);
    expect(screen.getByText('Alice - ACTIVE')).toBeInTheDocument();
  });

  it('renders search bar when onSearchChange is provided', () => {
    render(
      <DataTable
        {...defaultProps}
        searchValue=""
        onSearchChange={vi.fn()}
        searchPlaceholder="Search items"
      />,
    );
    expect(screen.getByPlaceholderText('Search items')).toBeInTheDocument();
  });

  it('does not render search bar when onSearchChange is not provided', () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.queryByPlaceholderText('Search')).not.toBeInTheDocument();
  });

  it('renders quick filters when provided', () => {
    render(
      <DataTable
        {...defaultProps}
        quickFilters={[
          { label: 'All', value: 'all' },
          { label: 'Pending', value: 'pending' },
        ]}
        activeFilter="all"
        onFilterChange={vi.fn()}
      />,
    );
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders row action buttons when rowActions provided', () => {
    const onEdit = vi.fn();
    render(
      <DataTable
        {...defaultProps}
        rowActions={[
          {
            icon: <span data-testid="edit-icon">E</span>,
            label: 'Edit',
            onClick: onEdit,
          },
        ]}
      />,
    );
    // Actions column header
    expect(screen.getByText('Actions')).toBeInTheDocument();
    // One edit button per row
    const editButtons = screen.getAllByTitle('Edit');
    expect(editButtons).toHaveLength(3);
  });

  it('calls row action onClick with correct row', () => {
    const onEdit = vi.fn();
    render(
      <DataTable
        {...defaultProps}
        rowActions={[
          {
            icon: <span>E</span>,
            label: 'Edit',
            onClick: onEdit,
          },
        ]}
      />,
    );
    const editButtons = screen.getAllByTitle('Edit');
    fireEvent.click(editButtons[1]);
    expect(onEdit).toHaveBeenCalledWith(testData[1]);
  });

  it('renders checkboxes when selectable', () => {
    render(
      <DataTable
        {...defaultProps}
        selectable
        selectedIds={[]}
        onSelectionChange={vi.fn()}
        getRowId={(row) => row.id}
      />,
    );
    // Header checkbox + one per row = 4 checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(4);
  });

  it('calls onSelectionChange when selecting a row', () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        {...defaultProps}
        selectable
        selectedIds={[]}
        onSelectionChange={onSelectionChange}
        getRowId={(row) => row.id}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    // Click the first row checkbox (index 1, index 0 is header)
    fireEvent.click(checkboxes[1]);
    expect(onSelectionChange).toHaveBeenCalledWith(['1']);
  });

  it('calls onSelectionChange to deselect a row', () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        {...defaultProps}
        selectable
        selectedIds={['1', '2']}
        onSelectionChange={onSelectionChange}
        getRowId={(row) => row.id}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // Deselect row 1
    expect(onSelectionChange).toHaveBeenCalledWith(['2']);
  });

  it('select-all checkbox selects all rows on page', () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        {...defaultProps}
        selectable
        selectedIds={[]}
        onSelectionChange={onSelectionChange}
        getRowId={(row) => row.id}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Header checkbox
    expect(onSelectionChange).toHaveBeenCalledWith(['1', '2', '3']);
  });

  it('select-all checkbox deselects all when all are selected', () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        {...defaultProps}
        selectable
        selectedIds={['1', '2', '3']}
        onSelectionChange={onSelectionChange}
        getRowId={(row) => row.id}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // Header checkbox
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });
});

describe('DataTableSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with placeholder', () => {
    render(<DataTableSearch value="" onChange={vi.fn()} placeholder="Search here" />);
    expect(screen.getByPlaceholderText('Search here')).toBeInTheDocument();
  });

  it('debounces onChange by 300ms', () => {
    const onChange = vi.fn();
    render(<DataTableSearch value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText('Search');
    fireEvent.change(input, { target: { value: 'test' } });
    expect(onChange).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('cancels previous debounce on rapid typing', () => {
    const onChange = vi.fn();
    render(<DataTableSearch value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText('Search');
    fireEvent.change(input, { target: { value: 'te' } });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.change(input, { target: { value: 'test' } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('test');
  });
});

describe('DataTableQuickFilters', () => {
  const filters = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ];

  it('renders all filter buttons', () => {
    render(<DataTableQuickFilters filters={filters} onFilterChange={vi.fn()} />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('calls onFilterChange when a filter is clicked', () => {
    const onFilterChange = vi.fn();
    render(<DataTableQuickFilters filters={filters} onFilterChange={onFilterChange} />);
    fireEvent.click(screen.getByText('Active'));
    expect(onFilterChange).toHaveBeenCalledWith('active');
  });
});

describe('DataTableBulkActions', () => {
  it('renders nothing when selectedCount is 0', () => {
    const { container } = render(<DataTableBulkActions selectedCount={0} actions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders selected count and actions', () => {
    render(
      <DataTableBulkActions selectedCount={3} actions={[{ label: 'Delete', onClick: vi.fn() }]} />,
    );
    expect(screen.getByText('3 Items Selected')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('uses singular "Item" for count of 1', () => {
    render(
      <DataTableBulkActions selectedCount={1} actions={[{ label: 'Delete', onClick: vi.fn() }]} />,
    );
    expect(screen.getByText('1 Item Selected')).toBeInTheDocument();
  });

  it('calls action onClick when clicked', () => {
    const onClick = vi.fn();
    render(<DataTableBulkActions selectedCount={2} actions={[{ label: 'Delete', onClick }]} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(onClick).toHaveBeenCalled();
  });
});

describe('DataTableActions', () => {
  it('renders action buttons with titles', () => {
    const row = { id: '1', name: 'Test' };
    render(
      <DataTableActions
        row={row}
        actions={[
          { icon: <span>V</span>, label: 'View', onClick: vi.fn() },
          { icon: <span>E</span>, label: 'Edit', onClick: vi.fn() },
        ]}
      />,
    );
    expect(screen.getByTitle('View')).toBeInTheDocument();
    expect(screen.getByTitle('Edit')).toBeInTheDocument();
  });

  it('calls onClick with the row data', () => {
    const onClick = vi.fn();
    const row = { id: '1', name: 'Test' };
    render(
      <DataTableActions row={row} actions={[{ icon: <span>V</span>, label: 'View', onClick }]} />,
    );
    fireEvent.click(screen.getByTitle('View'));
    expect(onClick).toHaveBeenCalledWith(row);
  });
});
