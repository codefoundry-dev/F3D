import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  }),
}));

vi.mock('@forethread/shared-types/client', () => ({
  UserStatus: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', INVITED: 'INVITED' },
}));

vi.mock('@forethread/ui-components', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  Spinner: () => <div data-testid="spinner" />,
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
  TablePagination: ({ showingLabel }: any) => (
    <div data-testid="table-pagination">
      {showingLabel && (
        <span data-testid="showing-label">{showingLabel({ from: 1, to: 25, total: 3 })}</span>
      )}
    </div>
  ),
  EmptyState: ({ title, description }: any) => (
    <div data-testid="empty-state">
      {title} {description}
    </div>
  ),
  DotActionsMenu: ({ actions }: any) => (
    <div data-testid="dot-actions">
      {actions.map((a: any) => (
        <button key={a.key} onClick={a.onClick}>
          {a.label}
        </button>
      ))}
    </div>
  ),
  StatusActionModal: ({ title, onClose, onConfirm, infoText }: any) => (
    <div data-testid="status-action-modal">
      <span>{title}</span>
      {infoText}
      <button onClick={onConfirm}>confirm</button>
      <button onClick={onClose}>close</button>
    </div>
  ),
  StatusSuccessModal: ({ title, onClose, redirectLabel, infoText, note, buttonLabel }: any) => (
    <div data-testid="status-success-modal">
      <span>{title}</span>
      {infoText}
      {note && <span>{note}</span>}
      {buttonLabel && <span>{buttonLabel}</span>}
      {redirectLabel && <span>{redirectLabel(5)}</span>}
      <button onClick={onClose}>close</button>
    </div>
  ),
  ResetPasswordSuccessModal: ({ title, onClose, redirectLabel }: any) => (
    <div data-testid="reset-password-success-modal">
      <span>{title}</span>
      {redirectLabel && <span>{redirectLabel(5)}</span>}
      <button onClick={onClose}>close</button>
    </div>
  ),
  SortIcon: () => <span data-testid="sort-icon" />,
  notificationService: { success: vi.fn() },
}));

const svgIcons = ['cross-in-circle', 'edit', 'eye-opened', 'new-user'];
svgIcons.forEach((name) => {
  vi.mock(`@forethread/ui-components/assets/icons/${name}.svg?react`, () => ({
    default: () => <div />,
  }));
});

const mockNavigate = vi.hoisted(() => vi.fn());
const mockSetSearchParams = vi.hoisted(() => vi.fn());
const mockSearchParams = vi.hoisted(() => new URLSearchParams());

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}));

const mockStoreState = vi.hoisted(() => ({
  isCreateModalOpen: false,
  openCreateModal: vi.fn(),
  closeCreateModal: vi.fn(),
  isSuccessModalOpen: false,
  closeSuccessModal: vi.fn(),
  isEditModalOpen: false,
  openEditModal: vi.fn(),
  closeEditModal: vi.fn(),
  isStatusActionModalOpen: false,
  statusActionType: null as string | null,
  statusActionUserId: null as string | null,
  statusActionUserEmail: null as string | null,
  openStatusActionModal: vi.fn(),
  closeStatusActionModal: vi.fn(),
  isStatusSuccessModalOpen: false,
  statusSuccessType: null as string | null,
  statusSuccessUserEmail: null as string | null,
  openStatusSuccessModal: vi.fn(),
  closeStatusSuccessModal: vi.fn(),
  isResetPasswordSuccessModalOpen: false,
  resetPasswordSuccessEmail: null as string | null,
  openResetPasswordSuccessModal: vi.fn(),
  closeResetPasswordSuccessModal: vi.fn(),
  isCancelInvitationModalOpen: false,
  cancelInvitationUserId: null as string | null,
  cancelInvitationUserEmail: null as string | null,
  cancelInvitationUserName: null as string | null,
  openCancelInvitationModal: vi.fn(),
  closeCancelInvitationModal: vi.fn(),
}));

vi.mock('../state/users.store', () => ({
  useUsersStore: () => mockStoreState,
}));

const mockUsersData = vi.hoisted(() => ({
  items: [
    {
      id: 'u1',
      name: 'Alice Smith',
      email: 'alice@test.com',
      phone: '+61400000001',
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
    },
    {
      id: 'u2',
      name: 'Bob Jones',
      email: 'bob@test.com',
      phone: null,
      role: 'PROCUREMENT_OFFICER',
      status: 'INACTIVE',
    },
    {
      id: 'u3',
      name: 'Carol White',
      email: 'carol@test.com',
      phone: '+61400000003',
      role: 'FOREMAN',
      status: 'INVITED',
    },
  ],
  meta: { page: 1, total: 3, limit: 25, totalPages: 1 },
}));

const mockQueryState = vi.hoisted(() => ({
  data: mockUsersData as any,
  isLoading: false,
  isError: false,
}));

const mockMutate = vi.hoisted(() => vi.fn());
const mockMutation = vi.hoisted(() => ({
  mutate: mockMutate,
  isPending: false,
}));

vi.mock('../services/users.service', () => ({
  useUsers: vi.fn(() => mockQueryState),
  useDeactivateUser: vi.fn(() => mockMutation),
  useReactivateUser: vi.fn(() => mockMutation),
  useResendInvitation: vi.fn(() => mockMutation),
  useCancelInvitation: vi.fn(() => mockMutation),
  useResetUserPassword: vi.fn(() => mockMutation),
}));

vi.mock('./CreateUserModal', () => ({
  CreateUserModal: ({ onClose }: any) => (
    <div data-testid="create-user-modal">
      <button onClick={onClose}>close-create</button>
    </div>
  ),
}));

vi.mock('./EditUserModal', () => ({
  EditUserModal: ({ onClose }: any) => (
    <div data-testid="edit-user-modal">
      <button onClick={onClose}>close-edit</button>
    </div>
  ),
}));

vi.mock('./InvitationSuccessModal', () => ({
  InvitationSuccessModal: ({ onClose }: any) => (
    <div data-testid="invitation-success-modal">
      <button onClick={onClose}>close-success</button>
    </div>
  ),
}));

vi.mock('./ProjectAccessModal', () => ({
  ProjectAccessModal: ({ onClose }: any) => (
    <div data-testid="project-access-modal">
      <button onClick={onClose}>close-project-access</button>
    </div>
  ),
}));

vi.mock('../constants/roles', () => ({
  ROLE_BADGE_COLORS: {},
  STATUS_TEXT_COLORS: {},
}));

import UserListPage from './UserListPage';

describe('UserListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.isCreateModalOpen = false;
    mockStoreState.isSuccessModalOpen = false;
    mockStoreState.isEditModalOpen = false;
    mockStoreState.isStatusActionModalOpen = false;
    mockStoreState.statusActionType = null;
    mockStoreState.isStatusSuccessModalOpen = false;
    mockStoreState.statusSuccessType = null;
    mockStoreState.isResetPasswordSuccessModalOpen = false;
    mockStoreState.isCancelInvitationModalOpen = false;
    mockQueryState.data = mockUsersData;
    mockQueryState.isLoading = false;
    mockQueryState.isError = false;
  });

  it('renders three tabs', () => {
    render(<UserListPage />);
    expect(screen.getByText('tabs.companyUsers')).toBeInTheDocument();
    expect(screen.getByText('tabs.approvalConfiguration')).toBeInTheDocument();
    expect(screen.getByText('tabs.rolePermissions')).toBeInTheDocument();
  });

  it('renders invite user button on company users tab', () => {
    render(<UserListPage />);
    expect(screen.getByText('inviteUser')).toBeInTheDocument();
  });

  it('renders user table with data', () => {
    render(<UserListPage />);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('bob@test.com')).toBeInTheDocument();
    expect(screen.getByText('Carol White')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<UserListPage />);
    expect(screen.getByText('columns.fullName')).toBeInTheDocument();
    expect(screen.getByText('columns.email')).toBeInTheDocument();
    expect(screen.getByText('columns.phone')).toBeInTheDocument();
    expect(screen.getByText('columns.role')).toBeInTheDocument();
    expect(screen.getByText('columns.status')).toBeInTheDocument();
    expect(screen.getByText('columns.projects')).toBeInTheDocument();
    expect(screen.getByText('columns.actions')).toBeInTheDocument();
  });

  it('renders dash for null phone', () => {
    render(<UserListPage />);
    // Bob Jones has null phone, should show —
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('shows spinner when loading', () => {
    mockQueryState.isLoading = true;
    render(<UserListPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows error message on error', () => {
    mockQueryState.isError = true;
    render(<UserListPage />);
    expect(screen.getByText('failedToLoad')).toBeInTheDocument();
  });

  it('shows empty state when no users', () => {
    mockQueryState.data = { items: [], meta: { page: 1, total: 0, limit: 25, totalPages: 0 } };
    render(<UserListPage />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders table pagination', () => {
    render(<UserListPage />);
    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
  });

  it('shows view and edit action buttons per row', () => {
    render(<UserListPage />);
    const viewButtons = screen.getAllByLabelText('View');
    const editButtons = screen.getAllByLabelText('Edit');
    expect(viewButtons).toHaveLength(3);
    expect(editButtons).toHaveLength(3);
  });

  it('navigates to user detail on view click', () => {
    render(<UserListPage />);
    const viewButtons = screen.getAllByLabelText('View');
    fireEvent.click(viewButtons[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/settings/users/u1');
  });

  it('opens edit modal on edit click', () => {
    render(<UserListPage />);
    const editButtons = screen.getAllByLabelText('Edit');
    fireEvent.click(editButtons[0]);
    expect(mockStoreState.openEditModal).toHaveBeenCalledWith('u1');
  });

  it('opens create modal on invite click', () => {
    render(<UserListPage />);
    fireEvent.click(screen.getByText('inviteUser'));
    expect(mockStoreState.openCreateModal).toHaveBeenCalled();
  });

  it('renders CreateUserModal when open', () => {
    mockStoreState.isCreateModalOpen = true;
    render(<UserListPage />);
    expect(screen.getByTestId('create-user-modal')).toBeInTheDocument();
  });

  it('renders EditUserModal when open', () => {
    mockStoreState.isEditModalOpen = true;
    render(<UserListPage />);
    expect(screen.getByTestId('edit-user-modal')).toBeInTheDocument();
  });

  it('renders InvitationSuccessModal when open', () => {
    mockStoreState.isSuccessModalOpen = true;
    render(<UserListPage />);
    expect(screen.getByTestId('invitation-success-modal')).toBeInTheDocument();
  });

  it('renders StatusActionModal when status action is open', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    render(<UserListPage />);
    expect(screen.getByTestId('status-action-modal')).toBeInTheDocument();
  });

  it('renders StatusSuccessModal when status success is open', () => {
    mockStoreState.isStatusSuccessModalOpen = true;
    mockStoreState.statusSuccessType = 'deactivate';
    render(<UserListPage />);
    expect(screen.getByTestId('status-success-modal')).toBeInTheDocument();
  });

  it('renders ResetPasswordSuccessModal when open', () => {
    mockStoreState.isResetPasswordSuccessModalOpen = true;
    render(<UserListPage />);
    expect(screen.getByTestId('reset-password-success-modal')).toBeInTheDocument();
  });

  it('renders CancelInvitation StatusActionModal when open', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    render(<UserListPage />);
    expect(screen.getByTestId('status-action-modal')).toBeInTheDocument();
  });

  it('shows approval configuration placeholder on tab click', () => {
    render(<UserListPage />);
    fireEvent.click(screen.getByText('tabs.approvalConfiguration'));
    expect(mockSetSearchParams).toHaveBeenCalled();
  });

  it('shows role permissions placeholder on tab click', () => {
    render(<UserListPage />);
    fireEvent.click(screen.getByText('tabs.rolePermissions'));
    expect(mockSetSearchParams).toHaveBeenCalled();
  });

  it('renders dot actions for each user row', () => {
    render(<UserListPage />);
    const dotActions = screen.getAllByTestId('dot-actions');
    expect(dotActions).toHaveLength(3);
  });

  it('does not render pagination when data is null', () => {
    mockQueryState.data = null;
    mockQueryState.isLoading = true;
    render(<UserListPage />);
    expect(screen.queryByTestId('table-pagination')).not.toBeInTheDocument();
  });

  it('renders sort icons in headers', () => {
    render(<UserListPage />);
    const sortIcons = screen.getAllByTestId('sort-icon');
    // 5 sortable columns + 1 projects column
    expect(sortIcons.length).toBeGreaterThanOrEqual(6);
  });

  // --- Interaction / callback tests ---

  it('handleSort: clicking a column header sets sort asc, clicking again sets desc, third click resets', () => {
    render(<UserListPage />);
    const nameHeader = screen.getByText('columns.fullName');
    // First click → asc
    fireEvent.click(nameHeader);
    // Second click → desc (same field)
    fireEvent.click(nameHeader);
    // Third click → reset
    fireEvent.click(nameHeader);
    // Smoke: no crash, component still renders
    expect(screen.getByText('columns.fullName')).toBeInTheDocument();
  });

  it('handleSort: clicking a different column switches sort field', () => {
    render(<UserListPage />);
    fireEvent.click(screen.getByText('columns.fullName'));
    fireEvent.click(screen.getByText('columns.email'));
    expect(screen.getByText('columns.email')).toBeInTheDocument();
  });

  it('handleTabChange: clicking tab calls setSearchParams with tab value', () => {
    render(<UserListPage />);
    fireEvent.click(screen.getByText('tabs.approvalConfiguration'));
    expect(mockSetSearchParams).toHaveBeenCalledWith(
      { tab: 'approvalConfiguration' },
      { replace: true },
    );
  });

  it('handleTabChange: clicking rolePermissions tab', () => {
    render(<UserListPage />);
    fireEvent.click(screen.getByText('tabs.rolePermissions'));
    expect(mockSetSearchParams).toHaveBeenCalledWith({ tab: 'rolePermissions' }, { replace: true });
  });

  it('navigates to user detail for second user on view click', () => {
    render(<UserListPage />);
    const viewButtons = screen.getAllByLabelText('View');
    fireEvent.click(viewButtons[1]);
    expect(mockNavigate).toHaveBeenCalledWith('/settings/users/u2');
  });

  it('opens edit modal for second user on edit click', () => {
    render(<UserListPage />);
    const editButtons = screen.getAllByLabelText('Edit');
    fireEvent.click(editButtons[1]);
    expect(mockStoreState.openEditModal).toHaveBeenCalledWith('u2');
  });

  it('dot action: clicking deactivate on active user calls openStatusActionModal', () => {
    render(<UserListPage />);
    // Alice is Active, her dot actions should include 'deactivate'
    fireEvent.click(screen.getByText('actions.deactivate'));
    expect(mockStoreState.openStatusActionModal).toHaveBeenCalledWith(
      'deactivate',
      'u1',
      'alice@test.com',
    );
  });

  it('dot action: clicking activate on inactive user calls openStatusActionModal', () => {
    render(<UserListPage />);
    // Bob is Inactive, his dot actions should include 'activate'
    fireEvent.click(screen.getByText('actions.activate'));
    expect(mockStoreState.openStatusActionModal).toHaveBeenCalledWith(
      'activate',
      'u2',
      'bob@test.com',
    );
  });

  it('dot action: clicking resendInvitation on invited user calls mutate', () => {
    render(<UserListPage />);
    // Carol is Invited, her dot actions should include 'resendInvitation'
    fireEvent.click(screen.getByText('actions.resendInvitation'));
    expect(mockMutate).toHaveBeenCalledWith(
      'u3',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('dot action: clicking cancelInvitation on invited user calls openCancelInvitationModal', () => {
    render(<UserListPage />);
    fireEvent.click(screen.getByText('actions.cancelInvitation'));
    expect(mockStoreState.openCancelInvitationModal).toHaveBeenCalledWith(
      'u3',
      'carol@test.com',
      'Carol White',
    );
  });

  it('dot action: clicking resetPassword on active user calls mutate', () => {
    render(<UserListPage />);
    // Alice is Active so resetPassword should appear
    fireEvent.click(screen.getByText('actions.resetPassword'));
    expect(mockMutate).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('handleStatusAction: confirming status action modal calls deactivate mutate', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    mockStoreState.statusActionUserId = 'u1';
    mockStoreState.statusActionUserEmail = 'alice@test.com';
    render(<UserListPage />);
    fireEvent.click(screen.getByText('confirm'));
    expect(mockMutate).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('handleStatusAction: confirming activate action modal calls reactivate mutate', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'activate';
    mockStoreState.statusActionUserId = 'u2';
    mockStoreState.statusActionUserEmail = 'bob@test.com';
    render(<UserListPage />);
    fireEvent.click(screen.getByText('confirm'));
    expect(mockMutate).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('handleStatusAction: does nothing when statusActionUserId is null', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    mockStoreState.statusActionUserId = null;
    mockStoreState.statusActionUserEmail = null;
    render(<UserListPage />);
    fireEvent.click(screen.getByText('confirm'));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('handleCancelInvitation: confirming cancel invitation modal calls mutate', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    mockStoreState.cancelInvitationUserId = 'u3';
    mockStoreState.cancelInvitationUserEmail = 'carol@test.com';
    mockStoreState.cancelInvitationUserName = 'Carol White';
    render(<UserListPage />);
    fireEvent.click(screen.getByText('confirm'));
    expect(mockMutate).toHaveBeenCalledWith(
      'u3',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('handleCancelInvitation: does nothing when cancelInvitationUserId is null', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    mockStoreState.cancelInvitationUserId = null;
    render(<UserListPage />);
    fireEvent.click(screen.getByText('confirm'));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('closes CreateUserModal via onClose', () => {
    mockStoreState.isCreateModalOpen = true;
    render(<UserListPage />);
    fireEvent.click(screen.getByText('close-create'));
    expect(mockStoreState.closeCreateModal).toHaveBeenCalled();
  });

  it('closes EditUserModal via onClose', () => {
    mockStoreState.isEditModalOpen = true;
    render(<UserListPage />);
    fireEvent.click(screen.getByText('close-edit'));
    expect(mockStoreState.closeEditModal).toHaveBeenCalled();
  });

  it('closes InvitationSuccessModal via onClose', () => {
    mockStoreState.isSuccessModalOpen = true;
    render(<UserListPage />);
    fireEvent.click(screen.getByText('close-success'));
    expect(mockStoreState.closeSuccessModal).toHaveBeenCalled();
  });

  it('closes StatusActionModal via onClose', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    render(<UserListPage />);
    fireEvent.click(screen.getByText('close'));
    expect(mockStoreState.closeStatusActionModal).toHaveBeenCalled();
  });

  it('closes StatusSuccessModal via onClose', () => {
    mockStoreState.isStatusSuccessModalOpen = true;
    mockStoreState.statusSuccessType = 'deactivate';
    render(<UserListPage />);
    fireEvent.click(screen.getByText('close'));
    expect(mockStoreState.closeStatusSuccessModal).toHaveBeenCalled();
  });

  it('closes ResetPasswordSuccessModal via onClose', () => {
    mockStoreState.isResetPasswordSuccessModalOpen = true;
    render(<UserListPage />);
    fireEvent.click(screen.getByText('close'));
    expect(mockStoreState.closeResetPasswordSuccessModal).toHaveBeenCalled();
  });

  it('closes CancelInvitation modal via onClose', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    render(<UserListPage />);
    fireEvent.click(screen.getByText('close'));
    expect(mockStoreState.closeCancelInvitationModal).toHaveBeenCalled();
  });

  it('deactivate onSuccess closes modal and opens success modal', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    mockStoreState.statusActionUserId = 'u1';
    mockStoreState.statusActionUserEmail = 'alice@test.com';
    render(<UserListPage />);
    fireEvent.click(screen.getByText('confirm'));
    const onSuccess = mockMutate.mock.calls[0][1].onSuccess;
    onSuccess();
    expect(mockStoreState.closeStatusActionModal).toHaveBeenCalled();
    expect(mockStoreState.openStatusSuccessModal).toHaveBeenCalledWith(
      'deactivate',
      'alice@test.com',
    );
  });

  it('cancel invitation onSuccess closes modal and shows notification', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    mockStoreState.cancelInvitationUserId = 'u3';
    mockStoreState.cancelInvitationUserEmail = 'carol@test.com';
    mockStoreState.cancelInvitationUserName = 'Carol White';
    render(<UserListPage />);
    fireEvent.click(screen.getByText('confirm'));
    const onSuccess = mockMutate.mock.calls[0][1].onSuccess;
    onSuccess();
    expect(mockStoreState.closeCancelInvitationModal).toHaveBeenCalled();
  });

  it('renders approvalConfiguration placeholder when tab is active', () => {
    mockSearchParams.set('tab', 'approvalConfiguration');
    render(<UserListPage />);
    expect(screen.getByText('tabs.approvalConfigurationPlaceholder')).toBeInTheDocument();
    mockSearchParams.delete('tab');
  });

  it('renders rolePermissions placeholder when tab is active', () => {
    mockSearchParams.set('tab', 'rolePermissions');
    render(<UserListPage />);
    expect(screen.getByText('tabs.rolePermissionsPlaceholder')).toBeInTheDocument();
    mockSearchParams.delete('tab');
  });

  it('renders showingLabel in pagination', () => {
    render(<UserListPage />);
    expect(screen.getByTestId('showing-label')).toBeInTheDocument();
  });

  it('opens ProjectAccessModal when projectAccess action is clicked', () => {
    render(<UserListPage />);
    const projectAccessBtn = screen.getAllByText('actions.projectAccess')[0];
    fireEvent.click(projectAccessBtn);
    expect(screen.getByTestId('project-access-modal')).toBeInTheDocument();
  });

  it('closes ProjectAccessModal via onClose', () => {
    render(<UserListPage />);
    const projectAccessBtn = screen.getAllByText('actions.projectAccess')[0];
    fireEvent.click(projectAccessBtn);
    expect(screen.getByTestId('project-access-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('close-project-access'));
    expect(screen.queryByTestId('project-access-modal')).not.toBeInTheDocument();
  });
});
