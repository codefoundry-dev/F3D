const mockUseVendorUser = vi.hoisted(() => vi.fn());
const mockResendMutate = vi.hoisted(() => vi.fn());
const mockCancelMutate = vi.hoisted(() => vi.fn());

vi.mock('../services/vendor-users.service', () => ({
  useVendorUser: mockUseVendorUser,
  useResendVendorUserInvitation: () => ({ mutate: mockResendMutate, isPending: false }),
  useCancelVendorUserInvitation: () => ({ mutate: mockCancelMutate, isPending: false }),
}));

const mockStoreState = vi.hoisted(() => ({
  isStatusActionModalOpen: false,
  statusActionType: null as string | null,
  statusActionUserId: null as string | null,
  statusActionUserEmail: null as string | null,
  openStatusActionModal: vi.fn(),
  closeStatusActionModal: vi.fn(),
}));

vi.mock('../state/vendor-users.store', () => ({
  useVendorUsersStore: () => mockStoreState,
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'user-1' }),
  useNavigate: () => mockNavigate,
}));

const mockNavigate = vi.fn();

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/shared-types/client', () => ({
  UserStatus: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', INVITED: 'INVITED' },
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  DotActionsMenu: ({ actions }: any) => (
    <div data-testid="dot-menu">
      {actions.map((a: any) => (
        <button key={a.key} onClick={a.onClick} data-testid={`action-${a.key}`}>
          {a.label}
        </button>
      ))}
    </div>
  ),
  StatusActionModal: ({ title, onConfirm, onClose }: any) => (
    <div data-testid="status-action-modal">
      <span>{title}</span>
      <button onClick={onConfirm} data-testid="confirm-action">
        Confirm
      </button>
      <button onClick={onClose} data-testid="cancel-action">
        Cancel
      </button>
    </div>
  ),
  AvatarUpload: ({ name }: any) => <div data-testid="avatar-upload">{name}</div>,
  notificationService: { success: vi.fn() },
}));

vi.mock('../../profile/ui/ProfileInfoGrid', () => ({
  ProfileInfoGrid: () => <div data-testid="profile-info-grid" />,
}));

vi.mock('../../profile/ui/ProfileSections', () => ({
  RolePermissionsSection: () => <div data-testid="role-permissions" />,
  ApprovalResponsibilitiesSection: () => <div data-testid="approval-responsibilities" />,
  ActivityLogSection: () => <div data-testid="activity-log" />,
}));

const SvgStub = vi.hoisted(() => () => null);
vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: SvgStub,
}));
vi.mock('@forethread/ui-components/assets/icons/envelope-simple.svg?react', () => ({
  default: SvgStub,
}));

import { render, screen, fireEvent } from '@testing-library/react';

import VendorUserDetailPage from './VendorUserDetailPage';

describe('VendorUserDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockStoreState, {
      isStatusActionModalOpen: false,
      statusActionType: null,
      statusActionUserId: null,
      statusActionUserEmail: null,
    });
  });

  it('shows spinner while loading', () => {
    mockUseVendorUser.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<VendorUserDetailPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows error state when error', () => {
    mockUseVendorUser.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<VendorUserDetailPage />);
    expect(screen.getByText('detail.notFound')).toBeInTheDocument();
  });

  it('shows error state when no user', () => {
    mockUseVendorUser.mockReturnValue({ data: null, isLoading: false, isError: false });
    render(<VendorUserDetailPage />);
    expect(screen.getByText('detail.notFound')).toBeInTheDocument();
  });

  it('renders user details when loaded', () => {
    mockUseVendorUser.mockReturnValue({
      data: {
        id: 'user-1',
        name: 'Alice Test',
        email: 'alice@test.com',
        phone: '+1234',
        status: 'ACTIVE',
        role: 'VENDOR',
        createdAt: '2024-01-01',
        avatarUrl: null,
        position: 'Manager',
      },
      isLoading: false,
      isError: false,
    });
    render(<VendorUserDetailPage />);
    // Name appears in both heading and AvatarUpload mock
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Alice Test');
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
    expect(screen.getByTestId('profile-info-grid')).toBeInTheDocument();
    expect(screen.getByTestId('role-permissions')).toBeInTheDocument();
    expect(screen.getByTestId('approval-responsibilities')).toBeInTheDocument();
    expect(screen.getByTestId('activity-log')).toBeInTheDocument();
  });

  it('shows dot actions menu for INVITED users', () => {
    mockUseVendorUser.mockReturnValue({
      data: {
        id: 'user-1',
        name: 'Bob',
        email: 'bob@test.com',
        status: 'INVITED',
        role: 'VENDOR',
        createdAt: '2024-01-01',
        avatarUrl: null,
        position: null,
        phone: null,
      },
      isLoading: false,
      isError: false,
    });
    render(<VendorUserDetailPage />);
    expect(screen.getByTestId('dot-menu')).toBeInTheDocument();
    expect(screen.getByTestId('action-resendInvitation')).toBeInTheDocument();
    expect(screen.getByTestId('action-cancelInvitation')).toBeInTheDocument();
  });

  it('does not show dot actions menu for ACTIVE users', () => {
    mockUseVendorUser.mockReturnValue({
      data: {
        id: 'user-1',
        name: 'Alice',
        email: 'alice@test.com',
        status: 'ACTIVE',
        role: 'VENDOR',
        createdAt: '2024-01-01',
        avatarUrl: null,
        position: null,
        phone: null,
      },
      isLoading: false,
      isError: false,
    });
    render(<VendorUserDetailPage />);
    expect(screen.queryByTestId('dot-menu')).not.toBeInTheDocument();
  });

  it('calls resend mutation on resend action', () => {
    mockUseVendorUser.mockReturnValue({
      data: {
        id: 'user-1',
        name: 'Bob',
        email: 'bob@test.com',
        status: 'INVITED',
        role: 'VENDOR',
        createdAt: '2024-01-01',
        avatarUrl: null,
        position: null,
        phone: null,
      },
      isLoading: false,
      isError: false,
    });
    render(<VendorUserDetailPage />);
    fireEvent.click(screen.getByTestId('action-resendInvitation'));
    expect(mockResendMutate).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('opens cancel invitation modal on cancel action', () => {
    mockUseVendorUser.mockReturnValue({
      data: {
        id: 'user-1',
        name: 'Bob',
        email: 'bob@test.com',
        status: 'INVITED',
        role: 'VENDOR',
        createdAt: '2024-01-01',
        avatarUrl: null,
        position: null,
        phone: null,
      },
      isLoading: false,
      isError: false,
    });
    render(<VendorUserDetailPage />);
    fireEvent.click(screen.getByTestId('action-cancelInvitation'));
    expect(mockStoreState.openStatusActionModal).toHaveBeenCalledWith(
      'cancelInvitation',
      'user-1',
      'bob@test.com',
    );
  });

  it('renders cancel invitation modal when open', () => {
    mockUseVendorUser.mockReturnValue({
      data: {
        id: 'user-1',
        name: 'Bob',
        email: 'bob@test.com',
        status: 'INVITED',
        role: 'VENDOR',
        createdAt: '2024-01-01',
        avatarUrl: null,
        position: null,
        phone: null,
      },
      isLoading: false,
      isError: false,
    });
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'cancelInvitation';
    mockStoreState.statusActionUserId = 'user-1';
    mockStoreState.statusActionUserEmail = 'bob@test.com';
    render(<VendorUserDetailPage />);
    expect(screen.getByTestId('status-action-modal')).toBeInTheDocument();
  });

  it('calls cancel mutation on confirm', () => {
    mockUseVendorUser.mockReturnValue({
      data: {
        id: 'user-1',
        name: 'Bob',
        email: 'bob@test.com',
        status: 'INVITED',
        role: 'VENDOR',
        createdAt: '2024-01-01',
        avatarUrl: null,
        position: null,
        phone: null,
      },
      isLoading: false,
      isError: false,
    });
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'cancelInvitation';
    mockStoreState.statusActionUserId = 'user-1';
    mockStoreState.statusActionUserEmail = 'bob@test.com';
    render(<VendorUserDetailPage />);
    fireEvent.click(screen.getByTestId('confirm-action'));
    expect(mockCancelMutate).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('does not call cancel mutation when userId is null', () => {
    mockUseVendorUser.mockReturnValue({
      data: {
        id: 'user-1',
        name: 'Bob',
        email: 'bob@test.com',
        status: 'INVITED',
        role: 'VENDOR',
        createdAt: '2024-01-01',
        avatarUrl: null,
        position: null,
        phone: null,
      },
      isLoading: false,
      isError: false,
    });
    mockStoreState.isStatusActionModalOpen = true;
    mockStoreState.statusActionType = 'cancelInvitation';
    mockStoreState.statusActionUserId = null;
    mockStoreState.statusActionUserEmail = 'bob@test.com';
    render(<VendorUserDetailPage />);
    fireEvent.click(screen.getByTestId('confirm-action'));
    expect(mockCancelMutate).not.toHaveBeenCalled();
  });
});
