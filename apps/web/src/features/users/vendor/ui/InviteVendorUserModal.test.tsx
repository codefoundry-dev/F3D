const mockHandleSubmit = vi.hoisted(() => vi.fn((e: any) => e?.preventDefault?.()));
const mockRegister = vi.hoisted(() => vi.fn((name: string) => ({ name })));
const mockCloseUserExists = vi.hoisted(() => vi.fn());
const mockFormState = vi.hoisted(() => ({
  showUserExists: false,
  closeUserExists: mockCloseUserExists,
  isPending: false,
}));

vi.mock('../hooks/useInviteVendorUserForm', () => ({
  useInviteVendorUserForm: () => ({
    form: { register: mockRegister, formState: { errors: {} } },
    handleSubmit: mockHandleSubmit,
    inviteMutation: { isPending: mockFormState.isPending },
    showUserExists: mockFormState.showUserExists,
    closeUserExists: mockFormState.closeUserExists,
  }),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  GridModal: ({ icon, title, description, children, actions, onSubmit }: any) =>
    onSubmit ? (
      <form data-testid="modal" onSubmit={onSubmit}>
        {icon}
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
        {actions}
      </form>
    ) : (
      <div data-testid="modal">
        {icon}
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
        {actions}
      </div>
    ),
  Modal: ({ children }: any) => <div data-testid="modal">{children}</div>,
  ModalBody: ({ children }: any) => <div>{children}</div>,
  ModalCloseButton: ({ onClose }: any) => <button data-testid="close-btn" onClick={onClose} />,
  Input: ({ leftIcon: _leftIcon, ...rest }: any) => <input {...rest} />,
  FormField: ({ label, children, error }: any) => (
    <div>
      <label>{label}</label>
      {children}
      {error && <span>{error}</span>}
    </div>
  ),
  Button: ({ children, onClick, type, isLoading }: any) => (
    <button onClick={onClick} type={type} disabled={isLoading}>
      {children}
    </button>
  ),
  IconBadge: () => <span data-testid="icon-badge" />,
  UserAlreadyExistsModal: ({ onClose, onBack, title }: any) => (
    <div data-testid="user-exists-modal">
      <span>{title}</span>
      <button data-testid="user-exists-close" onClick={onClose}>
        Close
      </button>
      <button data-testid="user-exists-back" onClick={onBack}>
        Back
      </button>
    </div>
  ),
}));

const SvgStub = vi.hoisted(() => () => null);
vi.mock('@forethread/ui-components/assets/icons/envelope-simple.svg?react', () => ({
  default: SvgStub,
}));
vi.mock('@forethread/ui-components/assets/icons/id-badge.svg?react', () => ({ default: SvgStub }));
vi.mock('@forethread/ui-components/assets/icons/new-user.svg?react', () => ({ default: SvgStub }));
vi.mock('@forethread/ui-components/assets/icons/user-outline.svg?react', () => ({
  default: SvgStub,
}));

import { render, screen, fireEvent } from '@testing-library/react';

import { InviteVendorUserModal } from './InviteVendorUserModal';

describe('InviteVendorUserModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFormState.showUserExists = false;
    mockFormState.isPending = false;
  });

  it('renders title and subtitle', () => {
    render(<InviteVendorUserModal onClose={vi.fn()} />);
    expect(screen.getByText('inviteModal.title')).toBeInTheDocument();
    expect(screen.getByText('inviteModal.subtitle')).toBeInTheDocument();
  });

  it('renders form fields', () => {
    render(<InviteVendorUserModal onClose={vi.fn()} />);
    expect(screen.getByText('inviteModal.fullName')).toBeInTheDocument();
    expect(screen.getByText('inviteModal.email')).toBeInTheDocument();
    expect(screen.getByText('inviteModal.positionLabel')).toBeInTheDocument();
  });

  it('renders submit and cancel buttons', () => {
    render(<InviteVendorUserModal onClose={vi.fn()} />);
    expect(screen.getByText('inviteModal.sendInvitation')).toBeInTheDocument();
    expect(screen.getByText('common:cancel')).toBeInTheDocument();
  });

  it('calls onClose when cancel clicked', () => {
    const onClose = vi.fn();
    render(<InviteVendorUserModal onClose={onClose} />);
    fireEvent.click(screen.getByText('common:cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls handleSubmit on form submit', () => {
    render(<InviteVendorUserModal onClose={vi.fn()} />);
    const form = screen.getByText('inviteModal.sendInvitation').closest('form')!;
    fireEvent.submit(form);
    expect(mockHandleSubmit).toHaveBeenCalled();
  });

  it('registers form fields', () => {
    render(<InviteVendorUserModal onClose={vi.fn()} />);
    expect(mockRegister).toHaveBeenCalledWith('name');
    expect(mockRegister).toHaveBeenCalledWith('email');
    expect(mockRegister).toHaveBeenCalledWith('position');
  });

  it('shows sending text when isPending', () => {
    mockFormState.isPending = true;
    render(<InviteVendorUserModal onClose={vi.fn()} />);
    expect(screen.getByText('inviteModal.sending')).toBeInTheDocument();
  });

  it('renders UserAlreadyExistsModal when showUserExists is true', () => {
    mockFormState.showUserExists = true;
    render(<InviteVendorUserModal onClose={vi.fn()} />);
    expect(screen.getByTestId('user-exists-modal')).toBeInTheDocument();
  });

  it('calls closeUserExists when user exists modal close is clicked', () => {
    mockFormState.showUserExists = true;
    render(<InviteVendorUserModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('user-exists-close'));
    expect(mockCloseUserExists).toHaveBeenCalled();
  });

  it('calls onClose when user exists modal back is clicked', () => {
    mockFormState.showUserExists = true;
    const onClose = vi.fn();
    render(<InviteVendorUserModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('user-exists-back'));
    expect(onClose).toHaveBeenCalled();
  });
});
