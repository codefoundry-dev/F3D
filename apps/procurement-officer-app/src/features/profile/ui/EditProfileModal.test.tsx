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
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
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
      name: 'John Doe',
      phone: '123',
      workStatus: 'available',
      position: 'Manager',
      department: 'IT',
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
  name: 'John Doe',
  phone: '123',
  workStatus: 'available',
  position: 'Manager',
  department: 'IT',
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

  it('renders form fields', () => {
    render(<EditProfileModal onClose={onClose} />);
    expect(screen.getByText('editModal.title')).toBeInTheDocument();
    expect(screen.getByText('editModal.fullName')).toBeInTheDocument();
    expect(screen.getByText('editModal.phone')).toBeInTheDocument();
    expect(screen.getByText('editModal.submitChanges')).toBeInTheDocument();
  });

  it('shows submitting label when pending', () => {
    mockUseUpdateProfile.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
      isError: false,
    });
    render(<EditProfileModal onClose={onClose} />);
    expect(screen.getByText('editModal.submitting')).toBeInTheDocument();
  });

  it('shows error alert on mutation error', () => {
    mockUseUpdateProfile.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
    });
    render(<EditProfileModal onClose={onClose} />);
    expect(screen.getByTestId('alert')).toHaveTextContent('editModal.updateError');
  });

  it('calls onClose when cancel clicked', () => {
    render(<EditProfileModal onClose={onClose} />);
    fireEvent.click(screen.getByText('common:cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when modal close button clicked', () => {
    render(<EditProfileModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('modal-close-btn'));
    expect(onClose).toHaveBeenCalled();
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

  it('submits the form and calls mutate', () => {
    render(<EditProfileModal onClose={onClose} />);
    fireEvent.click(screen.getByText('editModal.submitChanges'));
    expect(mockMutate).toHaveBeenCalledWith(
      {
        name: 'John Doe',
        phone: '123',
        position: 'Manager',
        workStatus: 'available',
        department: 'IT',
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

  it('useEffect resets form when profile data is available', () => {
    render(<EditProfileModal onClose={onClose} />);
    if (capturedEffect.fn) {
      capturedEffect.fn();
    }
    expect(mockReset).toHaveBeenCalledWith({
      name: 'John Doe',
      phone: '123',
      workStatus: 'available',
      position: 'Manager',
      department: 'IT',
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

  it('submits with empty optional fields converting to undefined', () => {
    mockFormHandleSubmit.mockImplementation((cb: any) => (e: any) => {
      e?.preventDefault?.();
      return cb({
        name: 'John Doe',
        phone: '',
        workStatus: '',
        position: '',
        department: '',
      });
    });
    render(<EditProfileModal onClose={onClose} />);
    fireEvent.click(screen.getByText('editModal.submitChanges'));
    expect(mockMutate).toHaveBeenCalledWith(
      {
        name: 'John Doe',
        phone: '',
        position: '',
        workStatus: '',
        department: '',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('submits with null optional fields converting to undefined via ??', () => {
    mockFormHandleSubmit.mockImplementation((cb: any) => (e: any) => {
      e?.preventDefault?.();
      return cb({
        name: 'John Doe',
        phone: null,
        workStatus: null,
        position: null,
        department: null,
      });
    });
    render(<EditProfileModal onClose={onClose} />);
    fireEvent.click(screen.getByText('editModal.submitChanges'));
    expect(mockMutate).toHaveBeenCalledWith(
      {
        name: 'John Doe',
        phone: undefined,
        position: undefined,
        workStatus: undefined,
        department: undefined,
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('resets form with null profile fields using ?? fallback', () => {
    mockUseProfile.mockReturnValue({
      data: {
        name: 'Jane',
        phone: null,
        workStatus: null,
        position: null,
        department: null,
      },
    });
    render(<EditProfileModal onClose={onClose} />);
    if (capturedEffect.fn) {
      capturedEffect.fn();
    }
    expect(mockReset).toHaveBeenCalledWith({
      name: 'Jane',
      phone: '',
      workStatus: '',
      position: '',
      department: '',
    });
  });
});
