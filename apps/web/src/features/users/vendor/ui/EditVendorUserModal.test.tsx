const mockHandleSubmit = vi.hoisted(() => vi.fn((e: any) => e?.preventDefault?.()));
const mockRegister = vi.hoisted(() => vi.fn((name: string) => ({ name })));
const mockIsLoadingUser = vi.hoisted(() => ({ value: false }));
const mockUpdateMutation = vi.hoisted(() => ({ isPending: false, isError: false }));

vi.mock('../hooks/useEditVendorUserForm', () => ({
  useEditVendorUserForm: () => ({
    form: { register: mockRegister, formState: { errors: {} } },
    handleSubmit: mockHandleSubmit,
    updateMutation: mockUpdateMutation,
    isLoadingUser: mockIsLoadingUser.value,
  }),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
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
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  IconBadge: () => <span data-testid="icon-badge" />,
  Spinner: () => <div data-testid="spinner" />,
  onPhoneOnly: vi.fn(),
}));

const SvgStub = vi.hoisted(() => () => null);
vi.mock('@forethread/ui-components/assets/icons/edit-without-line.svg?react', () => ({
  default: SvgStub,
}));
vi.mock('@forethread/ui-components/assets/icons/envelope-simple.svg?react', () => ({
  default: SvgStub,
}));
vi.mock('@forethread/ui-components/assets/icons/id-badge.svg?react', () => ({ default: SvgStub }));
vi.mock('@forethread/ui-components/assets/icons/phone.svg?react', () => ({ default: SvgStub }));
vi.mock('@forethread/ui-components/assets/icons/user-outline.svg?react', () => ({
  default: SvgStub,
}));

import { render, screen, fireEvent } from '@testing-library/react';

import { EditVendorUserModal } from './EditVendorUserModal';

describe('EditVendorUserModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoadingUser.value = false;
    Object.assign(mockUpdateMutation, { isPending: false, isError: false });
  });

  it('renders title and subtitle', () => {
    render(<EditVendorUserModal onClose={vi.fn()} />);
    expect(screen.getByText('editModal.title')).toBeInTheDocument();
    expect(screen.getByText('editModal.subtitle')).toBeInTheDocument();
  });

  it('renders form fields', () => {
    render(<EditVendorUserModal onClose={vi.fn()} />);
    expect(screen.getByText('editModal.fullName')).toBeInTheDocument();
    expect(screen.getByText('editModal.email')).toBeInTheDocument();
    expect(screen.getByText('editModal.phone')).toBeInTheDocument();
  });

  it('renders submit and cancel buttons', () => {
    render(<EditVendorUserModal onClose={vi.fn()} />);
    expect(screen.getByText('editModal.submitChanges')).toBeInTheDocument();
    expect(screen.getByText('common:cancel')).toBeInTheDocument();
  });

  it('calls onClose when cancel clicked', () => {
    const onClose = vi.fn();
    render(<EditVendorUserModal onClose={onClose} />);
    fireEvent.click(screen.getByText('common:cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls handleSubmit on form submit', () => {
    render(<EditVendorUserModal onClose={vi.fn()} />);
    const form = screen.getByText('editModal.submitChanges').closest('form')!;
    fireEvent.submit(form);
    expect(mockHandleSubmit).toHaveBeenCalled();
  });

  it('registers form fields', () => {
    render(<EditVendorUserModal onClose={vi.fn()} />);
    expect(mockRegister).toHaveBeenCalledWith('name');
    expect(mockRegister).toHaveBeenCalledWith('email');
    expect(mockRegister).toHaveBeenCalledWith('phone');
    expect(mockRegister).toHaveBeenCalledWith('position');
  });

  it('shows spinner when loading user', () => {
    mockIsLoadingUser.value = true;
    render(<EditVendorUserModal onClose={vi.fn()} />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows error alert when update fails', () => {
    Object.assign(mockUpdateMutation, { isError: true });
    render(<EditVendorUserModal onClose={vi.fn()} />);
    expect(screen.getByTestId('alert')).toBeInTheDocument();
    expect(screen.getByText('editModal.updateError')).toBeInTheDocument();
  });

  it('shows submitting text when isPending', () => {
    Object.assign(mockUpdateMutation, { isPending: true });
    render(<EditVendorUserModal onClose={vi.fn()} />);
    expect(screen.getByText('editModal.submitting')).toBeInTheDocument();
  });

  it('renders position field with optional label', () => {
    render(<EditVendorUserModal onClose={vi.fn()} />);
    expect(screen.getByText('editModal.position')).toBeInTheDocument();
    expect(screen.getByText('(common:optional)')).toBeInTheDocument();
  });
});
