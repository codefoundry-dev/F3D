import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'u1' }),
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/shared-types/client', () => ({
  UserStatus: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', INVITED: 'INVITED' },
}));

const mockDeactivateMutate = vi.fn();
const mockReactivateMutate = vi.fn();
const mockResendMutate = vi.fn();
const mockCancelMutate = vi.fn();

const mockMutation = { mutate: vi.fn(), isPending: false, isError: false, error: null };

const mockUseUser = vi.fn((..._args: any[]) => ({
  data: {
    id: 'u1',
    name: 'Alice Test',
    email: 'alice@example.com',
    phone: '0400000000' as string | null,
    role: 'COMPANY_ADMIN',
    status: 'ACTIVE',
    createdAt: '2025-01-01T00:00:00Z',
    avatarUrl: null,
    position: 'Manager' as string | null,
    company: { id: 'c1', legalName: 'Acme Corp' },
  },
  isLoading: false,
  isError: false,
}));

vi.mock('../services/users.service', () => ({
  useUser: (...args: any[]) => mockUseUser(...args),
  useDeactivateUser: () => ({ ...mockMutation, mutate: mockDeactivateMutate }),
  useReactivateUser: () => ({ ...mockMutation, mutate: mockReactivateMutate }),
  useResendInvitation: () => ({ ...mockMutation, mutate: mockResendMutate }),
  useCancelInvitation: () => ({ ...mockMutation, mutate: mockCancelMutate }),
}));

const mockOpenEditModal = vi.fn();
const mockOpenStatusActionModal = vi.fn();
const mockCloseStatusActionModal = vi.fn();
const mockOpenStatusSuccessModal = vi.fn();
const mockOpenCancelInvitationModal = vi.fn();
const mockCloseCancelInvitationModal = vi.fn();

const mockStoreState: Record<string, unknown> = {
  isEditModalOpen: false,
  openEditModal: mockOpenEditModal,
  closeEditModal: vi.fn(),
  isStatusActionModalOpen: false,
  statusActionType: null,
  statusActionUserId: null,
  statusActionUserEmail: null,
  openStatusActionModal: mockOpenStatusActionModal,
  closeStatusActionModal: mockCloseStatusActionModal,
  isStatusSuccessModalOpen: false,
  statusSuccessType: null,
  statusSuccessUserEmail: null,
  openStatusSuccessModal: mockOpenStatusSuccessModal,
  closeStatusSuccessModal: vi.fn(),
  isCancelInvitationModalOpen: false,
  cancelInvitationUserId: null,
  cancelInvitationUserEmail: null,
  cancelInvitationUserName: null,
  openCancelInvitationModal: mockOpenCancelInvitationModal,
  closeCancelInvitationModal: mockCloseCancelInvitationModal,
};

vi.mock('../state/users.store', () => ({
  useUsersStore: () => mockStoreState,
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: { users: '/settings/users' },
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  DotActionsMenu: ({ actions }: any) => (
    <div data-testid="dot-actions">
      {actions?.map((a: any) => (
        <button key={a.key} data-testid={`action-${a.key}`} onClick={a.onClick}>
          {a.label}
        </button>
      ))}
    </div>
  ),
  StatusActionModal: ({ onConfirm, onClose }: any) => (
    <div data-testid="status-action-modal">
      <button data-testid="status-confirm" onClick={onConfirm}>
        Confirm
      </button>
      <button data-testid="status-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
  StatusSuccessModal: ({ redirectLabel, description, note, buttonLabel }: any) => (
    <div data-testid="status-success-modal">
      {description && <span data-testid="ss-description">{description}</span>}
      {note && <span data-testid="ss-note">{note}</span>}
      {buttonLabel && <span data-testid="ss-button-label">{buttonLabel}</span>}
      {redirectLabel && <span data-testid="redirect-label">{redirectLabel(5)}</span>}
    </div>
  ),
  AvatarUpload: ({ name }: any) => <div data-testid="avatar">{name}</div>,
  notificationService: { success: vi.fn(), error: vi.fn() },
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: (p: any) => <svg data-testid="icon-cross" {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/envelope-simple.svg?react', () => ({
  default: (p: any) => <svg data-testid="icon-envelope" {...p} />,
}));

vi.mock('../../../profile/ui/ProfileInfoGrid', () => ({
  ProfileInfoGrid: () => <div data-testid="profile-info-grid" />,
}));

vi.mock('../../../profile/ui/ProfileSections', () => ({
  RolePermissionsSection: () => <div data-testid="role-permissions" />,
  ApprovalResponsibilitiesSection: () => <div data-testid="approval-responsibilities" />,
  ActivityLogSection: () => <div data-testid="activity-log" />,
}));

vi.mock('./EditUserModal', () => ({
  EditUserModal: () => <div data-testid="edit-user-modal" />,
}));

import UserDetailPage from './UserDetailPage';

describe('UserDetailPage', () => {
  it('renders user name and email', () => {
    render(<UserDetailPage />);
    const nameElements = screen.getAllByText('Alice Test');
    expect(nameElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('renders avatar', () => {
    render(<UserDetailPage />);
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
  });

  it('renders profile sections', () => {
    render(<UserDetailPage />);
    expect(screen.getByTestId('profile-info-grid')).toBeInTheDocument();
    expect(screen.getByTestId('role-permissions')).toBeInTheDocument();
    expect(screen.getByTestId('approval-responsibilities')).toBeInTheDocument();
    expect(screen.getByTestId('activity-log')).toBeInTheDocument();
  });

  it('renders dot actions menu', () => {
    render(<UserDetailPage />);
    expect(screen.getByTestId('dot-actions')).toBeInTheDocument();
  });

  it('renders loading spinner when isLoading', () => {
    mockUseUser.mockReturnValueOnce({
      data: undefined as any,
      isLoading: true,
      isError: false,
    });
    render(<UserDetailPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders not found when isError', () => {
    mockUseUser.mockReturnValueOnce({
      data: undefined as any,
      isLoading: false,
      isError: true,
    });
    render(<UserDetailPage />);
    expect(screen.getByText('detail.notFound')).toBeInTheDocument();
  });

  it('renders not found when no user data', () => {
    mockUseUser.mockReturnValueOnce({
      data: null as any,
      isLoading: false,
      isError: false,
    });
    render(<UserDetailPage />);
    expect(screen.getByText('detail.notFound')).toBeInTheDocument();
  });

  it('dot menu for Active user has edit and deactivate actions', () => {
    render(<UserDetailPage />);
    expect(screen.getByTestId('action-edit')).toBeInTheDocument();
    expect(screen.getByTestId('action-deactivate')).toBeInTheDocument();
  });

  it('clicking edit action calls openEditModal', () => {
    render(<UserDetailPage />);
    fireEvent.click(screen.getByTestId('action-edit'));
    expect(mockOpenEditModal).toHaveBeenCalledWith('u1');
  });

  it('clicking deactivate action calls openStatusActionModal', () => {
    render(<UserDetailPage />);
    fireEvent.click(screen.getByTestId('action-deactivate'));
    expect(mockOpenStatusActionModal).toHaveBeenCalledWith('deactivate', 'u1', 'alice@example.com');
  });

  it('dot menu for Invited user has resendInvitation and cancelInvitation', () => {
    mockUseUser.mockReturnValueOnce({
      data: {
        id: 'u2',
        name: 'Bob',
        email: 'bob@example.com',
        phone: null,
        role: 'COMPANY_ADMIN',
        status: 'INVITED',
        createdAt: '2025-01-01T00:00:00Z',
        avatarUrl: null,
        position: null,
        company: { id: 'c1', legalName: 'Acme Corp' },
      },
      isLoading: false,
      isError: false,
    });
    render(<UserDetailPage />);
    expect(screen.getByTestId('action-resendInvitation')).toBeInTheDocument();
    expect(screen.getByTestId('action-cancelInvitation')).toBeInTheDocument();
  });

  it('clicking resendInvitation calls resendMutation', () => {
    mockUseUser.mockReturnValueOnce({
      data: {
        id: 'u2',
        name: 'Bob',
        email: 'bob@example.com',
        phone: null,
        role: 'COMPANY_ADMIN',
        status: 'INVITED',
        createdAt: '2025-01-01T00:00:00Z',
        avatarUrl: null,
        position: null,
        company: { id: 'c1', legalName: 'Acme Corp' },
      },
      isLoading: false,
      isError: false,
    });
    render(<UserDetailPage />);
    fireEvent.click(screen.getByTestId('action-resendInvitation'));
    expect(mockResendMutate).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('clicking cancelInvitation calls openCancelInvitationModal', () => {
    mockUseUser.mockReturnValueOnce({
      data: {
        id: 'u2',
        name: 'Bob',
        email: 'bob@example.com',
        phone: null,
        role: 'COMPANY_ADMIN',
        status: 'INVITED',
        createdAt: '2025-01-01T00:00:00Z',
        avatarUrl: null,
        position: null,
        company: { id: 'c1', legalName: 'Acme Corp' },
      },
      isLoading: false,
      isError: false,
    });
    render(<UserDetailPage />);
    fireEvent.click(screen.getByTestId('action-cancelInvitation'));
    expect(mockOpenCancelInvitationModal).toHaveBeenCalledWith('u2', 'bob@example.com', 'Bob');
  });

  it('dot menu for Inactive user has activate action', () => {
    mockUseUser.mockReturnValueOnce({
      data: {
        id: 'u3',
        name: 'Carol',
        email: 'carol@example.com',
        phone: null,
        role: 'COMPANY_ADMIN',
        status: 'INACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
        avatarUrl: null,
        position: null,
        company: { id: 'c1', legalName: 'Acme Corp' },
      },
      isLoading: false,
      isError: false,
    });
    render(<UserDetailPage />);
    expect(screen.getByTestId('action-activate')).toBeInTheDocument();
  });

  it('clicking activate action calls openStatusActionModal with activate', () => {
    mockUseUser.mockReturnValueOnce({
      data: {
        id: 'u3',
        name: 'Carol',
        email: 'carol@example.com',
        phone: null,
        role: 'COMPANY_ADMIN',
        status: 'INACTIVE',
        createdAt: '2025-01-01T00:00:00Z',
        avatarUrl: null,
        position: null,
        company: { id: 'c1', legalName: 'Acme Corp' },
      },
      isLoading: false,
      isError: false,
    });
    render(<UserDetailPage />);
    fireEvent.click(screen.getByTestId('action-activate'));
    expect(mockOpenStatusActionModal).toHaveBeenCalledWith('activate', 'u3', 'carol@example.com');
  });

  it('status action modal shows and confirm triggers mutation', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    mockStoreState.statusActionUserId = 'u1';
    mockStoreState.statusActionUserEmail = 'alice@example.com';
    render(<UserDetailPage />);
    expect(screen.getByTestId('status-action-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('status-confirm'));
    expect(mockDeactivateMutate).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    // Reset
    mockStoreState.isStatusActionModalOpen = false;
    mockStoreState.statusActionType = null;
    mockStoreState.statusActionUserId = null;
    mockStoreState.statusActionUserEmail = null;
  });

  it('cancel invitation modal confirm triggers cancelMutation', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    mockStoreState.cancelInvitationUserId = 'u2';
    mockStoreState.cancelInvitationUserEmail = 'bob@example.com';
    mockStoreState.cancelInvitationUserName = 'Bob';
    render(<UserDetailPage />);
    const confirmBtns = screen.getAllByTestId('status-confirm');
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    expect(mockCancelMutate).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    // Reset
    mockStoreState.isCancelInvitationModalOpen = false;
    mockStoreState.cancelInvitationUserId = null;
    mockStoreState.cancelInvitationUserEmail = null;
    mockStoreState.cancelInvitationUserName = null;
  });

  it('status action confirm with deactivate calls deactivateMutation onSuccess which opens success modal', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    mockStoreState.statusActionUserId = 'u1';
    mockStoreState.statusActionUserEmail = 'alice@example.com';
    mockDeactivateMutate.mockImplementation((_id: string, opts: any) => opts.onSuccess());
    render(<UserDetailPage />);
    fireEvent.click(screen.getByTestId('status-confirm'));
    expect(mockCloseStatusActionModal).toHaveBeenCalled();
    expect(mockOpenStatusSuccessModal).toHaveBeenCalledWith('deactivate', 'alice@example.com');
    // Reset
    mockDeactivateMutate.mockReset();
    mockStoreState.isStatusActionModalOpen = false;
    mockStoreState.statusActionType = null;
    mockStoreState.statusActionUserId = null;
    mockStoreState.statusActionUserEmail = null;
  });

  it('status action confirm with activate calls reactivateMutation onSuccess which opens success modal', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'activate';
    mockStoreState.statusActionUserId = 'u1';
    mockStoreState.statusActionUserEmail = 'alice@example.com';
    mockReactivateMutate.mockImplementation((_id: string, opts: any) => opts.onSuccess());
    render(<UserDetailPage />);
    fireEvent.click(screen.getByTestId('status-confirm'));
    expect(mockCloseStatusActionModal).toHaveBeenCalled();
    expect(mockOpenStatusSuccessModal).toHaveBeenCalledWith('activate', 'alice@example.com');
    // Reset
    mockReactivateMutate.mockReset();
    mockStoreState.isStatusActionModalOpen = false;
    mockStoreState.statusActionType = null;
    mockStoreState.statusActionUserId = null;
    mockStoreState.statusActionUserEmail = null;
  });

  it('status action confirm does nothing when statusActionUserId is null', () => {
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'deactivate';
    mockStoreState.statusActionUserId = null;
    mockStoreState.statusActionUserEmail = null;
    render(<UserDetailPage />);
    fireEvent.click(screen.getByTestId('status-confirm'));
    expect(mockDeactivateMutate).not.toHaveBeenCalled();
    // Reset
    mockStoreState.isStatusActionModalOpen = false;
    mockStoreState.statusActionType = null;
  });

  it('cancel invitation confirm onSuccess calls closeCancelInvitationModal and navigates', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    mockStoreState.cancelInvitationUserId = 'u2';
    mockStoreState.cancelInvitationUserEmail = 'bob@example.com';
    mockStoreState.cancelInvitationUserName = 'Bob';
    mockCancelMutate.mockImplementation((_id: string, opts: any) => opts.onSuccess());
    render(<UserDetailPage />);
    const confirmBtns = screen.getAllByTestId('status-confirm');
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    expect(mockCloseCancelInvitationModal).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/settings/users');
    // Reset
    mockCancelMutate.mockReset();
    mockStoreState.isCancelInvitationModalOpen = false;
    mockStoreState.cancelInvitationUserId = null;
    mockStoreState.cancelInvitationUserEmail = null;
    mockStoreState.cancelInvitationUserName = null;
  });

  it('cancel invitation confirm does nothing when cancelInvitationUserId is null', () => {
    mockStoreState.isCancelInvitationModalOpen = true;
    mockStoreState.cancelInvitationUserId = null;
    render(<UserDetailPage />);
    const confirmBtns = screen.getAllByTestId('status-confirm');
    fireEvent.click(confirmBtns[confirmBtns.length - 1]);
    expect(mockCancelMutate).not.toHaveBeenCalled();
    // Reset
    mockStoreState.isCancelInvitationModalOpen = false;
  });

  it('status success modal renders when store indicates so', () => {
    mockStoreState.isStatusSuccessModalOpen = true;
    mockStoreState.statusSuccessType = 'activate';
    mockStoreState.statusSuccessUserEmail = 'alice@example.com';
    render(<UserDetailPage />);
    expect(screen.getByTestId('status-success-modal')).toBeInTheDocument();
    // Reset
    mockStoreState.isStatusSuccessModalOpen = false;
    mockStoreState.statusSuccessType = null;
    mockStoreState.statusSuccessUserEmail = null;
  });

  it('edit modal renders when store indicates so', () => {
    mockStoreState.isEditModalOpen = true;
    render(<UserDetailPage />);
    expect(screen.getByTestId('edit-user-modal')).toBeInTheDocument();
    // Reset
    mockStoreState.isEditModalOpen = false;
  });
});
