import { render, screen, fireEvent } from '@testing-library/react';
import { forwardRef } from 'react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Modal: ({ children, onClose }: any) => (
    <div data-testid="modal">
      {children}
      <button onClick={onClose}>modal-close</button>
    </div>
  ),
  ModalBody: ({ children }: any) => <div data-testid="modal-body">{children}</div>,
  ModalCloseButton: ({ onClose }: any) => (
    <button data-testid="modal-close-btn" onClick={onClose}>
      X
    </button>
  ),
  Input: forwardRef(({ placeholder, leftIcon: _leftIcon, ...rest }: any, ref: any) => (
    <input
      ref={ref}
      data-testid={`input-${rest.name ?? 'unknown'}`}
      placeholder={placeholder}
      {...rest}
    />
  )),
  FormField: ({ label, error, children, required }: any) => (
    <div data-testid={`field-${label}`} data-required={required}>
      <label>{label}</label>
      {error && <span data-testid="field-error">{error}</span>}
      {children}
    </div>
  ),
  Button: ({ children, onClick, type, isLoading, variant }: any) => (
    <button
      data-testid={`btn-${type ?? 'button'}`}
      data-variant={variant}
      data-loading={isLoading}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  ),
  Alert: ({ children, variant }: any) => (
    <div data-testid="alert" data-variant={variant}>
      {children}
    </div>
  ),
  IconBadge: ({ icon }: any) => <div data-testid="icon-badge">{icon}</div>,
  onPhoneOnly: vi.fn(),
  CustomDropdown: ({ options, value, onChange, placeholder }: any) => (
    <select data-testid="custom-dropdown" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('@forethread/ui-components/assets/icons/briefcase.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/department.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit-without-line.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/id-badge.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/phone.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/user-outline.svg?react', () => ({
  default: () => <div />,
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => () => ({ values: {}, errors: {} }),
}));

const mockMutate = vi.hoisted(() => vi.fn());
const mockUseProfile = vi.fn();
const mockUseUpdateProfile = vi.fn();

vi.mock('../../../../../../packages/profile-shared/src/services/profile.service', () => ({
  useProfile: () => mockUseProfile(),
  useUpdateProfile: () => mockUseUpdateProfile(),
  useAvatarUrl: () => ({ data: undefined }),
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

vi.mock('../services/profile.service', () => ({
  useProfile: () => mockUseProfile(),
  useUpdateProfile: () => mockUseUpdateProfile(),
}));

const mockReset = vi.hoisted(() => vi.fn());
const capturedEffect = vi.hoisted(() => ({ fn: null as any }));
const mockFormHandleSubmit = vi.hoisted(() =>
  vi.fn((cb: any) => (e: any) => {
    e?.preventDefault?.();
    return cb({
      name: 'Alice',
      phone: '+123',
      workStatus: 'available',
      position: 'Manager',
      department: 'Eng',
    });
  }),
);

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useEffect: (fn: any) => {
      capturedEffect.fn = fn;
    },
    useMemo: (fn: any) => fn(),
  };
});

vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: vi.fn((name: string) => ({ name })),
    handleSubmit: mockFormHandleSubmit,
    reset: mockReset,
    control: {},
    formState: { errors: {} },
  }),
  Controller: ({ render: renderProp }: any) =>
    renderProp({ field: { value: '', onChange: vi.fn() } }),
}));

vi.mock('zod', () => ({
  z: {
    object: () => ({
      _def: {},
    }),
    string: () => ({
      min: () => ({ optional: () => ({}) }),
      optional: () => ({}),
    }),
  },
}));

import { EditProfileModal } from './EditProfileModal';

const mockProfile = {
  name: 'Alice Smith',
  phone: '+123456789',
  workStatus: 'available',
  position: 'Manager',
  department: 'Engineering',
};

describe('EditProfileModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProfile.mockReturnValue({ data: mockProfile });
    mockMutate.mockClear();
    mockUseUpdateProfile.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
    });
  });

  it('renders the modal with title and subtitle', () => {
    render(<EditProfileModal onClose={onClose} />);
    expect(screen.getByText('editModal.title')).toBeInTheDocument();
    expect(screen.getByText('editModal.subtitle')).toBeInTheDocument();
  });

  it('renders form fields', () => {
    render(<EditProfileModal onClose={onClose} />);
    expect(screen.getByText('editModal.fullName')).toBeInTheDocument();
    expect(screen.getByText('editModal.phone')).toBeInTheDocument();
    expect(screen.getByText('editModal.workStatus')).toBeInTheDocument();
    expect(screen.getByText('editModal.position')).toBeInTheDocument();
    expect(screen.getByText('editModal.department')).toBeInTheDocument();
  });

  it('renders submit and cancel buttons', () => {
    render(<EditProfileModal onClose={onClose} />);
    expect(screen.getByText('editModal.submitChanges')).toBeInTheDocument();
    expect(screen.getByText('common:cancel')).toBeInTheDocument();
  });

  it('shows submitting text when mutation is pending', () => {
    mockUseUpdateProfile.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      isError: false,
    });
    render(<EditProfileModal onClose={onClose} />);
    expect(screen.getByText('editModal.submitting')).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    render(<EditProfileModal onClose={onClose} />);
    fireEvent.click(screen.getByText('common:cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when modal close button is clicked', () => {
    render(<EditProfileModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('modal-close-btn'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders error alert when mutation fails', () => {
    mockUseUpdateProfile.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
    });
    render(<EditProfileModal onClose={onClose} />);
    expect(screen.getByTestId('alert')).toBeInTheDocument();
    expect(screen.getByText('editModal.updateError')).toBeInTheDocument();
  });

  it('does not render error alert when no error', () => {
    render(<EditProfileModal onClose={onClose} />);
    expect(screen.queryByTestId('alert')).not.toBeInTheDocument();
  });

  it('renders icon badge', () => {
    render(<EditProfileModal onClose={onClose} />);
    expect(screen.getByTestId('icon-badge')).toBeInTheDocument();
  });

  it('renders work status dropdown', () => {
    render(<EditProfileModal onClose={onClose} />);
    expect(screen.getByTestId('custom-dropdown')).toBeInTheDocument();
  });

  it('renders optional labels for position and department', () => {
    render(<EditProfileModal onClose={onClose} />);
    const optionalTexts = screen.getAllByText('(common:optional)');
    expect(optionalTexts).toHaveLength(2);
  });

  it('submits the form and calls mutate with correct data', () => {
    render(<EditProfileModal onClose={onClose} />);
    const submitButton = screen.getByText('editModal.submitChanges');
    fireEvent.click(submitButton);
    expect(mockMutate).toHaveBeenCalledWith(
      {
        name: 'Alice',
        phone: '+123',
        position: 'Manager',
        workStatus: 'available',
        department: 'Eng',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('onSuccess callback calls onClose', () => {
    render(<EditProfileModal onClose={onClose} />);
    fireEvent.click(screen.getByText('editModal.submitChanges'));
    const onSuccessCb = mockMutate.mock.calls[0][1].onSuccess;
    onSuccessCb();
    expect(onClose).toHaveBeenCalled();
  });

  it('converts undefined fields to undefined in submit', () => {
    mockFormHandleSubmit.mockImplementationOnce((cb: any) => (e: any) => {
      e?.preventDefault?.();
      return cb({
        name: 'Alice',
        phone: undefined,
        workStatus: undefined,
        position: undefined,
        department: undefined,
      });
    });
    render(<EditProfileModal onClose={onClose} />);
    fireEvent.click(screen.getByText('editModal.submitChanges'));
    expect(mockMutate).toHaveBeenCalledWith(
      {
        name: 'Alice',
        phone: undefined,
        position: undefined,
        workStatus: undefined,
        department: undefined,
      },
      expect.any(Object),
    );
  });

  it('renders work status dropdown', () => {
    render(<EditProfileModal onClose={onClose} />);
    const dropdown = screen.getByTestId('custom-dropdown');
    expect(dropdown).toBeInTheDocument();
  });

  it('renders with null profile data', () => {
    mockUseProfile.mockReturnValue({ data: null });
    render(<EditProfileModal onClose={onClose} />);
    expect(screen.getByText('editModal.title')).toBeInTheDocument();
  });

  it('useEffect resets form when profile data is available', () => {
    render(<EditProfileModal onClose={onClose} />);
    if (capturedEffect.fn) {
      capturedEffect.fn();
    }
    expect(mockReset).toHaveBeenCalledWith({
      name: 'Alice Smith',
      phone: '+123456789',
      workStatus: 'available',
      position: 'Manager',
      department: 'Engineering',
    });
  });

  it('useEffect does not reset form when profile is null', () => {
    mockUseProfile.mockReturnValue({ data: null });
    render(<EditProfileModal onClose={onClose} />);
    if (capturedEffect.fn) {
      capturedEffect.fn();
    }
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('useEffect handles profile with null optional fields', () => {
    mockUseProfile.mockReturnValue({
      data: { name: 'Alice', phone: null, workStatus: null, position: null, department: null },
    });
    render(<EditProfileModal onClose={onClose} />);
    if (capturedEffect.fn) {
      capturedEffect.fn();
    }
    expect(mockReset).toHaveBeenCalledWith({
      name: 'Alice',
      phone: '',
      workStatus: '',
      position: '',
      department: '',
    });
  });
});
