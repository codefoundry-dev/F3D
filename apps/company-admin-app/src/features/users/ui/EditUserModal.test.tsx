import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Modal: ({ children }: any) => <div data-testid="modal">{children}</div>,
  ModalBody: ({ children }: any) => <div data-testid="modal-body">{children}</div>,
  ModalCloseButton: ({ onClose }: any) => <button data-testid="modal-close" onClick={onClose} />,
  Input: (props: any) => <input data-testid={`input-${props.type ?? 'text'}`} {...props} />,
  FormField: ({ children, label, error }: any) => (
    <div data-testid="form-field">
      <label>{label}</label>
      {error && <span data-testid="field-error">{error}</span>}
      {children}
    </div>
  ),
  Button: ({ children, onClick, type, isLoading }: any) => (
    <button data-testid={`btn-${type ?? 'button'}`} onClick={onClick} disabled={isLoading}>
      {children}
    </button>
  ),
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  IconBadge: ({ icon }: any) => <div data-testid="icon-badge">{icon}</div>,
  CustomDropdown: ({ placeholder }: any) => <div data-testid="dropdown">{placeholder}</div>,
  Spinner: () => <div data-testid="spinner" />,
  onPhoneOnly: vi.fn(),
}));

const svgIcons = [
  'briefcase',
  'department',
  'edit-without-line',
  'envelope-simple',
  'id-badge',
  'phone',
  'user-outline',
];
svgIcons.forEach((name) => {
  vi.mock(`@forethread/ui-components/assets/icons/${name}.svg?react`, () => ({
    default: () => <div />,
  }));
});

const mockForm = vi.hoisted(() => ({
  register: vi.fn(() => ({})),
  control: {},
  formState: { errors: {} },
}));

const mockUpdateMutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}));

const mockEditFormReturn = vi.hoisted(() => ({
  form: mockForm,
  handleSubmit: vi.fn(),
  updateMutation: mockUpdateMutation,
  isLoadingUser: false,
}));

vi.mock('../hooks/useEditUserForm', () => ({
  useEditUserForm: vi.fn(() => mockEditFormReturn),
}));

vi.mock('../hooks/useRoleOptions', () => ({
  useRoleOptions: vi.fn(() => [{ value: 'COMPANY_ADMIN', label: 'Company Admin' }]),
}));

vi.mock('react-hook-form', () => ({
  Controller: ({ render }: any) => render({ field: { value: '', onChange: vi.fn() } }),
}));

import { EditUserModal } from './EditUserModal';

describe('EditUserModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMutation.isError = false;
    mockUpdateMutation.isPending = false;
    mockEditFormReturn.isLoadingUser = false;
  });

  it('renders the modal', () => {
    render(<EditUserModal onClose={mockOnClose} />);
    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });

  it('renders the title', () => {
    render(<EditUserModal onClose={mockOnClose} />);
    expect(screen.getByText('editModal.title')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    render(<EditUserModal onClose={mockOnClose} />);
    expect(screen.getByText('editModal.subtitle')).toBeInTheDocument();
  });

  it('renders full name field', () => {
    render(<EditUserModal onClose={mockOnClose} />);
    expect(screen.getByText('editModal.fullName')).toBeInTheDocument();
  });

  it('renders email field', () => {
    render(<EditUserModal onClose={mockOnClose} />);
    expect(screen.getByText('editModal.email')).toBeInTheDocument();
  });

  it('renders phone field', () => {
    render(<EditUserModal onClose={mockOnClose} />);
    expect(screen.getByText('editModal.phone')).toBeInTheDocument();
  });

  it('renders role field', () => {
    render(<EditUserModal onClose={mockOnClose} />);
    expect(screen.getByText('editModal.role')).toBeInTheDocument();
  });

  it('renders position field with optional label', () => {
    render(<EditUserModal onClose={mockOnClose} />);
    expect(screen.getByText('editModal.position')).toBeInTheDocument();
    // "common:optional" is inside a nested span, so use a text matcher function
    expect(
      screen.getAllByText((_content, el) => el?.textContent?.includes('common:optional') ?? false)
        .length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('renders department field with optional label', () => {
    render(<EditUserModal onClose={mockOnClose} />);
    expect(screen.getByText('editModal.department')).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(<EditUserModal onClose={mockOnClose} />);
    expect(screen.getByText('editModal.submitChanges')).toBeInTheDocument();
  });

  it('renders cancel button', () => {
    render(<EditUserModal onClose={mockOnClose} />);
    expect(screen.getByText('common:cancel')).toBeInTheDocument();
  });

  it('shows submitting text when pending', () => {
    mockUpdateMutation.isPending = true;
    render(<EditUserModal onClose={mockOnClose} />);
    expect(screen.getByText('editModal.submitting')).toBeInTheDocument();
  });

  it('shows error alert on mutation error', () => {
    mockUpdateMutation.isError = true;
    render(<EditUserModal onClose={mockOnClose} />);
    expect(screen.getByTestId('alert')).toBeInTheDocument();
    expect(screen.getByText('editModal.updateError')).toBeInTheDocument();
  });

  it('shows spinner when loading user', () => {
    mockEditFormReturn.isLoadingUser = true;
    render(<EditUserModal onClose={mockOnClose} />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('does not show form when loading user', () => {
    mockEditFormReturn.isLoadingUser = true;
    render(<EditUserModal onClose={mockOnClose} />);
    expect(screen.queryByText('editModal.title')).not.toBeInTheDocument();
  });

  it('submits the form when submit button is clicked', () => {
    render(<EditUserModal onClose={mockOnClose} />);
    const submitButton = screen.getByText('editModal.submitChanges');
    fireEvent.click(submitButton);
    expect(submitButton).toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<EditUserModal onClose={mockOnClose} />);
    fireEvent.click(screen.getByText('common:cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays validation errors for form fields', () => {
    mockForm.formState.errors = {
      name: { message: 'Name is required' },
      email: { message: 'Email is required' },
      phone: { message: 'Phone is invalid' },
      role: { message: 'Role is required' },
    };
    render(<EditUserModal onClose={mockOnClose} />);
    const errors = screen.getAllByTestId('field-error');
    expect(errors).toHaveLength(4);
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Phone is invalid')).toBeInTheDocument();
    expect(screen.getByText('Role is required')).toBeInTheDocument();
    mockForm.formState.errors = {};
  });
});
