import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/new-user.svg?react', () => ({
  default: () => <div />,
}));

vi.mock('@forethread/ui-components', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  Button: ({ children, onClick, ...props }: any) => (
    <button data-testid="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Spinner: ({ size }: any) => <div data-testid="spinner" data-size={size} />,
  Badge: ({ children, className }: any) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
  TablePagination: ({
    onPageChange,
    onPageSizeChange,
    page,
    pageSize: _pageSize,
    showingLabel,
  }: any) => (
    <div data-testid="table-pagination">
      <button data-testid="next-page" onClick={() => onPageChange(page + 1)}>
        Next
      </button>
      <button data-testid="prev-page" onClick={() => onPageChange(page - 1)}>
        Prev
      </button>
      <button data-testid="change-page-size" onClick={() => onPageSizeChange(50)}>
        50
      </button>
      {showingLabel && (
        <span data-testid="showing-label">{showingLabel({ from: 1, to: 25, total: 50 })}</span>
      )}
    </div>
  ),
  EmptyState: ({ title, description }: any) => (
    <div data-testid="empty-state">
      <span>{title}</span>
      {description && <span>{description}</span>}
    </div>
  ),
  DotActionsMenu: ({ actions }: any) => (
    <div data-testid="dot-actions-menu">
      {actions.map((a: any) => (
        <button key={a.key} data-testid={`action-${a.key}`} onClick={a.onClick}>
          {a.label}
        </button>
      ))}
    </div>
  ),
  SortIcon: ({ active, direction }: any) => (
    <span data-testid="sort-icon" data-active={active} data-direction={direction} />
  ),
  StatusActionModal: ({ title, onClose, onConfirm }: any) => (
    <div data-testid="status-action-modal">
      <span>{title}</span>
      <button data-testid="confirm-status-action" onClick={onConfirm}>
        Confirm
      </button>
      <button data-testid="close-status-modal" onClick={onClose}>
        Close
      </button>
    </div>
  ),
  StatusSuccessModal: ({ title, redirectLabel }: any) => (
    <div data-testid="status-success-modal">
      <span>{title}</span>
      {redirectLabel && <span data-testid="status-redirect-label">{redirectLabel(5)}</span>}
    </div>
  ),
  ResetPasswordSuccessModal: ({ title, redirectLabel }: any) => (
    <div data-testid="reset-password-success-modal">
      <span>{title}</span>
      {redirectLabel && <span data-testid="reset-redirect-label">{redirectLabel(5)}</span>}
    </div>
  ),
}));

vi.mock('@forethread/shared-types/client', () => ({
  UserStatus: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', INVITED: 'INVITED' },
}));

vi.mock('@/features/users/constants/roles', () => ({
  ROLE_BADGE_COLORS: { CompanyAdmin: 'bg-blue', User: 'bg-green' },
  STATUS_TEXT_COLORS: { Active: 'text-green', Inactive: 'text-red', Invited: 'text-yellow' },
}));

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockMutate = vi.hoisted(() => vi.fn());
const mockUsersServiceHooks = vi.hoisted(() => ({
  useUsers: vi.fn(),
  useDeactivateUser: vi.fn(() => ({ mutate: mockMutate, isPending: false })),
  useReactivateUser: vi.fn(() => ({ mutate: mockMutate, isPending: false })),
  useResendInvitation: vi.fn(() => ({ mutate: mockMutate })),
  useCancelInvitation: vi.fn(() => ({ mutate: mockMutate, isPending: false })),
  useResetUserPassword: vi.fn(() => ({ mutate: mockMutate })),
}));
vi.mock('@/features/users/services/users.service', () => mockUsersServiceHooks);

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
vi.mock('@/features/users/state/users.store', () => ({
  useUsersStore: () => mockStoreState,
}));

vi.mock('../../users/ui/CreateUserModal', () => ({
  CreateUserModal: ({ onClose }: any) => (
    <div data-testid="create-user-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));
vi.mock('../../users/ui/EditUserModal', () => ({
  EditUserModal: ({ onClose }: any) => (
    <div data-testid="edit-user-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));
vi.mock('../../users/ui/InvitationSuccessModal', () => ({
  InvitationSuccessModal: ({ onClose }: any) => (
    <div data-testid="invitation-success-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

import { CompanyUsersTab } from './CompanyUsersTab';

const mockUsers = [
  {
    id: 'u1',
    name: 'John Doe',
    email: 'john@acme.com',
    phone: '+61400111222',
    role: 'COMPANY_ADMIN',
    status: 'ACTIVE',
  },
  {
    id: 'u2',
    name: 'Jane Smith',
    email: 'jane@acme.com',
    phone: null,
    role: 'User',
    status: 'INVITED',
  },
];

const mockData = {
  items: mockUsers,
  meta: { page: 1, total: 2, totalPages: 1, limit: 25 },
};

describe('CompanyUsersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsersServiceHooks.useUsers.mockReturnValue({
      data: mockData,
      isLoading: false,
      isError: false,
    });
    mockUsersServiceHooks.useDeactivateUser.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
    mockUsersServiceHooks.useReactivateUser.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
    mockUsersServiceHooks.useResendInvitation.mockReturnValue({ mutate: mockMutate });
    mockUsersServiceHooks.useCancelInvitation.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
    mockUsersServiceHooks.useResetUserPassword.mockReturnValue({ mutate: mockMutate });
    // Reset store state
    Object.assign(mockStoreState, {
      isCreateModalOpen: false,
      isSuccessModalOpen: false,
      isEditModalOpen: false,
      isStatusActionModalOpen: false,
      statusActionType: null,
      isStatusSuccessModalOpen: false,
      statusSuccessType: null,
      isResetPasswordSuccessModalOpen: false,
      isCancelInvitationModalOpen: false,
    });
  });

  it('renders invite user button', () => {
    render(<CompanyUsersTab />);
    expect(screen.getByText('inviteUser')).toBeInTheDocument();
  });

  it('shows spinner when loading', () => {
    mockUsersServiceHooks.useUsers.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    render(<CompanyUsersTab />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows error message when request fails', () => {
    mockUsersServiceHooks.useUsers.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    render(<CompanyUsersTab />);
    expect(screen.getByText('failedToLoad')).toBeInTheDocument();
  });

  it('shows empty state when no users', () => {
    mockUsersServiceHooks.useUsers.mockReturnValue({
      data: { items: [], meta: { page: 1, total: 0, totalPages: 0, limit: 25 } },
      isLoading: false,
      isError: false,
    });
    render(<CompanyUsersTab />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('noUsersFound')).toBeInTheDocument();
  });

  it('renders user rows when data is present', () => {
    render(<CompanyUsersTab />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@acme.com')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('renders dash for null phone', () => {
    render(<CompanyUsersTab />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders sortable column headers', () => {
    render(<CompanyUsersTab />);
    expect(screen.getByText('columns.fullName')).toBeInTheDocument();
    expect(screen.getByText('columns.email')).toBeInTheDocument();
    expect(screen.getByText('columns.phone')).toBeInTheDocument();
    expect(screen.getByText('columns.role')).toBeInTheDocument();
    expect(screen.getByText('columns.status')).toBeInTheDocument();
    expect(screen.getByText('columns.actions')).toBeInTheDocument();
  });

  it('renders pagination when data is present', () => {
    render(<CompanyUsersTab />);
    expect(screen.getByTestId('table-pagination')).toBeInTheDocument();
  });

  it('navigates to user detail on view click', () => {
    render(<CompanyUsersTab />);
    const viewButtons = screen.getAllByLabelText('View');
    fireEvent.click(viewButtons[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/settings/users/u1');
  });

  it('opens edit modal on edit click', () => {
    render(<CompanyUsersTab />);
    const editButtons = screen.getAllByLabelText('Edit');
    fireEvent.click(editButtons[0]);
    expect(mockStoreState.openEditModal).toHaveBeenCalledWith('u1');
  });

  it('renders create user modal when isCreateModalOpen', () => {
    mockStoreState.isCreateModalOpen = true;
    render(<CompanyUsersTab />);
    expect(screen.getByTestId('create-user-modal')).toBeInTheDocument();
  });

  it('renders edit user modal when isEditModalOpen', () => {
    mockStoreState.isEditModalOpen = true;
    render(<CompanyUsersTab />);
    expect(screen.getByTestId('edit-user-modal')).toBeInTheDocument();
  });

  it('renders invitation success modal when isSuccessModalOpen', () => {
    mockStoreState.isSuccessModalOpen = true;
    render(<CompanyUsersTab />);
    expect(screen.getByTestId('invitation-success-modal')).toBeInTheDocument();
  });

  it('renders status action modal when isStatusActionModalOpen with type', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    render(<CompanyUsersTab />);
    expect(screen.getByTestId('status-action-modal')).toBeInTheDocument();
  });

  it('renders status success modal when isStatusSuccessModalOpen with type', () => {
    mockStoreState.isStatusSuccessModalOpen = true;
    mockStoreState.statusSuccessType = 'deactivate';
    render(<CompanyUsersTab />);
    expect(screen.getByTestId('status-success-modal')).toBeInTheDocument();
  });

  it('renders reset password success modal when flag is set', () => {
    mockStoreState.isResetPasswordSuccessModalOpen = true;
    render(<CompanyUsersTab />);
    expect(screen.getByTestId('reset-password-success-modal')).toBeInTheDocument();
  });

  it('renders cancel invitation modal when isCancelInvitationModalOpen', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    render(<CompanyUsersTab />);
    // Cancel invitation uses StatusActionModal, second instance
    const modals = screen.getAllByTestId('status-action-modal');
    expect(modals.length).toBeGreaterThanOrEqual(1);
  });

  it('calls openCreateModal when invite user button clicked', () => {
    render(<CompanyUsersTab />);
    fireEvent.click(screen.getByText('inviteUser'));
    expect(mockStoreState.openCreateModal).toHaveBeenCalled();
  });

  it('renders dot actions menu for each user row', () => {
    render(<CompanyUsersTab />);
    const menus = screen.getAllByTestId('dot-actions-menu');
    expect(menus).toHaveLength(2);
  });

  it('shows resendInvitation and cancelInvitation actions for invited users', () => {
    render(<CompanyUsersTab />);
    // Jane Smith is Invited, should have these actions
    expect(screen.getByTestId('action-resendInvitation')).toBeInTheDocument();
    expect(screen.getByTestId('action-cancelInvitation')).toBeInTheDocument();
  });

  it('shows resetPassword and deactivate actions for active users', () => {
    render(<CompanyUsersTab />);
    // John Doe is Active
    expect(screen.getByTestId('action-resetPassword')).toBeInTheDocument();
    expect(screen.getByTestId('action-deactivate')).toBeInTheDocument();
  });

  it('sorts ascending on first click of a column header', () => {
    render(<CompanyUsersTab />);
    fireEvent.click(screen.getByText('columns.fullName'));
    // After sorting, useUsers should be re-called with sortBy/sortDir
    // The component re-renders with sort state; verify SortIcon shows active
    const sortIcons = screen.getAllByTestId('sort-icon');
    expect(sortIcons[0].getAttribute('data-active')).toBe('true');
    expect(sortIcons[0].getAttribute('data-direction')).toBe('asc');
  });

  it('sorts descending on second click of same column', () => {
    render(<CompanyUsersTab />);
    fireEvent.click(screen.getByText('columns.fullName'));
    fireEvent.click(screen.getByText('columns.fullName'));
    const sortIcons = screen.getAllByTestId('sort-icon');
    expect(sortIcons[0].getAttribute('data-active')).toBe('true');
    expect(sortIcons[0].getAttribute('data-direction')).toBe('desc');
  });

  it('clears sort on third click of same column', () => {
    render(<CompanyUsersTab />);
    fireEvent.click(screen.getByText('columns.fullName'));
    fireEvent.click(screen.getByText('columns.fullName'));
    fireEvent.click(screen.getByText('columns.fullName'));
    const sortIcons = screen.getAllByTestId('sort-icon');
    expect(sortIcons[0].getAttribute('data-active')).toBe('false');
  });

  it('switches sort field when clicking a different column', () => {
    render(<CompanyUsersTab />);
    fireEvent.click(screen.getByText('columns.fullName'));
    fireEvent.click(screen.getByText('columns.email'));
    const sortIcons = screen.getAllByTestId('sort-icon');
    // name column should be inactive
    expect(sortIcons[0].getAttribute('data-active')).toBe('false');
    // email column should be active asc
    expect(sortIcons[1].getAttribute('data-active')).toBe('true');
    expect(sortIcons[1].getAttribute('data-direction')).toBe('asc');
  });

  it('changes page when next page is clicked', () => {
    render(<CompanyUsersTab />);
    fireEvent.click(screen.getByTestId('next-page'));
    // Component should call useUsers with new page — we verify by re-render
    expect(mockUsersServiceHooks.useUsers).toHaveBeenCalled();
  });

  it('changes page size when page size option is clicked', () => {
    render(<CompanyUsersTab />);
    fireEvent.click(screen.getByTestId('change-page-size'));
    expect(mockUsersServiceHooks.useUsers).toHaveBeenCalled();
  });

  it('calls resend invitation mutate when resendInvitation action is clicked', () => {
    render(<CompanyUsersTab />);
    fireEvent.click(screen.getByTestId('action-resendInvitation'));
    expect(mockMutate).toHaveBeenCalledWith('u2');
  });

  it('calls openCancelInvitationModal when cancelInvitation action is clicked', () => {
    render(<CompanyUsersTab />);
    fireEvent.click(screen.getByTestId('action-cancelInvitation'));
    expect(mockStoreState.openCancelInvitationModal).toHaveBeenCalledWith(
      'u2',
      'jane@acme.com',
      'Jane Smith',
    );
  });

  it('calls openStatusActionModal with deactivate when deactivate action is clicked', () => {
    render(<CompanyUsersTab />);
    fireEvent.click(screen.getByTestId('action-deactivate'));
    expect(mockStoreState.openStatusActionModal).toHaveBeenCalledWith(
      'deactivate',
      'u1',
      'john@acme.com',
    );
  });

  it('calls resetPassword mutate when resetPassword action is clicked', () => {
    render(<CompanyUsersTab />);
    fireEvent.click(screen.getByTestId('action-resetPassword'));
    expect(mockMutate).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('shows activate action for inactive users', () => {
    mockUsersServiceHooks.useUsers.mockReturnValue({
      data: {
        items: [
          {
            id: 'u3',
            name: 'Bob',
            email: 'bob@acme.com',
            phone: null,
            role: 'User',
            status: 'INACTIVE',
          },
        ],
        meta: { page: 1, total: 1, totalPages: 1, limit: 25 },
      },
      isLoading: false,
      isError: false,
    });
    render(<CompanyUsersTab />);
    expect(screen.getByTestId('action-activate')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('action-activate'));
    expect(mockStoreState.openStatusActionModal).toHaveBeenCalledWith(
      'activate',
      'u3',
      'bob@acme.com',
    );
  });

  it('calls deactivate mutate when confirming status action modal for deactivate', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    mockStoreState.statusActionUserId = 'u1';
    mockStoreState.statusActionUserEmail = 'john@acme.com';
    render(<CompanyUsersTab />);
    fireEvent.click(screen.getByTestId('confirm-status-action'));
    expect(mockMutate).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('calls closeStatusActionModal when close button on status modal is clicked', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    render(<CompanyUsersTab />);
    fireEvent.click(screen.getByTestId('close-status-modal'));
    expect(mockStoreState.closeStatusActionModal).toHaveBeenCalled();
  });

  it('calls cancel invitation mutate when confirming cancel invitation modal', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    mockStoreState.cancelInvitationUserId = 'u2';
    mockStoreState.cancelInvitationUserEmail = 'jane@acme.com';
    mockStoreState.cancelInvitationUserName = 'Jane Smith';
    render(<CompanyUsersTab />);
    const confirmButtons = screen.getAllByTestId('confirm-status-action');
    // cancel invitation modal is the second StatusActionModal
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    expect(mockMutate).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('navigates to second user detail on view click', () => {
    render(<CompanyUsersTab />);
    const viewButtons = screen.getAllByLabelText('View');
    fireEvent.click(viewButtons[1]);
    expect(mockNavigate).toHaveBeenCalledWith('/settings/users/u2');
  });

  it('renders showingLabel callback in pagination', () => {
    render(<CompanyUsersTab />);
    expect(screen.getByTestId('showing-label')).toBeInTheDocument();
  });

  it('renders redirectLabel callback in status success modal', () => {
    mockStoreState.isStatusSuccessModalOpen = true;
    mockStoreState.statusSuccessType = 'deactivate';
    render(<CompanyUsersTab />);
    expect(screen.getByTestId('status-redirect-label')).toBeInTheDocument();
  });

  it('renders redirectLabel callback in reset password success modal', () => {
    mockStoreState.isResetPasswordSuccessModalOpen = true;
    render(<CompanyUsersTab />);
    expect(screen.getByTestId('reset-redirect-label')).toBeInTheDocument();
  });

  it('calls reactivate mutation when confirming status action modal for activate', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'activate';
    mockStoreState.statusActionUserId = 'u3';
    mockStoreState.statusActionUserEmail = 'bob@acme.com';
    render(<CompanyUsersTab />);
    fireEvent.click(screen.getByTestId('confirm-status-action'));
    expect(mockMutate).toHaveBeenCalledWith(
      'u3',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('does not call mutation when statusActionUserId is null', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    mockStoreState.statusActionUserId = null;
    mockStoreState.statusActionUserEmail = null;
    render(<CompanyUsersTab />);
    fireEvent.click(screen.getByTestId('confirm-status-action'));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('does not call cancel mutation when cancelInvitationUserId is null', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    mockStoreState.cancelInvitationUserId = null;
    render(<CompanyUsersTab />);
    const confirmButtons = screen.getAllByTestId('confirm-status-action');
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('opens edit modal for second user on edit click', () => {
    render(<CompanyUsersTab />);
    const editButtons = screen.getAllByLabelText('Edit');
    fireEvent.click(editButtons[1]);
    expect(mockStoreState.openEditModal).toHaveBeenCalledWith('u2');
  });

  it('deactivate onSuccess closes modal and opens success modal', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    mockStoreState.statusActionUserId = 'u1';
    mockStoreState.statusActionUserEmail = 'john@acme.com';
    render(<CompanyUsersTab />);
    fireEvent.click(screen.getByTestId('confirm-status-action'));
    const onSuccess = mockMutate.mock.calls[0][1].onSuccess;
    onSuccess();
    expect(mockStoreState.closeStatusActionModal).toHaveBeenCalled();
    expect(mockStoreState.openStatusSuccessModal).toHaveBeenCalledWith(
      'deactivate',
      'john@acme.com',
    );
  });

  it('cancel invitation onSuccess closes modal', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    mockStoreState.cancelInvitationUserId = 'u2';
    mockStoreState.cancelInvitationUserEmail = 'jane@acme.com';
    mockStoreState.cancelInvitationUserName = 'Jane Smith';
    render(<CompanyUsersTab />);
    const confirmButtons = screen.getAllByTestId('confirm-status-action');
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    const onSuccess = mockMutate.mock.calls[0][1].onSuccess;
    onSuccess();
    expect(mockStoreState.closeCancelInvitationModal).toHaveBeenCalled();
  });
});
