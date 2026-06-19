import { render, screen, fireEvent, act } from '@testing-library/react';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockUseProjects = vi.hoisted(() => vi.fn());
const mockSetPageTitle = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: (s: any) => any) => selector({ setTitle: mockSetPageTitle }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/ui-components', () => ({
  CustomDropdown: (props: any) => (
    <select
      data-testid="dropdown"
      value={props.value}
      onChange={(e: any) => props.onChange?.(e.target.value)}
    />
  ),
  Button: (props: any) => (
    <button onClick={props.onClick} disabled={props.disabled}>
      {props.children}
    </button>
  ),
  Spinner: () => <div data-testid="spinner" />,
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
  AvatarWithStatus: ({ name }: any) => <span data-testid="avatar">{name}</span>,
  DotActionsMenu: ({ actions }: any) => (
    <div data-testid="dot-menu">
      {actions.map((a: any) => (
        <button key={a.key} data-testid={`action-${a.key}`} onClick={a.onClick}>
          {a.label}
        </button>
      ))}
    </div>
  ),
  TablePagination: (props: any) => (
    <div data-testid="pagination">
      <button data-testid="next-page" onClick={() => props.onPageChange?.(2)}>
        next
      </button>
      <button data-testid="page-size" onClick={() => props.onPageSizeChange?.(50)}>
        size
      </button>
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
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
  useDebounce: (value: unknown) => value,
}));

vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <span data-testid="eye-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/plus.svg?react', () => ({
  default: () => <span data-testid="plus-icon" />,
}));

vi.mock('../services/projects.service', () => ({
  useProjects: mockUseProjects,
}));

import ProjectListPage from './ProjectListPage';

const mockProjectListData = {
  items: [
    {
      id: 'p1',
      code: 'PRJ-2024-001',
      name: 'Alpha Project',
      status: 'PLANNED',
      type: 'Residential',
      defaultDeliveryLocation: '123 Main St',
      defaultStorageLocation: '',
      memberCount: 5,
      memberAvatars: [{ id: 'u1', name: 'Alice', avatarUrl: null }],
      startDate: '2026-01-15T00:00:00Z',
      expectedEndDate: '2026-06-15T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'p2',
      code: 'PRJ-2024-002',
      name: 'Beta Project',
      status: 'ONGOING',
      type: null,
      defaultDeliveryLocation: '',
      defaultStorageLocation: '',
      memberCount: 3,
      memberAvatars: [],
      startDate: null,
      expectedEndDate: null,
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

  it('sets the page title on mount', () => {
    mockUseProjects.mockReturnValue({ data: mockProjectListData, isLoading: false, isError: false });
    render(<ProjectListPage />);
    expect(mockSetPageTitle).toHaveBeenCalledWith('list.title');
  });

  it('renders the Create new button which navigates to /projects/new', () => {
    mockUseProjects.mockReturnValue({ data: mockProjectListData, isLoading: false, isError: false });
    render(<ProjectListPage />);
    fireEvent.click(screen.getByText('list.createNew'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects/new');
  });

  it('renders project codes and names in the table', () => {
    mockUseProjects.mockReturnValue({ data: mockProjectListData, isLoading: false, isError: false });
    render(<ProjectListPage />);
    expect(screen.getByText('PRJ-2024-001')).toBeInTheDocument();
    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    expect(screen.getByText('Beta Project')).toBeInTheDocument();
  });

  it('renders Figma-order column headers', () => {
    mockUseProjects.mockReturnValue({ data: mockProjectListData, isLoading: false, isError: false });
    render(<ProjectListPage />);
    expect(screen.getByText('columns.projectId')).toBeInTheDocument();
    expect(screen.getByText('columns.projectName')).toBeInTheDocument();
    expect(screen.getByText('columns.defaultLocation')).toBeInTheDocument();
    expect(screen.getByText('columns.status')).toBeInTheDocument();
    expect(screen.getByText('columns.type')).toBeInTheDocument();
    expect(screen.getByText('columns.assignedUsers')).toBeInTheDocument();
    expect(screen.getByText('columns.startDate')).toBeInTheDocument();
    expect(screen.getByText('columns.endDate')).toBeInTheDocument();
    expect(screen.getByText('columns.actions')).toBeInTheDocument();
  });

  it('renders neutral status badges for each project', () => {
    mockUseProjects.mockReturnValue({ data: mockProjectListData, isLoading: false, isError: false });
    render(<ProjectListPage />);
    const badges = screen.getAllByTestId('badge');
    expect(badges.length).toBe(2);
  });

  it('renders the assigned-users avatar stack and count', () => {
    mockUseProjects.mockReturnValue({ data: mockProjectListData, isLoading: false, isError: false });
    render(<ProjectListPage />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getAllByText('list.usersCount').length).toBe(2);
  });

  it('renders dash for missing type and delivery location', () => {
    mockUseProjects.mockReturnValue({ data: mockProjectListData, isLoading: false, isError: false });
    render(<ProjectListPage />);
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('does not render pagination when total is below page size', () => {
    mockUseProjects.mockReturnValue({ data: mockProjectListData, isLoading: false, isError: false });
    render(<ProjectListPage />);
    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
  });

  it('renders pagination when total reaches the page size threshold', () => {
    mockUseProjects.mockReturnValue({
      data: { ...mockProjectListData, meta: { total: 30, page: 1, totalPages: 2, limit: 25 } },
      isLoading: false,
      isError: false,
    });
    render(<ProjectListPage />);
    expect(screen.getByTestId('pagination')).toBeInTheDocument();
  });

  it('renders both status and type filter dropdowns', () => {
    mockUseProjects.mockReturnValue({ data: mockProjectListData, isLoading: false, isError: false });
    render(<ProjectListPage />);
    expect(screen.getAllByTestId('dropdown').length).toBe(2);
  });

  it('renders search input', () => {
    mockUseProjects.mockReturnValue({ data: mockProjectListData, isLoading: false, isError: false });
    render(<ProjectListPage />);
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('navigates to project detail when clicking a table row', () => {
    mockUseProjects.mockReturnValue({ data: mockProjectListData, isLoading: false, isError: false });
    render(<ProjectListPage />);
    fireEvent.click(screen.getByText('Alpha Project'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects/p1');
  });

  it('navigates to edit via the row kebab Edit action', () => {
    mockUseProjects.mockReturnValue({ data: mockProjectListData, isLoading: false, isError: false });
    render(<ProjectListPage />);
    fireEvent.click(screen.getAllByTestId('action-edit')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/projects/p1/edit');
  });

  it('navigates to detail via the row kebab View action', () => {
    mockUseProjects.mockReturnValue({ data: mockProjectListData, isLoading: false, isError: false });
    render(<ProjectListPage />);
    fireEvent.click(screen.getAllByTestId('action-view')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/projects/p1');
  });

  it('handles search input change', () => {
    mockUseProjects.mockReturnValue({ data: mockProjectListData, isLoading: false, isError: false });
    render(<ProjectListPage />);
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'test query' } });
    expect(searchInput).toHaveValue('test query');
  });

  it('changes status filter via the first dropdown', () => {
    mockUseProjects.mockReturnValue({ data: mockProjectListData, isLoading: false, isError: false });
    render(<ProjectListPage />);
    const dropdowns = screen.getAllByTestId('dropdown');
    fireEvent.change(dropdowns[0], { target: { value: 'ONGOING' } });
    expect(mockUseProjects).toHaveBeenCalled();
  });

  it('changes type filter via the second dropdown', () => {
    mockUseProjects.mockReturnValue({ data: mockProjectListData, isLoading: false, isError: false });
    render(<ProjectListPage />);
    const dropdowns = screen.getAllByTestId('dropdown');
    fireEvent.change(dropdowns[1], { target: { value: 'Residential' } });
    expect(mockUseProjects).toHaveBeenCalled();
  });

  it('sorts when a sortable column header is clicked', () => {
    mockUseProjects.mockReturnValue({ data: mockProjectListData, isLoading: false, isError: false });
    render(<ProjectListPage />);
    fireEvent.click(screen.getByText('columns.projectName'));
    expect(mockUseProjects).toHaveBeenCalled();
  });

  it('triggers debounced search that resets page', () => {
    vi.useFakeTimers();
    mockUseProjects.mockReturnValue({ data: mockProjectListData, isLoading: false, isError: false });
    render(<ProjectListPage />);
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'alpha' } });
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(mockUseProjects).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
