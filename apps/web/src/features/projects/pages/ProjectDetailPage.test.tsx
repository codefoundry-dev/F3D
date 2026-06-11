import { render, screen, fireEvent } from '@testing-library/react';

const mockUseProject = vi.hoisted(() => vi.fn());
const mockUseCompanyUsers = vi.hoisted(() => vi.fn());
const mockUseAddProjectMembers = vi.hoisted(() => vi.fn());
const mockUseRemoveProjectMember = vi.hoisted(() => vi.fn());
const mockSetSearchParams = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
  buttonVariants: () => 'btn-class',
}));

vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ currentUser: { role: 'COMPANY_ADMIN', companyId: 'c1' } }),
}));

// BomTab has its own data dependencies (boms query, router navigation); the
// page test only cares that the tab mounts it.
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
  createdBy: { name: 'Admin User' },
  pointOfContact: { name: 'John Manager' },
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
      assignedAt: '2026-01-10T00:00:00Z',
    },
    {
      id: 'u2',
      name: 'Bob',
      email: 'bob@test.com',
      role: 'User',
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

  it('renders not found when error or no project', () => {
    mockUseProject.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<ProjectDetailPage />);
    expect(screen.getByText('detail.notFound')).toBeInTheDocument();
  });

  it('renders back to projects link on error', () => {
    mockUseProject.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<ProjectDetailPage />);
    const link = screen.getByText('detail.backToProjects');
    expect(link.closest('a')).toHaveAttribute('href', '/projects');
  });

  it('renders project name and description', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    expect(screen.getByText('Project description here')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByTestId('badge')).toBeInTheDocument();
    expect(screen.getByText('statuses.PLANNED')).toBeInTheDocument();
  });

  it('renders edit link for company admin', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    const editLink = screen.getByText('detail.editProject');
    expect(editLink.closest('a')).toHaveAttribute('href', '/projects/proj-1/edit');
  });

  it('renders all tabs', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('detail.overview')).toBeInTheDocument();
    expect(screen.getByText(/detail\.members/)).toBeInTheDocument();
    expect(screen.getByText('detail.billOfMaterials')).toBeInTheDocument();
    expect(screen.getByText('detail.procurementDocs')).toBeInTheDocument();
    expect(screen.getByText('detail.financialSummary')).toBeInTheDocument();
  });

  it('renders overview tab by default with project info', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('detail.type')).toBeInTheDocument();
    expect(screen.getByText('detail.budget')).toBeInTheDocument();
    expect(screen.getByText('detail.usedBudget')).toBeInTheDocument();
    expect(screen.getByText('detail.startDate')).toBeInTheDocument();
    expect(screen.getByText('detail.expectedEndDate')).toBeInTheDocument();
    expect(screen.getByText('detail.currency')).toBeInTheDocument();
    expect(screen.getByText('detail.pointOfContact')).toBeInTheDocument();
    expect(screen.getByText('detail.createdBy')).toBeInTheDocument();
    expect(screen.getByText('detail.createdAt')).toBeInTheDocument();
  });

  it('renders stat cards on overview tab', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('detail.rfqs')).toBeInTheDocument();
    expect(screen.getByText('detail.purchaseOrders')).toBeInTheDocument();
    expect(screen.getByText('detail.invoices')).toBeInTheDocument();
    expect(screen.getByText('detail.vendors')).toBeInTheDocument();
  });

  it('renders location data on overview tab', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('detail.deliveryLocations')).toBeInTheDocument();
    expect(screen.getByText('detail.storageLocations')).toBeInTheDocument();
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
    expect(screen.getByText('456 Warehouse Rd')).toBeInTheDocument();
  });

  it('renders location labels and default badges', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('(HQ)')).toBeInTheDocument();
    expect(screen.getByText('(WH1)')).toBeInTheDocument();
    const defaultBadges = screen.getAllByText('detail.defaultBadge');
    expect(defaultBadges.length).toBe(2);
  });

  it('renders point of contact and created by values', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('John Manager')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
  });

  it('renders stat values', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('switches to members tab when clicked', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    fireEvent.click(screen.getByText(/detail\.members/));
    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'members' }, { replace: true });
  });

  it('switches to bom tab when clicked', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    fireEvent.click(screen.getByText('detail.billOfMaterials'));
    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'bom' }, { replace: true });
  });

  it('renders project with no description gracefully', () => {
    const projectNoDesc = { ...mockProject, description: null };
    mockUseProject.mockReturnValue({ data: projectNoDesc, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    expect(screen.queryByText('Project description here')).not.toBeInTheDocument();
  });

  it('renders notSet for null optional fields', () => {
    const projectMinimal = {
      ...mockProject,
      type: null,
      plannedBudget: null,
      usedBudget: null,
      startDate: null,
      expectedEndDate: null,
      pointOfContact: null,
    };
    mockUseProject.mockReturnValue({ data: projectMinimal, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    const notSetElements = screen.getAllByText('detail.notSet');
    expect(notSetElements.length).toBeGreaterThanOrEqual(4);
  });

  it('switches to procurement tab when clicked', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    fireEvent.click(screen.getByText('detail.procurementDocs'));
    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'procurement' }, { replace: true });
  });

  it('switches to financial tab when clicked', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    fireEvent.click(screen.getByText('detail.financialSummary'));
    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'financial' }, { replace: true });
  });

  it('switches to overview tab when clicked', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    fireEvent.click(screen.getByText('detail.overview'));
    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'overview' }, { replace: true });
  });

  it('renders members tab content when tab param is members', () => {
    mockTabParam.value = 'members';
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('detail.addMembers')).toBeInTheDocument();
  });

  it('renders the BOM tab when tab param is bom', () => {
    mockTabParam.value = 'bom';
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByTestId('bom-tab')).toBeInTheDocument();
    expect(screen.getByTestId('bom-tab')).toHaveTextContent('proj-1');
  });

  it('renders procurement tab placeholder when tab param is procurement', () => {
    mockTabParam.value = 'procurement';
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('detail.procurementPlaceholder')).toBeInTheDocument();
  });

  it('renders financial tab placeholder when tab param is financial', () => {
    mockTabParam.value = 'financial';
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    expect(screen.getByText('detail.financialPlaceholder')).toBeInTheDocument();
  });

  it('opens add members modal and shows available users', () => {
    mockTabParam.value = 'members';
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

  it('closes add members modal when cancel is clicked', () => {
    mockTabParam.value = 'members';
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    mockUseCompanyUsers.mockReturnValue({ data: [] });
    render(<ProjectDetailPage />);
    fireEvent.click(screen.getByText('detail.addMembers'));
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('edit.cancel'));
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('opens remove confirm dialog when remove member is clicked', () => {
    mockTabParam.value = 'members';
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    const removeButtons = screen.getAllByText('detail.removeMember');
    fireEvent.click(removeButtons[0]);
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('detail.confirmRemoveTitle')).toBeInTheDocument();
  });

  it('confirms member removal', () => {
    mockTabParam.value = 'members';
    const mockMutate = vi.fn((_id: string, opts: any) => opts?.onSuccess?.());
    mockUseRemoveProjectMember.mockReturnValue({ mutate: mockMutate, isPending: false });
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    const removeButtons = screen.getAllByText('detail.removeMember');
    fireEvent.click(removeButtons[0]);
    const confirmDialog = screen.getByTestId('confirm-dialog');
    const confirmBtn = confirmDialog.querySelector('button');
    fireEvent.click(confirmBtn!);
    expect(mockMutate).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('cancels member removal dialog', () => {
    mockTabParam.value = 'members';
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    render(<ProjectDetailPage />);
    const removeButtons = screen.getAllByText('detail.removeMember');
    fireEvent.click(removeButtons[0]);
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByText('edit.cancel'));
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('shows no users available message when all users are already members', () => {
    mockTabParam.value = 'members';
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    mockUseCompanyUsers.mockReturnValue({
      data: [
        { id: 'u1', name: 'Alice', email: 'alice@test.com' },
        { id: 'u2', name: 'Bob', email: 'bob@test.com' },
      ],
    });
    render(<ProjectDetailPage />);
    fireEvent.click(screen.getByText('detail.addMembers'));
    expect(screen.getByText('detail.addMembersModal.noUsersAvailable')).toBeInTheDocument();
  });

  it('does not call mutate when add is clicked with no selections', () => {
    mockTabParam.value = 'members';
    const mockMutate = vi.fn();
    mockUseAddProjectMembers.mockReturnValue({ mutate: mockMutate, isPending: false });
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    mockUseCompanyUsers.mockReturnValue({
      data: [{ id: 'u3', name: 'Charlie', email: 'charlie@test.com' }],
    });
    render(<ProjectDetailPage />);
    fireEvent.click(screen.getByText('detail.addMembers'));
    fireEvent.click(screen.getByText('detail.addMembersModal.add'));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('can uncheck a selected user in add members modal', () => {
    mockTabParam.value = 'members';
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false, isError: false });
    mockUseCompanyUsers.mockReturnValue({
      data: [{ id: 'u3', name: 'Charlie', email: 'charlie@test.com' }],
    });
    render(<ProjectDetailPage />);
    fireEvent.click(screen.getByText('detail.addMembers'));
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });
});
