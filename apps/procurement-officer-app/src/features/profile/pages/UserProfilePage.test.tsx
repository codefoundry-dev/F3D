const mockProfile = vi.hoisted(() => ({
  value: {
    data: {
      id: 'user-1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      status: 'ACTIVE',
      role: 'PROCUREMENT_OFFICER',
      createdAt: '2024-01-15T10:00:00Z',
      position: 'Manager',
      company: { legalName: 'Test Corp' },
    },
    isLoading: false,
  } as Record<string, unknown>,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  AvatarUpload: ({ name, onUpload }: { name: string; onUpload: (file: File) => void }) => (
    <div data-testid="avatar-upload">
      {name}
      <button data-testid="upload-btn" onClick={() => onUpload(new File([''], 'avatar.png'))}>
        upload
      </button>
    </div>
  ),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
  ChangePasswordModal: ({
    onClose,
    onSubmit,
  }: {
    onClose: () => void;
    onSubmit: (data: Record<string, string>) => void;
  }) => (
    <div data-testid="change-password-modal">
      <button data-testid="close-pwd-modal" onClick={onClose}>
        close
      </button>
      <button
        data-testid="submit-pwd"
        onClick={() =>
          onSubmit({
            currentPassword: 'old',
            newPassword: 'New1!pass',
            confirmNewPassword: 'New1!pass',
          })
        }
      >
        submit
      </button>
    </div>
  ),
}));

vi.mock('../../../../../../packages/profile-shared/src/services/profile.service', () => ({
  useProfile: () => mockProfile.value,
  useAvatarUrl: () => ({ data: null }),
  useUploadAvatar: () => ({ mutate: vi.fn(), isPending: false }),
  useChangePassword: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('../../../../../../packages/profile-shared/src/components/EditProfileModal', () => ({
  EditProfileModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="edit-modal">
      <button data-testid="close-edit-modal" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

vi.mock('../../../../../../packages/profile-shared/src/components/ProfileInfoGrid', () => ({
  ProfileInfoGrid: () => <div data-testid="profile-info-grid" />,
}));

vi.mock('../../../../../../packages/profile-shared/src/components/ProfileSections', () => ({
  RolePermissionsSection: () => <div data-testid="permissions" />,
  ApprovalResponsibilitiesSection: () => <div data-testid="approvals" />,
  ActivityLogSection: () => <div data-testid="activity-log" />,
}));

vi.mock('../services/profile.service', () => ({
  useProfile: () => mockProfile.value,
  useAvatarUrl: () => ({ data: null }),
  useUploadAvatar: () => ({ mutate: vi.fn(), isPending: false }),
  useChangePassword: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('../ui/EditProfileModal', () => ({
  EditProfileModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="edit-modal">
      <button data-testid="close-edit-modal" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

vi.mock('../ui/ProfileInfoGrid', () => ({
  ProfileInfoGrid: () => <div data-testid="profile-info-grid" />,
}));

vi.mock('../ui/ProfileSections', () => ({
  RolePermissionsSection: () => <div data-testid="permissions" />,
  ApprovalResponsibilitiesSection: () => <div data-testid="approvals" />,
  ActivityLogSection: () => <div data-testid="activity-log" />,
}));

import { render, screen, fireEvent } from '@testing-library/react';

import UserProfilePage from './UserProfilePage';

describe('UserProfilePage', () => {
  beforeEach(() => {
    mockProfile.value = {
      data: {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        status: 'ACTIVE',
        role: 'PROCUREMENT_OFFICER',
        createdAt: '2024-01-15T10:00:00Z',
        position: 'Manager',
        company: { legalName: 'Test Corp' },
      },
      isLoading: false,
    };
  });

  it('shows spinner when loading', () => {
    mockProfile.value.isLoading = true;
    render(<UserProfilePage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('returns null when no profile', () => {
    mockProfile.value.data = undefined;
    const { container } = render(<UserProfilePage />);
    expect(container.innerHTML).toBe('');
  });

  it('renders profile data', () => {
    render(<UserProfilePage />);
    expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByTestId('avatar-upload')).toBeInTheDocument();
    expect(screen.getByTestId('profile-info-grid')).toBeInTheDocument();
    expect(screen.getByTestId('permissions')).toBeInTheDocument();
    expect(screen.getByTestId('approvals')).toBeInTheDocument();
    expect(screen.getByTestId('activity-log')).toBeInTheDocument();
  });

  it('opens edit profile modal', () => {
    render(<UserProfilePage />);
    fireEvent.click(screen.getByText('editProfile'));
    expect(screen.getByTestId('edit-modal')).toBeInTheDocument();
  });

  it('opens change password modal', () => {
    render(<UserProfilePage />);
    fireEvent.click(screen.getByText('changePassword'));
    expect(screen.getByTestId('change-password-modal')).toBeInTheDocument();
  });

  it('closes edit profile modal via onClose', () => {
    render(<UserProfilePage />);
    fireEvent.click(screen.getByText('editProfile'));
    expect(screen.getByTestId('edit-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('close-edit-modal'));
    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();
  });

  it('closes change password modal via onClose', () => {
    render(<UserProfilePage />);
    fireEvent.click(screen.getByText('changePassword'));
    expect(screen.getByTestId('change-password-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('close-pwd-modal'));
    expect(screen.queryByTestId('change-password-modal')).not.toBeInTheDocument();
  });

  it('calls onSubmit on change password modal', () => {
    render(<UserProfilePage />);
    fireEvent.click(screen.getByText('changePassword'));
    fireEvent.click(screen.getByTestId('submit-pwd'));
  });

  it('calls onUpload on avatar upload', () => {
    render(<UserProfilePage />);
    fireEvent.click(screen.getByTestId('upload-btn'));
  });
});
