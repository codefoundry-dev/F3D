import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/shared-types/client', () => ({
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    COMPANY_ADMIN: 'COMPANY_ADMIN',
    VENDOR: 'VENDOR',
  },
}));

vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: () => ({}),
    handleSubmit: (fn: any) => (e: any) => {
      e?.preventDefault?.();
      fn({ name: 'John', email: 'john@test.com', position: 'Manager' });
    },
    formState: { errors: {}, isValid: true },
  }),
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => vi.fn(),
}));

const mockMutate = vi.fn();
const mockUseCreateUser = vi.fn().mockReturnValue({
  mutate: mockMutate,
  isPending: false,
  isError: false,
  error: null,
});

vi.mock('../services/users.service', () => ({
  useCreateUser: () => mockUseCreateUser(),
}));

vi.mock('./steps/InvitationSuccessStep', () => ({
  InvitationSuccessStep: ({ email }: { email: string }) => (
    <div data-testid="invitation-success">{email}</div>
  ),
}));

vi.mock('@forethread/ui-components', () => ({
  Modal: ({ children }: any) => <div data-testid="modal">{children}</div>,
  ModalGridBackground: () => <div data-testid="grid-bg" />,
  ModalGridHeader: ({ title, subtitle }: any) => (
    <div data-testid="modal-grid-header">
      <div>{title}</div>
      {subtitle ? <div>{subtitle}</div> : null}
    </div>
  ),
  Input: (props: any) => <input data-testid={`input-${props.type ?? 'text'}`} {...props} />,
  FormField: ({ children, label }: any) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  ),
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  Button: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  REGISTRATION_MODAL_CARD_CLASS: '',
  UserAlreadyExistsModal: ({ title }: any) => <div data-testid="user-exists">{title}</div>,
}));

vi.mock('@forethread/ui-components/assets/icons/department.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/envelope-simple.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/id-badge.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/shield-icon.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/user-outline.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));

import { AddSuperAdminModal } from './AddSuperAdminModal';

describe('AddSuperAdminModal', () => {
  beforeEach(() => {
    mockMutate.mockReset();
    mockUseCreateUser.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    });
  });

  it('renders the super-admin title and subtitle', () => {
    render(<AddSuperAdminModal onClose={vi.fn()} />);
    expect(screen.getByText('createSuperAdminModal.title')).toBeInTheDocument();
    expect(screen.getByText('createSuperAdminModal.subtitle')).toBeInTheDocument();
  });

  it('renders name, email, position and department fields (no role/company)', () => {
    render(<AddSuperAdminModal onClose={vi.fn()} />);
    expect(screen.getByText('createModal.fullName')).toBeInTheDocument();
    expect(screen.getByText('createModal.email')).toBeInTheDocument();
    expect(screen.getByText('createModal.position')).toBeInTheDocument();
    expect(screen.getByText('createModal.department')).toBeInTheDocument();
    // No role dropdown or company selection on the super-admin form.
    expect(screen.queryByText('createModal.role')).not.toBeInTheDocument();
  });

  it('submits with the SUPER_ADMIN role and no companyId', () => {
    render(<AddSuperAdminModal onClose={vi.fn()} />);
    const form = screen.getByText('createUserPage.sendInvitation').closest('form')!;
    fireEvent.submit(form);

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const dto = mockMutate.mock.calls[0][0];
    expect(dto).toMatchObject({
      name: 'John',
      email: 'john@test.com',
      role: 'SUPER_ADMIN',
      position: 'Manager',
    });
    expect(dto).not.toHaveProperty('companyId');
  });

  it('shows the success step after a successful invite', () => {
    render(<AddSuperAdminModal onClose={vi.fn()} />);
    const form = screen.getByText('createUserPage.sendInvitation').closest('form')!;
    fireEvent.submit(form);

    // Drive the mutation's onSuccess callback.
    void act(() => mockMutate.mock.calls[0][1].onSuccess());

    expect(screen.getByTestId('invitation-success')).toHaveTextContent('john@test.com');
  });

  it('opens the "user already exists" modal on a 409 error', () => {
    render(<AddSuperAdminModal onClose={vi.fn()} />);
    const form = screen.getByText('createUserPage.sendInvitation').closest('form')!;
    fireEvent.submit(form);

    void act(() => mockMutate.mock.calls[0][1].onError({ statusCode: 409 }));

    expect(screen.getByTestId('user-exists')).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    render(<AddSuperAdminModal onClose={onClose} />);
    fireEvent.click(screen.getByText('createUserPage.cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
