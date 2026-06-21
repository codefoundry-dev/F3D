import { CompanyType } from '@forethread/shared-types/client';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/shared-types/client', () => ({
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    COMPANY_ADMIN: 'COMPANY_ADMIN',
    PROCUREMENT_OFFICER: 'PROCUREMENT_OFFICER',
    FINANCIAL_OFFICER: 'FINANCIAL_OFFICER',
    WAREHOUSE_OFFICER: 'WAREHOUSE_OFFICER',
    Foreman: 'FOREMAN',
    VENDOR: 'VENDOR',
  },
  CompanyType: {
    CONTRACTOR: 'CONTRACTOR',
    VENDOR: 'VENDOR',
  },
}));

vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: () => ({}),
    handleSubmit: (fn: any) => {
      return (e: any) => {
        e?.preventDefault?.();
        fn({ name: 'John', email: 'john@test.com', role: 'COMPANY_ADMIN', position: 'Manager' });
      };
    },
    control: {},
    formState: { errors: {} },
  }),
  Controller: ({ render: renderFn }: any) =>
    renderFn({ field: { value: '', onChange: vi.fn() }, fieldState: {} }),
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => vi.fn(),
}));

vi.mock('../../constants/roles', () => ({
  CONTRACTOR_ROLE_OPTIONS: ['COMPANY_ADMIN', 'PROCUREMENT_OFFICER'],
}));

const mockMutate = vi.fn();
const mockUseCreateUser = vi.fn().mockReturnValue({
  mutate: mockMutate,
  isPending: false,
  isError: false,
  error: null,
});

vi.mock('../../services/users.service', () => ({
  useCreateUser: () => mockUseCreateUser(),
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  IconBadge: () => <div data-testid="icon-badge" />,
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
  CustomDropdown: () => <div data-testid="dropdown" />,
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/briefcase.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/envelope-simple.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/id-badge.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/new-user.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/user-outline.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));

import { UserDetailsStep } from './UserDetailsStep';

describe('UserDetailsStep', () => {
  const defaultProps = {
    companyType: CompanyType.CONTRACTOR as const,
    companyId: 'c1',
    companyName: 'Acme Corp',
    onSuccess: vi.fn(),
    onCancel: vi.fn(),
    onUserExists: vi.fn(),
  };

  it('renders title and subtitle', () => {
    render(<UserDetailsStep {...defaultProps} />);
    expect(screen.getByText('createUserPage.title')).toBeInTheDocument();
    expect(screen.getByText('createUserPage.subtitle')).toBeInTheDocument();
  });

  it('renders form fields', () => {
    render(<UserDetailsStep {...defaultProps} />);
    expect(screen.getByText('createModal.fullName')).toBeInTheDocument();
    expect(screen.getByText('createModal.email')).toBeInTheDocument();
    expect(screen.getByText('createModal.position')).toBeInTheDocument();
    expect(screen.getByText('createModal.department')).toBeInTheDocument();
  });

  it('renders the position field with a lowercase optional label', () => {
    render(<UserDetailsStep {...defaultProps} />);
    expect(
      screen.getAllByText((_content, el) => el?.textContent?.includes('common:optional') ?? false)
        .length,
    ).toBeGreaterThan(0);
  });

  it('renders role dropdown for contractor', () => {
    render(<UserDetailsStep {...defaultProps} />);
    expect(screen.getByText('createModal.role')).toBeInTheDocument();
  });

  it('does not render role dropdown for vendor', () => {
    render(<UserDetailsStep {...defaultProps} companyType={CompanyType.VENDOR} />);
    expect(screen.queryByText('createModal.role')).not.toBeInTheDocument();
  });

  it('renders cancel and send invitation buttons', () => {
    render(<UserDetailsStep {...defaultProps} />);
    expect(screen.getByText('createUserPage.cancel')).toBeInTheDocument();
    expect(screen.getByText('createUserPage.sendInvitation')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<UserDetailsStep {...defaultProps} />);
    fireEvent.click(screen.getByText('createUserPage.cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('calls mutate on form submit for contractor', () => {
    render(<UserDetailsStep {...defaultProps} />);
    const form = screen.getByText('createUserPage.sendInvitation').closest('form')!;
    fireEvent.submit(form);
    expect(mockMutate).toHaveBeenCalledWith(
      {
        name: 'John',
        email: 'john@test.com',
        role: 'COMPANY_ADMIN',
        companyId: 'c1',
        position: 'Manager',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('calls onSuccess callback with email on mutation success', () => {
    render(<UserDetailsStep {...defaultProps} />);
    const form = screen.getByText('createUserPage.sendInvitation').closest('form')!;
    fireEvent.submit(form);
    const mutateCall = mockMutate.mock.calls[0];
    mutateCall[1].onSuccess();
    expect(defaultProps.onSuccess).toHaveBeenCalledWith('john@test.com');
  });

  it('uses Vendor role when company type is Vendor', () => {
    render(<UserDetailsStep {...defaultProps} companyType={CompanyType.VENDOR} />);
    const form = screen.getByText('createUserPage.sendInvitation').closest('form')!;
    fireEvent.submit(form);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'VENDOR' }),
      expect.anything(),
    );
  });

  it('shows error alert when mutation fails', () => {
    mockUseCreateUser.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: { response: { data: { error: 'Email already taken' } } },
    });
    render(<UserDetailsStep {...defaultProps} />);
    expect(screen.getByTestId('alert')).toBeInTheDocument();
    expect(screen.getByText('Email already taken')).toBeInTheDocument();
  });

  it('shows generic error when no response error message', () => {
    mockUseCreateUser.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: true,
      error: {},
    });
    render(<UserDetailsStep {...defaultProps} />);
    expect(screen.getByText('createModal.createError')).toBeInTheDocument();
  });

  it('shows loading state when mutation is pending', () => {
    mockUseCreateUser.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
      isError: false,
      error: null,
    });
    render(<UserDetailsStep {...defaultProps} />);
    expect(screen.getByText('createUserPage.sending')).toBeInTheDocument();
  });
});
