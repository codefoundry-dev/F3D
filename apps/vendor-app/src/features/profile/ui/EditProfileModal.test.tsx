import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockProfile = vi.hoisted(() => ({
  value: {
    data: {
      name: 'John Doe',
      phone: '+1234567890',
      workStatus: 'available',
      position: 'Manager',
      department: 'Sales',
    },
    isLoading: false,
  },
}));

const mockUpdateMutation = vi.hoisted(() => ({
  value: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  },
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../../../../packages/profile-shared/src/services/profile.service', () => ({
  useProfile: () => mockProfile.value,
  useUpdateProfile: () => mockUpdateMutation.value,
}));

vi.mock('../services/profile.service', () => ({
  useProfile: () => mockProfile.value,
  useUpdateProfile: () => mockUpdateMutation.value,
}));

vi.mock('@forethread/ui-components', () => ({
  Modal: ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <div data-testid="modal" data-onclose={!!onClose}>
      {children}
    </div>
  ),
  ModalBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ModalCloseButton: ({ onClose }: { onClose: () => void }) => (
    <button data-testid="close-btn" onClick={onClose}>
      X
    </button>
  ),
  Input: vi
    .fn()
    .mockImplementation((props: Record<string, unknown>) => (
      <input
        data-testid={`input-${String(props.placeholder ?? props.type)}`}
        {...(props as object)}
      />
    )),
  FormField: ({ children, label }: { children: React.ReactNode; label: string }) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  ),
  Button: ({
    children,
    onClick,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: 'submit' | 'button' | 'reset';
  }) => (
    <button onClick={onClick} type={type ?? 'button'}>
      {children}
    </button>
  ),
  Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
  IconBadge: () => <span />,
  onPhoneOnly: vi.fn(),
  CustomDropdown: ({ onChange }: { onChange?: (v: string) => void }) => (
    <div data-testid="dropdown">
      {onChange && <button onClick={() => onChange('unavailable')}>change-status</button>}
    </div>
  ),
}));

vi.mock('@forethread/ui-components/assets/icons/briefcase.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/department.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit-without-line.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/id-badge.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/phone.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/user-outline.svg?react', () => ({
  default: () => <span />,
}));

import { EditProfileModal } from './EditProfileModal';

describe('EditProfileModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockProfile.value = {
      data: {
        name: 'John Doe',
        phone: '+1234567890',
        workStatus: 'available',
        position: 'Manager',
        department: 'Sales',
      },
      isLoading: false,
    };
    mockUpdateMutation.value = {
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    };
  });

  it('renders modal with title', () => {
    render(<EditProfileModal onClose={onClose} />);
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('editModal.title')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    render(<EditProfileModal onClose={onClose} />);
    expect(screen.getByText('editModal.subtitle')).toBeInTheDocument();
  });

  it('renders form fields', () => {
    render(<EditProfileModal onClose={onClose} />);
    expect(screen.getByText('editModal.fullName')).toBeInTheDocument();
    expect(screen.getByText('editModal.phone')).toBeInTheDocument();
    expect(screen.getByText('editModal.workStatus')).toBeInTheDocument();
  });

  it('renders submit and cancel buttons', () => {
    render(<EditProfileModal onClose={onClose} />);
    expect(screen.getByText('editModal.submitChanges')).toBeInTheDocument();
    expect(screen.getByText('common:cancel')).toBeInTheDocument();
  });

  it('shows submitting label when pending', () => {
    mockUpdateMutation.value = { ...mockUpdateMutation.value, isPending: true };
    render(<EditProfileModal onClose={onClose} />);
    expect(screen.getByText('editModal.submitting')).toBeInTheDocument();
  });

  it('shows error alert when mutation fails', () => {
    mockUpdateMutation.value = { ...mockUpdateMutation.value, isError: true };
    render(<EditProfileModal onClose={onClose} />);
    expect(screen.getByTestId('alert')).toBeInTheDocument();
    expect(screen.getByText('editModal.updateError')).toBeInTheDocument();
  });

  it('calls onClose when cancel button clicked', () => {
    render(<EditProfileModal onClose={onClose} />);
    fireEvent.click(screen.getByText('common:cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button clicked', () => {
    render(<EditProfileModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('close-btn'));
    expect(onClose).toHaveBeenCalled();
  });

  it('submits form with profile data', async () => {
    mockUpdateMutation.value.mutate = vi.fn((_data, opts) => {
      opts?.onSuccess?.();
    });
    render(<EditProfileModal onClose={onClose} />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('editModal.submitChanges'));
    });
  });
});
