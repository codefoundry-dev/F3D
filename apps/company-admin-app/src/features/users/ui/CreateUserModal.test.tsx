import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Modal: ({ children }: any) => <div data-testid="modal">{children}</div>,
  ModalBody: ({ children }: any) => <div data-testid="modal-body">{children}</div>,
  ModalCloseButton: ({ onClose }: any) => <button data-testid="modal-close" onClick={onClose} />,
  Input: (props: any) => <input data-testid={`input-${props.type}`} {...props} />,
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
}));

const svgIcons = ['briefcase', 'envelope-simple', 'id-badge', 'info', 'new-user', 'user-outline'];
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

const mockCreateMutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}));

vi.mock('../hooks/useCreateUserForm', () => ({
  useCreateUserForm: vi.fn(() => ({
    form: mockForm,
    handleSubmit: vi.fn(),
    createMutation: mockCreateMutation,
    isEmailInUseError: false,
  })),
}));

vi.mock('../hooks/useRoleOptions', () => ({
  useRoleOptions: vi.fn(() => [{ value: 'COMPANY_ADMIN', label: 'Company Admin' }]),
}));

vi.mock('react-hook-form', () => ({
  Controller: ({ render }: any) => render({ field: { value: '', onChange: vi.fn() } }),
}));

import { CreateUserModal } from './CreateUserModal';

describe('CreateUserModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMutation.isError = false;
    mockCreateMutation.isPending = false;
  });

  it('renders the modal', () => {
    render(<CreateUserModal onClose={mockOnClose} />);
    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });

  it('renders the title', () => {
    render(<CreateUserModal onClose={mockOnClose} />);
    expect(screen.getByText('createModal.title')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    render(<CreateUserModal onClose={mockOnClose} />);
    expect(screen.getByText('createModal.subtitle')).toBeInTheDocument();
  });

  it('renders full name field', () => {
    render(<CreateUserModal onClose={mockOnClose} />);
    expect(screen.getByText('createModal.fullName')).toBeInTheDocument();
  });

  it('renders email field', () => {
    render(<CreateUserModal onClose={mockOnClose} />);
    expect(screen.getByText('createModal.email')).toBeInTheDocument();
  });

  it('renders role field', () => {
    render(<CreateUserModal onClose={mockOnClose} />);
    expect(screen.getByText('createModal.role')).toBeInTheDocument();
  });

  it('renders position field', () => {
    render(<CreateUserModal onClose={mockOnClose} />);
    expect(screen.getByText('createModal.position')).toBeInTheDocument();
  });

  it('renders send invitation button', () => {
    render(<CreateUserModal onClose={mockOnClose} />);
    expect(screen.getByText('createModal.sendInvitation')).toBeInTheDocument();
  });

  it('renders cancel button', () => {
    render(<CreateUserModal onClose={mockOnClose} />);
    expect(screen.getByText('common:cancel')).toBeInTheDocument();
  });

  it('shows creating text when pending', () => {
    mockCreateMutation.isPending = true;
    render(<CreateUserModal onClose={mockOnClose} />);
    expect(screen.getByText('createModal.creating')).toBeInTheDocument();
  });

  it('shows error alert on mutation error', () => {
    mockCreateMutation.isError = true;
    render(<CreateUserModal onClose={mockOnClose} />);
    expect(screen.getByTestId('alert')).toBeInTheDocument();
    expect(screen.getByText('createModal.createError')).toBeInTheDocument();
  });

  it('shows email in use error when applicable', async () => {
    mockCreateMutation.isError = true;
    const mod = await import('../hooks/useCreateUserForm');
    (mod.useCreateUserForm as ReturnType<typeof vi.fn>).mockReturnValue({
      form: mockForm,
      handleSubmit: vi.fn(),
      createMutation: mockCreateMutation,
      isEmailInUseError: true,
    });
    render(<CreateUserModal onClose={mockOnClose} />);
    expect(screen.getByText('createModal.emailInUse')).toBeInTheDocument();
  });

  it('renders role dropdown', () => {
    render(<CreateUserModal onClose={mockOnClose} />);
    expect(screen.getByTestId('dropdown')).toBeInTheDocument();
  });

  it('submits the form when send invitation button is clicked', () => {
    render(<CreateUserModal onClose={mockOnClose} />);
    const submitButton = screen.getByText('createModal.sendInvitation');
    fireEvent.click(submitButton);
    expect(submitButton).toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<CreateUserModal onClose={mockOnClose} />);
    fireEvent.click(screen.getByText('common:cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays validation errors for all form fields', () => {
    mockForm.formState.errors = {
      name: { message: 'Name is required' },
      email: { message: 'Email is required' },
      role: { message: 'Role is required' },
      position: { message: 'Position is required' },
    };
    render(<CreateUserModal onClose={mockOnClose} />);
    const errors = screen.getAllByTestId('field-error');
    expect(errors).toHaveLength(4);
    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Role is required')).toBeInTheDocument();
    expect(screen.getByText('Position is required')).toBeInTheDocument();
    mockForm.formState.errors = {};
  });
});
