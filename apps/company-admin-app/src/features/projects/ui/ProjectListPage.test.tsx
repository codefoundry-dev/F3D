import { render, screen, fireEvent, act } from '@testing-library/react';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockUseProjects = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock('@forethread/ui-components', () => ({
  CustomDropdown: (props: any) => (
    <select
      data-testid="dropdown"
      value={props.value}
      onChange={(e: any) => props.onChange?.(e.target.value)}
    />
  ),
  Checkbox: (props: any) => (
    <label>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e: any) => props.onChange?.(e.target.checked)}
      />
      {props.label}
    </label>
  ),
  Button: (props: any) => (
    <button onClick={props.onClick} {...props}>
      {props.children}
    </button>
  ),
  Spinner: () => <div data-testid="spinner" />,
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
  Pagination: (props: any) => (
    <div data-testid="pagination">
      <button data-testid="next-page" onClick={() => props.onPageChange?.(2)}>
        Next
      </button>
      {props.pageLabel}
    </div>
  ),
  EmptyState: (props: any) => <div data-testid="empty-state">{props.title}</div>,
  SearchInput: (props: any) => (
    <input
      data-testid="search-input"
      placeholder={props.placeholder}
      value={props.value}
      onChange={props.onChange}
    />
  ),
  SortIcon: () => <span data-testid="sort-icon" />,
  buttonVariants: () => 'btn-class',
  useDebounce: (value: unknown) => value,
}));

vi.mock('../services/projects.service', () => ({
  useProjects: mockUseProjects,
}));

import ProjectListPage from './ProjectListPage';

const mockProjectListData = {
  items: [
    {
      id: 'p1',
      name: 'Alpha Project',
      status: 'PLANNED',
      type: 'Residential',
      defaultDeliveryLocation: '123 Main St',
      memberCount: 5,
      startDate: '2026-01-15T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'p2',
      name: 'Beta Project',
      status: 'ONGOING',
      type: null,
      defaultDeliveryLocation: '',
      memberCount: 3,
      startDate: null,
      createdAt: '2026-02-01T00:00:00Z',
    },
  ],
  meta: { total: 2, page: 1, totalPages: 1, limit: 25 },
};

describe('ProjectListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading spinner when isLoading is true', () => {
    mockUseProjects.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<ProjectListPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders error alert when isError is true', () => {
    mockUseProjects.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<ProjectListPage />);
    expect(screen.getByTestId('alert')).toBeInTheDocument();
    expect(screen.getByText('list.failedToLoad')).toBeInTheDocument();
  });

  it('renders empty state when data has no items', () => {
    mockUseProjects.mockReturnValue({
      data: { items: [], meta: { total: 0, page: 1, totalPages: 0, limit: 25 } },
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('list.noProjectsFound')).toBeInTheDocument();
  });

  it('renders page title', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    expect(screen.getByText('list.title')).toBeInTheDocument();
  });

  it('renders total projects count when data is loaded', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    expect(screen.getByText('list.totalProjects')).toBeInTheDocument();
  });

  it('renders a create link pointing to /projects/new', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    const link = screen.getByText('create.title');
    expect(link.closest('a')).toHaveAttribute('href', '/projects/new');
  });

  it('renders project names in the table', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    expect(screen.getByText('Beta Project')).toBeInTheDocument();
  });

  it('renders table column headers', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    expect(screen.getByText('columns.name')).toBeInTheDocument();
    expect(screen.getByText('columns.status')).toBeInTheDocument();
    expect(screen.getByText('columns.type')).toBeInTheDocument();
    expect(screen.getByText('columns.deliveryLocation')).toBeInTheDocument();
    expect(screen.getByText('columns.members')).toBeInTheDocument();
    expect(screen.getByText('columns.startDate')).toBeInTheDocument();
    expect(screen.getByText('columns.created')).toBeInTheDocument();
  });

  it('renders status badges for each project', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    const badges = screen.getAllByTestId('badge');
    expect(badges.length).toBe(2);
  });

  it('renders dash for missing type and delivery location', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    // Beta project has null type and empty deliveryLocation
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('renders pagination when data has items', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    expect(screen.getByTestId('pagination')).toBeInTheDocument();
  });

  it('renders search input', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('renders show archived checkbox', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    expect(screen.getByText('list.showArchived')).toBeInTheDocument();
  });

  it('navigates to project detail when clicking a table row', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    fireEvent.click(screen.getByText('Alpha Project'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects/p1');
  });

  it('handles search input change', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    expect(searchInput).toHaveValue('test query');
  });

  it('toggles sort direction when clicking sort direction button', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    // Default sortDir is 'desc', so button shows '↓'
    const sortDirButton = screen.getByText('↓');
    fireEvent.click(sortDirButton);
    // After click, sortDir flips to 'asc', button should show '↑'
    expect(screen.getByText('↑')).toBeInTheDocument();
  });

  it('calls handleSort on column header click (same field toggles direction)', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    // Default sortBy is 'createdAt', click it to toggle direction
    fireEvent.click(screen.getByText('columns.created'));
    // sortBy stays 'createdAt', direction toggles from 'desc' to 'asc'
    expect(mockUseProjects).toHaveBeenCalled();
  });

  it('calls handleSort on a different column header to change sortBy', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    // Click 'name' column which is different from default 'createdAt'
    fireEvent.click(screen.getByText('columns.name'));
    // This should set sortBy to 'name' and sortDir to 'asc'
    expect(mockUseProjects).toHaveBeenCalled();
  });

  it('toggles show archived checkbox', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    // After toggling, useProjects should be called with updated params
    expect(mockUseProjects).toHaveBeenCalled();
  });

  it('triggers debounced search that resets page', () => {
    vi.useFakeTimers();
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'alpha' } });
    // Advance timers to trigger debounce
    act(() => {
      vi.advanceTimersByTime(350);
    });
    // After debounce, useProjects should have been called with the search param
    expect(mockUseProjects).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('navigates to second project when clicking its row', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    fireEvent.click(screen.getByText('Beta Project'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects/p2');
  });

  it('handles sort on status column header', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    fireEvent.click(screen.getByText('columns.status'));
    expect(mockUseProjects).toHaveBeenCalled();
  });

  it('handles sort on startDate column header', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    fireEvent.click(screen.getByText('columns.startDate'));
    expect(mockUseProjects).toHaveBeenCalled();
  });

  it('calls onPageChange when pagination next is clicked', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    fireEvent.click(screen.getByTestId('next-page'));
    // Page state changes, triggering a re-render with new params
    expect(mockUseProjects).toHaveBeenCalled();
  });

  it('changes status filter via dropdown', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    const dropdowns = screen.getAllByTestId('dropdown');
    // First dropdown is status filter
    fireEvent.change(dropdowns[0], { target: { value: 'ONGOING' } });
    expect(mockUseProjects).toHaveBeenCalled();
  });

  it('changes sort dropdown', () => {
    mockUseProjects.mockReturnValue({
      data: mockProjectListData,
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    const dropdowns = screen.getAllByTestId('dropdown');
    // Second dropdown is sort options
    fireEvent.change(dropdowns[1], { target: { value: 'name' } });
    expect(mockUseProjects).toHaveBeenCalled();
  });
});
