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
  Spinner: () => <div data-testid="spinner" />,
  DotActionsMenu: ({ actions }: any) => (
    <div data-testid="dot-actions">
      {actions.map((a: any) => (
        <button key={a.key} onClick={a.onClick}>
          {a.label}
        </button>
      ))}
    </div>
  ),
  StatusActionModal: ({ title, onClose, onConfirm }: any) => (
    <div data-testid="status-action-modal">
      <span>{title}</span>
      <button onClick={onConfirm}>confirm</button>
      <button onClick={onClose}>close</button>
    </div>
  ),
  StatusSuccessModal: ({ title, onClose, redirectLabel }: any) => (
    <div data-testid="status-success-modal">
      <span>{title}</span>
      <button onClick={onClose}>close</button>
      {redirectLabel && <span data-testid="redirect-label">{redirectLabel(5)}</span>}
    </div>
  ),
  AvatarUpload: ({ name }: any) => <div data-testid="avatar-upload">{name}</div>,
  notificationService: { success: vi.fn() },
}));

const svgIcons = ['cross-in-circle', 'envelope-simple'];
svgIcons.forEach((name) => {
  vi.mock(`@forethread/ui-components/assets/icons/${name}.svg?react`, () => ({
    default: () => <div />,
  }));
});

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'user-1' }),
  useNavigate: () => mockNavigate,
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: { users: '/settings/users' },
}));

const mockStoreState = vi.hoisted(() => ({
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

const mockUser = vi.hoisted(() => ({
  id: 'user-1',
  name: 'John Doe',
  email: 'john@test.com',
  phone: '+61412345678',
  role: 'COMPANY_ADMIN',
  status: 'ACTIVE',
  avatarUrl: null,
  createdAt: '2026-01-15T00:00:00Z',
  position: 'Manager',
  projects: [{ id: 'p1', name: 'Project Alpha' }],
}));

const mockQueryState = vi.hoisted(() => ({
  data: mockUser as any,
  isLoading: false,
  isError: false,
}));

const mockMutate = vi.hoisted(() => vi.fn());
const mockMutation = vi.hoisted(() => ({
  mutate: mockMutate,
  isPending: false,
}));

vi.mock('../services/users.service', () => ({
  useUser: vi.fn(() => mockQueryState),
  useDeactivateUser: vi.fn(() => mockMutation),
  useReactivateUser: vi.fn(() => mockMutation),
  useResendInvitation: vi.fn(() => mockMutation),
  useCancelInvitation: vi.fn(() => mockMutation),
}));

vi.mock('./EditUserModal', () => ({
  EditUserModal: ({ onClose }: any) => (
    <div data-testid="edit-user-modal">
      <button onClick={onClose}>close-edit</button>
    </div>
  ),
}));

vi.mock('./ProjectAccessModal', () => ({
  ProjectAccessModal: ({ userId: _userId, userName, onClose }: any) => (
    <div data-testid="project-access-modal">
      <span>{userName}</span>
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

vi.mock('../../../profile/ui/ProfileInfoGrid', () => ({
  ProfileInfoGrid: (props: any) => (
    <div data-testid="profile-info-grid">
      {props.onProjectAccess && <button onClick={props.onProjectAccess}>project-access</button>}
    </div>
  ),
}));

vi.mock('../../../profile/ui/ProfileSections', () => ({
  RolePermissionsSection: () => <div data-testid="role-permissions" />,
  ApprovalResponsibilitiesSection: () => <div data-testid="approval-responsibilities" />,
  ActivityLogSection: ({ userId }: any) => <div data-testid="activity-log">{userId}</div>,
}));

import UserDetailPage from './UserDetailPage';

describe('UserDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.isEditModalOpen = false;
    mockStoreState.isStatusActionModalOpen = false;
    mockStoreState.statusActionType = null;
    mockStoreState.isStatusSuccessModalOpen = false;
    mockStoreState.statusSuccessType = null;
    mockStoreState.isCancelInvitationModalOpen = false;
    mockQueryState.data = mockUser;
    mockQueryState.isLoading = false;
    mockQueryState.isError = false;
  });

  it('renders user name in heading', () => {
    render(<UserDetailPage />);
    const headings = screen.getAllByText('John Doe');
    expect(headings.length).toBeGreaterThanOrEqual(1);
    // Name appears in both the h2 heading and avatar
    expect(headings[0]).toBeInTheDocument();
  });

  it('renders user email', () => {
    render(<UserDetailPage />);
    expect(screen.getByText('john@test.com')).toBeInTheDocument();
  });

  it('renders avatar upload', () => {
    render(<UserDetailPage />);
    expect(screen.getByTestId('avatar-upload')).toBeInTheDocument();
  });

  it('renders profile info grid', () => {
    render(<UserDetailPage />);
    expect(screen.getByTestId('profile-info-grid')).toBeInTheDocument();
  });

  it('renders role permissions section', () => {
    render(<UserDetailPage />);
    expect(screen.getByTestId('role-permissions')).toBeInTheDocument();
  });

  it('renders approval responsibilities section', () => {
    render(<UserDetailPage />);
    expect(screen.getByTestId('approval-responsibilities')).toBeInTheDocument();
  });

  it('renders activity log section with user id', () => {
    render(<UserDetailPage />);
    expect(screen.getByTestId('activity-log')).toBeInTheDocument();
    expect(screen.getByText('user-1')).toBeInTheDocument();
  });

  it('renders dot actions menu', () => {
    render(<UserDetailPage />);
    expect(screen.getByTestId('dot-actions')).toBeInTheDocument();
  });

  it('shows spinner when loading', () => {
    mockQueryState.isLoading = true;
    render(<UserDetailPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows not found when error', () => {
    mockQueryState.isError = true;
    render(<UserDetailPage />);
    expect(screen.getByText('detail.notFound')).toBeInTheDocument();
  });

  it('shows not found when user is null', () => {
    mockQueryState.data = null;
    render(<UserDetailPage />);
    expect(screen.getByText('detail.notFound')).toBeInTheDocument();
  });

  it('renders EditUserModal when open', () => {
    mockStoreState.isEditModalOpen = true;
    render(<UserDetailPage />);
    expect(screen.getByTestId('edit-user-modal')).toBeInTheDocument();
  });

  it('renders StatusActionModal when status action is open', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    render(<UserDetailPage />);
    expect(screen.getByTestId('status-action-modal')).toBeInTheDocument();
  });

  it('renders StatusSuccessModal when status success is open', () => {
    mockStoreState.isStatusSuccessModalOpen = true;
    mockStoreState.statusSuccessType = 'deactivate';
    render(<UserDetailPage />);
    expect(screen.getByTestId('status-success-modal')).toBeInTheDocument();
  });

  it('renders cancel invitation modal when open', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    render(<UserDetailPage />);
    expect(screen.getByTestId('status-action-modal')).toBeInTheDocument();
  });

  it('shows dot actions with edit for active user', () => {
    render(<UserDetailPage />);
    expect(screen.getByText('detail.editUser')).toBeInTheDocument();
    expect(screen.getByText('detail.deactivate')).toBeInTheDocument();
  });

  it('shows resend/cancel for invited user', () => {
    mockQueryState.data = { ...mockUser, status: 'INVITED' };
    render(<UserDetailPage />);
    expect(screen.getByText('detail.resendInvitation')).toBeInTheDocument();
    expect(screen.getByText('detail.cancelInvitation')).toBeInTheDocument();
  });

  it('shows activate for inactive user', () => {
    mockQueryState.data = { ...mockUser, status: 'INACTIVE' };
    render(<UserDetailPage />);
    expect(screen.getByText('detail.activate')).toBeInTheDocument();
  });

  // --- Interaction / callback tests ---

  it('clicking edit action calls openEditModal with user id', () => {
    render(<UserDetailPage />);
    fireEvent.click(screen.getByText('detail.editUser'));
    expect(mockStoreState.openEditModal).toHaveBeenCalledWith('user-1');
  });

  it('clicking deactivate action calls openStatusActionModal', () => {
    render(<UserDetailPage />);
    fireEvent.click(screen.getByText('detail.deactivate'));
    expect(mockStoreState.openStatusActionModal).toHaveBeenCalledWith(
      'deactivate',
      'user-1',
      'john@test.com',
    );
  });

  it('clicking activate action on inactive user calls openStatusActionModal', () => {
    mockQueryState.data = { ...mockUser, status: 'INACTIVE' };
    render(<UserDetailPage />);
    fireEvent.click(screen.getByText('detail.activate'));
    expect(mockStoreState.openStatusActionModal).toHaveBeenCalledWith(
      'activate',
      'user-1',
      'john@test.com',
    );
  });

  it('clicking resendInvitation on invited user calls resend mutate', () => {
    mockQueryState.data = { ...mockUser, status: 'INVITED' };
    render(<UserDetailPage />);
    fireEvent.click(screen.getByText('detail.resendInvitation'));
    expect(mockMutate).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('clicking cancelInvitation on invited user calls openCancelInvitationModal', () => {
    mockQueryState.data = { ...mockUser, status: 'INVITED' };
    render(<UserDetailPage />);
    fireEvent.click(screen.getByText('detail.cancelInvitation'));
    expect(mockStoreState.openCancelInvitationModal).toHaveBeenCalledWith(
      'user-1',
      'john@test.com',
      'John Doe',
    );
  });

  it('confirming deactivate status action modal calls deactivate mutate', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    mockStoreState.statusActionUserId = 'user-1';
    mockStoreState.statusActionUserEmail = 'john@test.com';
    render(<UserDetailPage />);
    fireEvent.click(screen.getByText('confirm'));
    expect(mockMutate).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('confirming activate status action modal calls reactivate mutate', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'activate';
    mockStoreState.statusActionUserId = 'user-1';
    mockStoreState.statusActionUserEmail = 'john@test.com';
    render(<UserDetailPage />);
    fireEvent.click(screen.getByText('confirm'));
    expect(mockMutate).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('status action confirm does nothing when userId is null', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    mockStoreState.statusActionUserId = null;
    mockStoreState.statusActionUserEmail = null;
    render(<UserDetailPage />);
    fireEvent.click(screen.getByText('confirm'));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('confirming cancel invitation modal calls cancel mutate', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    mockStoreState.cancelInvitationUserId = 'user-1';
    mockStoreState.cancelInvitationUserEmail = 'john@test.com';
    mockStoreState.cancelInvitationUserName = 'John Doe';
    render(<UserDetailPage />);
    fireEvent.click(screen.getByText('confirm'));
    expect(mockMutate).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('cancel invitation confirm does nothing when userId is null', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    mockStoreState.cancelInvitationUserId = null;
    render(<UserDetailPage />);
    fireEvent.click(screen.getByText('confirm'));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('closes EditUserModal via onClose', () => {
    mockStoreState.isEditModalOpen = true;
    render(<UserDetailPage />);
    fireEvent.click(screen.getByText('close-edit'));
    expect(mockStoreState.closeEditModal).toHaveBeenCalled();
  });

  it('closes StatusActionModal via onClose', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    render(<UserDetailPage />);
    fireEvent.click(screen.getByText('close'));
    expect(mockStoreState.closeStatusActionModal).toHaveBeenCalled();
  });

  it('closes StatusSuccessModal via onClose', () => {
    mockStoreState.isStatusSuccessModalOpen = true;
    mockStoreState.statusSuccessType = 'deactivate';
    render(<UserDetailPage />);
    fireEvent.click(screen.getByText('close'));
    expect(mockStoreState.closeStatusSuccessModal).toHaveBeenCalled();
  });

  it('closes CancelInvitation modal via onClose', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    render(<UserDetailPage />);
    fireEvent.click(screen.getByText('close'));
    expect(mockStoreState.closeCancelInvitationModal).toHaveBeenCalled();
  });

  it('clicking project-access button opens ProjectAccessModal', () => {
    render(<UserDetailPage />);
    fireEvent.click(screen.getByText('project-access'));
    expect(screen.getByTestId('project-access-modal')).toBeInTheDocument();
  });

  it('closes ProjectAccessModal via onClose', () => {
    render(<UserDetailPage />);
    fireEvent.click(screen.getByText('project-access'));
    expect(screen.getByTestId('project-access-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('close'));
    expect(screen.queryByTestId('project-access-modal')).not.toBeInTheDocument();
  });

  it('deactivate onSuccess closes modal and opens success modal', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    mockStoreState.statusActionUserId = 'user-1';
    mockStoreState.statusActionUserEmail = 'john@test.com';
    render(<UserDetailPage />);
    fireEvent.click(screen.getByText('confirm'));
    // Extract and invoke the onSuccess callback
    const onSuccess = mockMutate.mock.calls[0][1].onSuccess;
    onSuccess();
    expect(mockStoreState.closeStatusActionModal).toHaveBeenCalled();
    expect(mockStoreState.openStatusSuccessModal).toHaveBeenCalledWith(
      'deactivate',
      'john@test.com',
    );
  });

  it('cancel invitation onSuccess closes modal and navigates', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    mockStoreState.cancelInvitationUserId = 'user-1';
    mockStoreState.cancelInvitationUserEmail = 'john@test.com';
    mockStoreState.cancelInvitationUserName = 'John Doe';
    render(<UserDetailPage />);
    fireEvent.click(screen.getByText('confirm'));
    const onSuccess = mockMutate.mock.calls[0][1].onSuccess;
    onSuccess();
    expect(mockStoreState.closeCancelInvitationModal).toHaveBeenCalled();
  });
});
