import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/ui-components/assets/icons/edit.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <div />,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  TablePagination: () => <div data-testid="pagination" />,
  EmptyState: ({ title, illustration }: any) => (
    <div data-testid="empty-state">
      {illustration}
      {title}
    </div>
  ),
  EmptyBoxIllustration: () => <div data-testid="empty-box" />,
  SearchEmptyIllustration: () => <div data-testid="search-empty" />,
  DotActionsMenu: ({ actions }: any) => (
    <div data-testid="dot-actions">{actions.map((a: any) => a.key).join(',')}</div>
  ),
  FilterPopover: ({ label }: { label: string }) => <div data-testid="filter">{label}</div>,
  SortIcon: () => <span />,
  SearchInput: ({ value, onChange, placeholder }: any) => (
    <input data-testid="search" value={value} placeholder={placeholder} onChange={onChange} />
  ),
}));

vi.mock('../super-admin/ui/DateRangeFilterPopover', () => ({
  DateRangeFilterPopover: () => <div data-testid="date-filter" />,
}));

vi.mock('./userBadges', () => ({
  RoleBadge: ({ label }: { label: string }) => <span>{label}</span>,
  StatusBadge: ({ label }: { label: string }) => <span>{label}</span>,
}));

import { CompanyUsersTableView } from './CompanyUsersTableView';

const baseProps = {
  users: [],
  total: 0,
  isLoading: false,
  isError: false,
  hasActiveFilters: false,
  search: '',
  onSearchChange: vi.fn(),
  statusOptions: [],
  selectedStatuses: [],
  onStatusChange: vi.fn(),
  roleOptions: [],
  selectedRoles: [],
  onRoleChange: vi.fn(),
  dateFrom: '',
  dateTo: '',
  onDateFromChange: vi.fn(),
  onDateToChange: vi.fn(),
  onClearDates: vi.fn(),
  sortField: null,
  sortDir: null,
  onSort: vi.fn(),
  page: 1,
  pageSize: 25,
  pageSizeOptions: [10, 25, 50],
  onPageChange: vi.fn(),
  onPageSizeChange: vi.fn(),
  getRowActions: () => [{ key: 'deactivate', label: 'd', onClick: vi.fn() }],
  onView: vi.fn(),
  onEdit: vi.fn(),
} as any;

const user = {
  id: 'u1',
  name: 'John Doe',
  email: 'john@t.com',
  phone: '123',
  role: 'COMPANY_ADMIN',
  status: 'ACTIVE',
  createdAt: '2026-01-15T00:00:00Z',
};

describe('CompanyUsersTableView', () => {
  it('shows spinner when loading', () => {
    render(<CompanyUsersTableView {...baseProps} isLoading />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows error message on error', () => {
    render(<CompanyUsersTableView {...baseProps} isError />);
    expect(screen.getByText('failedToLoad')).toBeInTheDocument();
  });

  it('shows the empty box when there are no users and no filters', () => {
    render(<CompanyUsersTableView {...baseProps} total={0} />);
    expect(screen.getByTestId('empty-box')).toBeInTheDocument();
  });

  it('shows the search-empty illustration when filters are active but no results', () => {
    render(<CompanyUsersTableView {...baseProps} total={0} hasActiveFilters search="zzz" />);
    expect(screen.getByTestId('search-empty')).toBeInTheDocument();
  });

  it('renders rows and the total-users label', () => {
    render(<CompanyUsersTableView {...baseProps} users={[user]} total={1} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@t.com')).toBeInTheDocument();
    expect(screen.getByText('totalUsersLabel')).toBeInTheDocument();
  });

  it('uses the searching label when a search term is present', () => {
    render(<CompanyUsersTableView {...baseProps} users={[user]} total={1} search="jo" />);
    expect(screen.getByText('searchingResultLabel')).toBeInTheDocument();
  });

  it('uses the showing label when other filters are active', () => {
    render(<CompanyUsersTableView {...baseProps} users={[user]} total={1} hasActiveFilters />);
    expect(screen.getByText('showingUsersLabel')).toBeInTheDocument();
  });

  it('fires onSearchChange when typing', () => {
    const onSearchChange = vi.fn();
    render(<CompanyUsersTableView {...baseProps} onSearchChange={onSearchChange} />);
    fireEvent.change(screen.getByTestId('search'), { target: { value: 'abc' } });
    expect(onSearchChange).toHaveBeenCalledWith('abc');
  });

  it('fires onSort when a column header is clicked', () => {
    const onSort = vi.fn();
    render(<CompanyUsersTableView {...baseProps} users={[user]} total={1} onSort={onSort} />);
    fireEvent.click(screen.getByText('columns.fullName'));
    expect(onSort).toHaveBeenCalledWith('name');
  });

  it('fires onView and onEdit from the row buttons', () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    render(
      <CompanyUsersTableView
        {...baseProps}
        users={[user]}
        total={1}
        onView={onView}
        onEdit={onEdit}
      />,
    );
    fireEvent.click(screen.getByLabelText('View'));
    fireEvent.click(screen.getByLabelText('Edit'));
    expect(onView).toHaveBeenCalledWith('u1');
    expect(onEdit).toHaveBeenCalledWith('u1');
  });
});
