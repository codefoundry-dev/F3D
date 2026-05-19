import { render, screen, fireEvent } from '@testing-library/react';

const mockProfile = vi.hoisted(() => ({
  value: {
    data: {
      id: 'user-1',
      name: 'John Doe',
      email: 'john@test.com',
      phone: '+1234567890',
      status: 'ACTIVE',
      role: 'FINANCIAL_OFFICER',
      createdAt: '2026-01-15',
      position: 'Accountant',
      company: { legalName: 'Acme Corp' },
    } as Record<string, unknown> | null,
    isLoading: false,
  },
}));

const mockChangePasswordMutation = vi.hoisted(() => ({
  value: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    reset: vi.fn(),
  },
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../../../../packages/profile-shared/src/services/profile.service', () => ({
  useProfile: () => mockProfile.value,
  useAvatarUrl: () => ({ data: null }),
  useUploadAvatar: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useChangePassword: () => mockChangePasswordMutation.value,
}));

vi.mock('../../../../../../packages/profile-shared/src/components/EditProfileModal', () => ({
  EditProfileModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="edit-modal">
      <button onClick={onClose}>close-edit</button>
    </div>
  ),
}));

vi.mock('../../../../../../packages/profile-shared/src/components/ProfileInfoGrid', () => ({
  ProfileInfoGrid: () => <div data-testid="profile-info-grid" />,
}));

vi.mock('../../../../../../packages/profile-shared/src/components/ProfileSections', () => ({
  RolePermissionsSection: () => <div data-testid="role-permissions" />,
  ApprovalResponsibilitiesSection: () => <div data-testid="approval-responsibilities" />,
  ActivityLogSection: () => <div data-testid="activity-log" />,
}));

vi.mock('../services/profile.service', () => ({
  useProfile: () => mockProfile.value,
  useAvatarUrl: () => ({ data: null }),
  useUploadAvatar: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useChangePassword: () => mockChangePasswordMutation.value,
}));

vi.mock('../ui/EditProfileModal', () => ({
  EditProfileModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="edit-modal">
      <button onClick={onClose}>close-edit</button>
    </div>
  ),
}));

vi.mock('../ui/ProfileInfoGrid', () => ({
  ProfileInfoGrid: () => <div data-testid="profile-info-grid" />,
}));

vi.mock('../ui/ProfileSections', () => ({
  RolePermissionsSection: () => <div data-testid="role-permissions" />,
  ApprovalResponsibilitiesSection: () => <div data-testid="approval-responsibilities" />,
  ActivityLogSection: () => <div data-testid="activity-log" />,
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  AvatarUpload: ({ onUpload }: { onUpload: (file: File) => void }) => (
    <div data-testid="avatar-upload">
      <button onClick={() => onUpload(new File([''], 'avatar.png'))}>upload</button>
    </div>
  ),
  ChangePasswordModal: ({
    onClose,
    onSubmit,
  }: {
    onClose: () => void;
    onSubmit: (data: Record<string, string>) => void;
  }) => (
    <div data-testid="change-password-modal">
      <button onClick={onClose}>close-pw</button>
      <button onClick={() => onSubmit({ currentPassword: 'old', newPassword: 'new' })}>
        submit-pw
      </button>
    </div>
  ),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit-without-line.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/envelope-simple.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-closed.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/lock-simple.svg?react', () => ({
  default: () => <span />,
}));

import UserProfilePage from './UserProfilePage';

describe('UserProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfile.value = {
      data: {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@test.com',
        phone: '+1234567890',
        status: 'ACTIVE',
        role: 'FINANCIAL_OFFICER',
        createdAt: '2026-01-15',
        position: 'Accountant',
        company: { legalName: 'Acme Corp' },
      },
      isLoading: false,
    };
    mockChangePasswordMutation.value = {
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
      reset: vi.fn(),
    };
  });

  it('renders spinner when loading', () => {
    mockProfile.value = { ...mockProfile.value, isLoading: true };
    render(<UserProfilePage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders nothing when no profile', () => {
    mockProfile.value = { data: null, isLoading: false };
    const { container } = render(<UserProfilePage />);
    expect(container.innerHTML).toBe('');
  });

  it('renders user name and email', () => {
    render(<UserProfilePage />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@test.com')).toBeInTheDocument();
  });

  it('renders profile sections', () => {
    render(<UserProfilePage />);
    expect(screen.getByTestId('profile-info-grid')).toBeInTheDocument();
    expect(screen.getByTestId('role-permissions')).toBeInTheDocument();
    expect(screen.getByTestId('approval-responsibilities')).toBeInTheDocument();
    expect(screen.getByTestId('activity-log')).toBeInTheDocument();
  });

  it('renders edit profile and change password buttons', () => {
    render(<UserProfilePage />);
    expect(screen.getByText('editProfile')).toBeInTheDocument();
    expect(screen.getByText('changePassword')).toBeInTheDocument();
  });

  it('opens edit modal when edit button clicked', () => {
    render(<UserProfilePage />);
    fireEvent.click(screen.getByText('editProfile'));
    expect(screen.getByTestId('edit-modal')).toBeInTheDocument();
  });

  it('closes edit modal', () => {
    render(<UserProfilePage />);
    fireEvent.click(screen.getByText('editProfile'));
    expect(screen.getByTestId('edit-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('close-edit'));
    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();
  });

  it('opens change password modal when button clicked', () => {
    render(<UserProfilePage />);
    fireEvent.click(screen.getByText('changePassword'));
    expect(screen.getByTestId('change-password-modal')).toBeInTheDocument();
  });

  it('closes change password modal and resets mutation', () => {
    render(<UserProfilePage />);
    fireEvent.click(screen.getByText('changePassword'));
    fireEvent.click(screen.getByText('close-pw'));
    expect(screen.queryByTestId('change-password-modal')).not.toBeInTheDocument();
    expect(mockChangePasswordMutation.value.reset).toHaveBeenCalled();
  });

  it('submits password change', () => {
    render(<UserProfilePage />);
    fireEvent.click(screen.getByText('changePassword'));
    fireEvent.click(screen.getByText('submit-pw'));
    expect(mockChangePasswordMutation.value.mutate).toHaveBeenCalledWith({
      currentPassword: 'old',
      newPassword: 'new',
    });
  });

  it('triggers avatar upload', () => {
    render(<UserProfilePage />);
    fireEvent.click(screen.getByText('upload'));
  });
});
