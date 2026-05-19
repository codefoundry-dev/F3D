import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: ({ size }: any) => <div data-testid="spinner" data-size={size} />,
  Button: ({ children, onClick, variant }: any) => (
    <button data-testid={`btn-${variant ?? 'default'}`} onClick={onClick}>
      {children}
    </button>
  ),
  AvatarUpload: ({ name, avatarUrl, isUploading, onUpload }: any) => (
    <div
      data-testid="avatar-upload"
      data-name={name}
      data-url={avatarUrl}
      data-uploading={isUploading}
    >
      <button onClick={() => onUpload(new File([''], 'test.png'))}>upload</button>
    </div>
  ),
  ChangePasswordModal: ({ onClose, onSubmit, labels, rules }: any) => (
    <div data-testid="change-password-modal">
      <span>{labels.title}</span>
      <button onClick={onClose}>close-pw</button>
      <button onClick={() => onSubmit({ currentPassword: 'old', newPassword: 'new' })}>
        submit-pw
      </button>
      {rules && (
        <div data-testid="password-rules">
          {rules.map((rule: any) => (
            <span
              key={rule.key}
              data-testid={`rule-${rule.key}`}
              data-result={String(rule.test('Abc1!xyz'))}
            >
              {rule.label}
            </span>
          ))}
        </div>
      )}
    </div>
  ),
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

const mockUseProfile = vi.fn();
const mockUseAvatarUrl = vi.fn();
const mockUseUploadAvatar = vi.fn();
const mockUseChangePassword = vi.fn();

vi.mock('../../../../../../packages/profile-shared/src/services/profile.service', () => ({
  useProfile: () => mockUseProfile(),
  useAvatarUrl: () => mockUseAvatarUrl(),
  useUploadAvatar: () => mockUseUploadAvatar(),
  useChangePassword: () => mockUseChangePassword(),
}));

vi.mock('../../../../../../packages/profile-shared/src/components/EditProfileModal', () => ({
  EditProfileModal: ({ onClose }: any) => (
    <div data-testid="edit-profile-modal">
      <button onClick={onClose}>close-edit</button>
    </div>
  ),
}));

vi.mock('../../../../../../packages/profile-shared/src/components/ProfileInfoGrid', () => ({
  ProfileInfoGrid: (props: any) => <div data-testid="profile-info-grid" data-phone={props.phone} />,
}));

vi.mock('../../../../../../packages/profile-shared/src/components/ProfileSections', () => ({
  RolePermissionsSection: () => <div data-testid="role-permissions" />,
  ApprovalResponsibilitiesSection: () => <div data-testid="approval-responsibilities" />,
  ActivityLogSection: ({ userId }: any) => <div data-testid="activity-log" data-userid={userId} />,
}));

vi.mock('../services/profile.service', () => ({
  useProfile: () => mockUseProfile(),
  useAvatarUrl: () => mockUseAvatarUrl(),
  useUploadAvatar: () => mockUseUploadAvatar(),
  useChangePassword: () => mockUseChangePassword(),
}));

vi.mock('../ui/EditProfileModal', () => ({
  EditProfileModal: ({ onClose }: any) => (
    <div data-testid="edit-profile-modal">
      <button onClick={onClose}>close-edit</button>
    </div>
  ),
}));

vi.mock('../ui/ProfileInfoGrid', () => ({
  ProfileInfoGrid: (props: any) => <div data-testid="profile-info-grid" data-phone={props.phone} />,
}));

vi.mock('../ui/ProfileSections', () => ({
  RolePermissionsSection: () => <div data-testid="role-permissions" />,
  ApprovalResponsibilitiesSection: () => <div data-testid="approval-responsibilities" />,
  ActivityLogSection: ({ userId }: any) => <div data-testid="activity-log" data-userid={userId} />,
}));

import UserProfilePage from './UserProfilePage';

const mockProfile = {
  id: 'u1',
  name: 'Alice Smith',
  email: 'alice@example.com',
  phone: '+123456789',
  status: 'ACTIVE',
  role: 'COMPANY_ADMIN',
  createdAt: '2026-01-01T00:00:00Z',
  position: 'Manager',
  company: { legalName: 'Test Corp' },
};

describe('UserProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProfile.mockReturnValue({ data: mockProfile, isLoading: false });
    mockUseAvatarUrl.mockReturnValue({ data: 'https://example.com/avatar.png' });
    mockUseUploadAvatar.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUseChangePassword.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
      reset: vi.fn(),
    });
  });

  it('renders spinner when loading', () => {
    mockUseProfile.mockReturnValue({ data: undefined, isLoading: true });
    render(<UserProfilePage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders nothing when profile is null and not loading', () => {
    mockUseProfile.mockReturnValue({ data: null, isLoading: false });
    const { container } = render(<UserProfilePage />);
    expect(container.innerHTML).toBe('');
  });

  it('renders profile name and email', () => {
    render(<UserProfilePage />);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });

  it('renders avatar upload component', () => {
    render(<UserProfilePage />);
    const avatar = screen.getByTestId('avatar-upload');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('data-name', 'Alice Smith');
  });

  it('renders profile info grid', () => {
    render(<UserProfilePage />);
    expect(screen.getByTestId('profile-info-grid')).toBeInTheDocument();
  });

  it('renders profile sections', () => {
    render(<UserProfilePage />);
    expect(screen.getByTestId('role-permissions')).toBeInTheDocument();
    expect(screen.getByTestId('approval-responsibilities')).toBeInTheDocument();
    expect(screen.getByTestId('activity-log')).toBeInTheDocument();
  });

  it('passes userId to ActivityLogSection', () => {
    render(<UserProfilePage />);
    expect(screen.getByTestId('activity-log')).toHaveAttribute('data-userid', 'u1');
  });

  it('renders edit profile and change password buttons', () => {
    render(<UserProfilePage />);
    expect(screen.getByText('editProfile')).toBeInTheDocument();
    expect(screen.getByText('changePassword')).toBeInTheDocument();
  });

  it('opens edit profile modal when edit button is clicked', () => {
    render(<UserProfilePage />);
    expect(screen.queryByTestId('edit-profile-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('editProfile'));
    expect(screen.getByTestId('edit-profile-modal')).toBeInTheDocument();
  });

  it('closes edit profile modal', () => {
    render(<UserProfilePage />);
    fireEvent.click(screen.getByText('editProfile'));
    expect(screen.getByTestId('edit-profile-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('close-edit'));
    expect(screen.queryByTestId('edit-profile-modal')).not.toBeInTheDocument();
  });

  it('opens change password modal when change password button is clicked', () => {
    render(<UserProfilePage />);
    expect(screen.queryByTestId('change-password-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('changePassword'));
    expect(screen.getByTestId('change-password-modal')).toBeInTheDocument();
  });

  it('closes change password modal and calls reset', () => {
    const mockReset = vi.fn();
    mockUseChangePassword.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
      reset: mockReset,
    });
    render(<UserProfilePage />);
    fireEvent.click(screen.getByText('changePassword'));
    fireEvent.click(screen.getByText('close-pw'));
    expect(screen.queryByTestId('change-password-modal')).not.toBeInTheDocument();
    expect(mockReset).toHaveBeenCalled();
  });

  it('calls changePassword mutate when submitting password', () => {
    const mockMutate = vi.fn();
    mockUseChangePassword.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
      reset: vi.fn(),
    });
    render(<UserProfilePage />);
    fireEvent.click(screen.getByText('changePassword'));
    fireEvent.click(screen.getByText('submit-pw'));
    expect(mockMutate).toHaveBeenCalledWith({
      currentPassword: 'old',
      newPassword: 'new',
    });
  });

  it('calls uploadAvatar mutate on avatar upload', () => {
    const mockMutate = vi.fn();
    mockUseUploadAvatar.mockReturnValue({ mutate: mockMutate, isPending: false });
    render(<UserProfilePage />);
    fireEvent.click(screen.getByText('upload'));
    expect(mockMutate).toHaveBeenCalled();
  });

  it('exercises password rules test functions', () => {
    render(<UserProfilePage />);
    fireEvent.click(screen.getByText('changePassword'));
    expect(screen.getByTestId('password-rules')).toBeInTheDocument();
    // All rules are exercised by the mock with 'Abc1!xyz' which passes all rules
    expect(screen.getByTestId('rule-minLength')).toHaveAttribute('data-result', 'true');
    expect(screen.getByTestId('rule-lowercase')).toHaveAttribute('data-result', 'true');
    expect(screen.getByTestId('rule-uppercase')).toHaveAttribute('data-result', 'true');
    expect(screen.getByTestId('rule-number')).toHaveAttribute('data-result', 'true');
    expect(screen.getByTestId('rule-special')).toHaveAttribute('data-result', 'true');
  });
});
