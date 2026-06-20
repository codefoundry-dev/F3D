import { render, screen, fireEvent } from '@testing-library/react';

const mockUseProject = vi.hoisted(() => vi.fn());
const mockUseCompanyUsers = vi.hoisted(() => vi.fn());
const mockUseAddProjectMembers = vi.hoisted(() => vi.fn());
const mockUseRemoveProjectMember = vi.hoisted(() => vi.fn());
const mockSetSearchParams = vi.hoisted(() => vi.fn());
const mockSetPageTitle = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: (s: any) => any) => selector({ setTitle: mockSetPageTitle }),
}));

const mockTabParam = vi.hoisted(() => ({ value: '' }));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'proj-1' }),
  useSearchParams: () => [
    new URLSearchParams(mockTabParam.value ? `tab=${mockTabParam.value}` : ''),
    mockSetSearchParams,
  ],
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

vi.mock('@forethread/shared-types/client', () => ({
  UserRole: { COMPANY_ADMIN: 'COMPANY_ADMIN', PROCUREMENT_OFFICER: 'PROCUREMENT_OFFICER' },
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
  Button: (props: any) => (
    <button onClick={props.onClick} disabled={props.disabled}>
      {props.children}
    </button>
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
  Modal: ({ children }: any) => <div data-testid="modal">{children}</div>,
  ConfirmDialog: (props: any) => (
    <div data-testid="confirm-dialog">
      <span>{props.title}</span>
      <span>{props.message}</span>
      <button onClick={props.onConfirm}>{props.confirmLabel}</button>
      <button onClick={props.onCancel}>{props.cancelLabel}</button>
    </div>
  ),
  AvatarWithStatus: ({ name }: any) => <span data-testid="avatar" title={name} />,
  EmptyState: (props: any) => (
    <div data-testid="empty-state">
      <span>{props.title}</span>
      <span>{props.description}</span>
    </div>
  ),
  DotActionsMenu: ({ actions }: any) => (
    <div data-testid="dot-menu">
      {actions.map((a: any) => (
        <button key={a.key} data-testid={`action-${a.key}`} onClick={a.onClick}>
          {a.label}
        </button>
      ))}
    </div>
  ),
  buttonVariants: () => 'btn-class',
}));

vi.mock('@forethread/ui-components/assets/icons/flag.svg?react', () => ({
  default: () => <span data-testid="flag-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/plus.svg?react', () => ({
  default: () => <span data-testid="plus-icon" />,
}));

vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ currentUser: { role: 'COMPANY_ADMIN', companyId: 'c1' } }),
}));

vi.mock('@/features/boms', () => ({
  BomTab: ({ projectId }: any) => <div data-testid="bom-tab">{projectId}</div>,
}));

vi.mock('../services/projects.service', () => ({
  useProject: mockUseProject,
  useAddProjectMembers: mockUseAddProjectMembers,
  useRemoveProjectMember: mockUseRemoveProjectMember,
  useCompanyUsers: mockUseCompanyUsers,
}));

import ProjectDetailPage from './ProjectDetailPage';

const mockProject = {
  id: 'proj-1',
  code: 'PRJ-2024-001',
  name: 'Alpha Project',
  description: 'Project description here',
  status: 'PLANNED',
  type: 'Residential',
  plannedBudget: 100000,
  usedBudget: 25000,
  currency: 'AUD',
  startDate: '2026-01-15T00:00:00Z',
  expectedEndDate: '2026-06-15T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  createdBy: { id: 'admin', name: 'Admin User' },
  pointOfContact: { id: 'poc', name: 'John Manager' },
  rfqCount: 3,
  poCount: 2,
  invoiceCount: 1,
  vendorCount: 5,
  assignedUsers: [
    {
      id: 'u1',
      name: 'Alice',
      email: 'alice@test.com',
      role: 'COMPANY_ADMIN',
      avatarUrl: null,
      phone: '+123 456',
      status: 'ACTIVE',
      workStatus: 'available',
      assignedAt: '2026-01-10T00:00:00Z',
    },
    {
      id: 'u2',
      name: 'Bob',
      email: 'bob@test.com',
      role: 'User',
      avatarUrl: null,
      phone: null,
      status: 'ACTIVE',
      workStatus: null,
      assignedAt: '2026-01-12T00:00:00Z',
    },
  ],
  locations: [
    { id: 'loc1', type: 'DELIVERY', address: '123 Main St', label: 'HQ', isDefault: true },
    { id: 'loc2', type: 'STORAGE', address: '456 Warehouse Rd', label: 'WH1', isDefault: true },
  ],
};

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTabParam.value = '';
    mockUseAddProjectMembers.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseRemoveProjectMember.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseCompanyUsers.mockReturnValue({ data: [] });
  });

  it('renders spinner when loading', () => {
    mockUseProject.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders not found on error', () => {
    mockUseProject.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<ProjectDetailPage />);
    expect(screen.getByText('detail.notFound')).toBeInTheDocument();
  });

  it('sets the page title with a back route on mount', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(mockSetPageTitle).toHaveBeenCalledWith('detail.title', null, '/projects');
  });

  it('renders the five Figma tabs', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('detail.tabs.details')).toBeInTheDocument();
    expect(screen.getByText('detail.tabs.bom')).toBeInTheDocument();
    expect(screen.getByText('detail.tabs.procurement')).toBeInTheDocument();
    expect(screen.getByText('detail.tabs.vendors')).toBeInTheDocument();
    expect(screen.getByText('detail.tabs.financials')).toBeInTheDocument();
  });

  it('does not render an in-page project-name header (moved into Basic Information)', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    // "Alpha Project" only appears once, as the Project Name field value.
    expect(screen.getAllByText('Alpha Project').length).toBe(1);
  });

  it('renders Basic Information fields on the details tab', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('detail.basicInformation')).toBeInTheDocument();
    expect(screen.getByText('PRJ-2024-001')).toBeInTheDocument();
    expect(screen.getByText('detail.projectId')).toBeInTheDocument();
    expect(screen.getByText('detail.budget')).toBeInTheDocument();
    expect(screen.getByText('detail.usedBudget')).toBeInTheDocument();
    expect(screen.getByText('detail.createdBy')).toBeInTheDocument();
  });

  it('renders the Edit project link for a company admin', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    const editLink = screen.getByText('detail.editProject');
    expect(editLink.closest('a')).toHaveAttribute('href', '/projects/proj-1/edit');
  });

  it('renders the assigned users and roles table with phone and status', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('detail.assignedUsersRoles')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('+123 456')).toBeInTheDocument();
    expect(screen.getByText('detail.memberColumns.phone')).toBeInTheDocument();
    expect(screen.getByText('detail.memberColumns.dateJoined')).toBeInTheDocument();
  });

  it('renders the Attached Documents empty state (no backend)', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('detail.attachedDocuments')).toBeInTheDocument();
    expect(screen.getByText('detail.noDocuments')).toBeInTheDocument();
  });

  it('renders location data with default markers', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
    expect(screen.getByText('456 Warehouse Rd')).toBeInTheDocument();
    const defaultBadges = screen.getAllByText('detail.defaultBadge');
    expect(defaultBadges.length).toBe(2);
  });

  it('switches to the BOM tab when clicked', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    fireEvent.click(screen.getByText('detail.tabs.bom'));
    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'bom' }, { replace: true });
  });

  it('renders the BOM tab content when tab param is bom', () => {
    mockTabParam.value = 'bom';
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByTestId('bom-tab')).toHaveTextContent('proj-1');
  });

  it('renders a coming-soon state on the procurement tab', () => {
    mockTabParam.value = 'procurement';
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('detail.comingSoon.procurement')).toBeInTheDocument();
  });

  it('renders a coming-soon state on the vendors tab', () => {
    mockTabParam.value = 'vendors';
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('detail.comingSoon.vendors')).toBeInTheDocument();
  });

  it('renders a coming-soon state on the financials tab', () => {
    mockTabParam.value = 'financials';
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('detail.comingSoon.financials')).toBeInTheDocument();
  });

  it('opens the add-members modal and lists available users', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    mockUseCompanyUsers.mockReturnValue({
      data: [
        { id: 'u1', name: 'Alice', email: 'alice@test.com' },
        { id: 'u3', name: 'Charlie', email: 'charlie@test.com' },
      ],
    });
    render(<ProjectDetailPage />);
    fireEvent.click(screen.getByText('detail.addMembers'));
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('Charlie (charlie@test.com)')).toBeInTheDocument();
  });

  it('opens the remove-member confirm dialog from the row kebab', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    fireEvent.click(screen.getAllByTestId('action-remove')[0]);
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('detail.confirmRemoveTitle')).toBeInTheDocument();
  });

  it('confirms member removal', () => {
    const mockMutate = vi.fn((_id: string, opts: any) => opts?.onSuccess?.());
    mockUseRemoveProjectMember.mockReturnValue({ mutate: mockMutate, isPending: false });
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    fireEvent.click(screen.getAllByTestId('action-remove')[0]);
    const dialog = screen.getByTestId('confirm-dialog');
    fireEvent.click(dialog.querySelector('button')!);
    expect(mockMutate).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('renders notSet for null optional fields', () => {
    const projectMinimal = {
      ...mockProject,
      type: null,
      plannedBudget: null,
      startDate: null,
      expectedEndDate: null,
      pointOfContact: null,
    };
    mockUseProject.mockReturnValue({ data: projectMinimal, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    const notSet = screen.getAllByText('detail.notSet');
    expect(notSet.length).toBeGreaterThanOrEqual(3);
  });
});
