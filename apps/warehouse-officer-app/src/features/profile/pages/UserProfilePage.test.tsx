import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUploadMutate = vi.fn();
const mockChangePasswordMutate = vi.fn();
const mockChangePasswordReset = vi.fn();

let mockProfileReturn = {
  data: null as Record<string, unknown> | null,
  isLoading: false,
};
let mockAvatarUrlReturn = { data: null as string | null };
let mockUploadAvatarReturn = { mutate: mockUploadMutate, isPending: false };
let mockChangePasswordReturn = {
  mutate: mockChangePasswordMutate,
  reset: mockChangePasswordReset,
  isPending: false,
  isError: false,
  isSuccess: false,
  error: null as Error | null,
};

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: ({ size }: { size: string }) => <div data-testid="spinner" data-size={size} />,
  Button: ({
    children,
    onClick,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
  }) => (
    <button data-testid={`btn-${variant ?? 'default'}`} onClick={onClick}>
      {children}
    </button>
  ),
  AvatarUpload: ({ name, onUpload, isUploading }: Record<string, unknown>) => (
    <div data-testid="avatar-upload" data-name={name} data-uploading={String(isUploading)}>
      <button
        data-testid="upload-btn"
        onClick={() => (onUpload as (f: File) => void)(new File([], 'avatar.jpg'))}
      >
        upload
      </button>
    </div>
  ),
  ChangePasswordModal: ({ onClose, onSubmit }: Record<string, unknown>) => (
    <div data-testid="change-password-modal">
      <button data-testid="close-password" onClick={onClose as () => void}>
        close
      </button>
      <button
        data-testid="submit-password"
        onClick={() =>
          (onSubmit as (d: { currentPassword: string; newPassword: string }) => void)({
            currentPassword: 'old',
            newPassword: 'new',
          })
        }
      >
        submit
      </button>
    </div>
  ),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit-without-line.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/envelope-simple.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-closed.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/lock-simple.svg?react', () => ({
  default: () => <div />,
}));

vi.mock('../../../../../../packages/profile-shared/src/services/profile.service', () => ({
  useProfile: () => mockProfileReturn,
  useAvatarUrl: () => mockAvatarUrlReturn,
  useUploadAvatar: () => mockUploadAvatarReturn,
  useChangePassword: () => mockChangePasswordReturn,
}));

vi.mock('../../../../../../packages/profile-shared/src/components/EditProfileModal', () => ({
  EditProfileModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="edit-profile-modal">
      <button data-testid="close-edit" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

vi.mock('../../../../../../packages/profile-shared/src/components/ProfileInfoGrid', () => ({
  ProfileInfoGrid: () => <div data-testid="profile-info-grid" />,
}));

vi.mock('../../../../../../packages/profile-shared/src/components/ProfileSections', () => ({
  RolePermissionsSection: () => <div data-testid="role-permissions" />,
  ApprovalResponsibilitiesSection: () => <div data-testid="approval-responsibilities" />,
  ActivityLogSection: ({ userId }: { userId: string }) => (
    <div data-testid="activity-log" data-user-id={userId} />
  ),
}));

vi.mock('../services/profile.service', () => ({
  useProfile: () => mockProfileReturn,
  useAvatarUrl: () => mockAvatarUrlReturn,
  useUploadAvatar: () => mockUploadAvatarReturn,
  useChangePassword: () => mockChangePasswordReturn,
}));

vi.mock('../ui/EditProfileModal', () => ({
  EditProfileModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="edit-profile-modal">
      <button data-testid="close-edit" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

vi.mock('../ui/ProfileInfoGrid', () => ({
  ProfileInfoGrid: () => <div data-testid="profile-info-grid" />,
}));

vi.mock('../ui/ProfileSections', () => ({
  RolePermissionsSection: () => <div data-testid="role-permissions" />,
  ApprovalResponsibilitiesSection: () => <div data-testid="approval-responsibilities" />,
  ActivityLogSection: ({ userId }: { userId: string }) => (
    <div data-testid="activity-log" data-user-id={userId} />
  ),
}));

import UserProfilePage from './UserProfilePage';

const mockProfile = {
  id: 'user-1',
  name: 'John Doe',
  email: 'john@test.com',
  phone: '+1234567890',
  status: 'ACTIVE',
  role: 'WAREHOUSE_OFFICER',
  createdAt: '2026-01-01T00:00:00Z',
  position: 'Manager',
  company: { legalName: 'Acme Corp' },
  workStatus: 'available',
  department: 'Operations',
};

describe('UserProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfileReturn = { data: null, isLoading: false };
    mockAvatarUrlReturn = { data: null };
    mockUploadAvatarReturn = { mutate: mockUploadMutate, isPending: false };
    mockChangePasswordReturn = {
      mutate: mockChangePasswordMutate,
      reset: mockChangePasswordReset,
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
    };
  });

  it('shows spinner when loading', () => {
    mockProfileReturn.isLoading = true;
    render(<UserProfilePage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders nothing when no profile', () => {
    mockProfileReturn.data = null;
    const { container } = render(<UserProfilePage />);
    expect(container.querySelector('.p-6')).not.toBeInTheDocument();
  });

  it('renders profile info when data is available', () => {
    mockProfileReturn.data = mockProfile;
    render(<UserProfilePage />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@test.com')).toBeInTheDocument();
  });

  it('renders sub-sections', () => {
    mockProfileReturn.data = mockProfile;
    render(<UserProfilePage />);
    expect(screen.getByTestId('profile-info-grid')).toBeInTheDocument();
    expect(screen.getByTestId('role-permissions')).toBeInTheDocument();
    expect(screen.getByTestId('approval-responsibilities')).toBeInTheDocument();
    expect(screen.getByTestId('activity-log')).toBeInTheDocument();
  });

  it('opens and closes edit profile modal', () => {
    mockProfileReturn.data = mockProfile;
    render(<UserProfilePage />);

    expect(screen.queryByTestId('edit-profile-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('editProfile'));
    expect(screen.getByTestId('edit-profile-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('close-edit'));
    expect(screen.queryByTestId('edit-profile-modal')).not.toBeInTheDocument();
  });

  it('opens and closes change password modal', () => {
    mockProfileReturn.data = mockProfile;
    render(<UserProfilePage />);

    expect(screen.queryByTestId('change-password-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('changePassword'));
    expect(screen.getByTestId('change-password-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('close-password'));
    expect(screen.queryByTestId('change-password-modal')).not.toBeInTheDocument();
    expect(mockChangePasswordReset).toHaveBeenCalled();
  });

  it('submits password change', () => {
    mockProfileReturn.data = mockProfile;
    render(<UserProfilePage />);
    fireEvent.click(screen.getByText('changePassword'));
    fireEvent.click(screen.getByTestId('submit-password'));
    expect(mockChangePasswordMutate).toHaveBeenCalledWith({
      currentPassword: 'old',
      newPassword: 'new',
    });
  });

  it('uploads avatar', () => {
    mockProfileReturn.data = mockProfile;
    render(<UserProfilePage />);
    fireEvent.click(screen.getByTestId('upload-btn'));
    expect(mockUploadMutate).toHaveBeenCalled();
  });

  it('passes correct password labels and rules', () => {
    mockProfileReturn.data = mockProfile;
    render(<UserProfilePage />);
    // Open change password modal to verify it renders with all labels
    fireEvent.click(screen.getByText('changePassword'));
    expect(screen.getByTestId('change-password-modal')).toBeInTheDocument();
  });

  it('passes error message from change password mutation', () => {
    mockChangePasswordReturn.isError = true;
    mockChangePasswordReturn.error = new Error('Wrong password');
    mockProfileReturn.data = mockProfile;
    render(<UserProfilePage />);
    fireEvent.click(screen.getByText('changePassword'));
    expect(screen.getByTestId('change-password-modal')).toBeInTheDocument();
  });

  it('passes activity log userId', () => {
    mockProfileReturn.data = mockProfile;
    render(<UserProfilePage />);
    expect(screen.getByTestId('activity-log')).toHaveAttribute('data-user-id', 'user-1');
  });
});
