const mockTokenQuery = vi.hoisted(() => ({
  value: {
    data: { valid: true, email: 'test@example.com' },
    isLoading: false,
    isError: false,
  } as Record<string, unknown>,
}));

const mockNavigate = vi.hoisted(() => vi.fn());
const mockActivateMutation = vi.hoisted(() => ({
  value: { mutate: vi.fn(), isPending: false, isError: false, isSuccess: false },
}));

const mockRequestInvitationMutation = vi.hoisted(() => ({
  value: { mutate: vi.fn(), isPending: false, isSuccess: false },
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockSearchParams = vi.hoisted(() => ({
  value: new URLSearchParams('token=test-token'),
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams.value, vi.fn()],
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('@forethread/shared-types/client', () => ({
  passwordFormSchema: {
    _def: {},
    parse: vi.fn(),
  },
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => () => ({ values: {}, errors: {} }),
}));

vi.mock('@forethread/ui-components', () => ({
  AuthLayout: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="auth-layout">
      <span>{title}</span>
      {children}
    </div>
  ),
  Button: ({ children, ...props }: Record<string, unknown>) => (
    <button {...(props as object)}>{children as React.ReactNode}</button>
  ),
  ContactSupportLink: ({ label }: { label: string }) => <span>{label}</span>,
  IconBadge: ({ icon }: { icon: React.ReactNode }) => <span>{icon}</span>,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
  PageLoader: () => <div data-testid="page-loader" />,
  ResetPasswordForm: (props: Record<string, unknown>) => (
    <div data-testid="reset-form">
      <span>{props.title as string}</span>
      <span>{props.submitLabel as string}</span>
      {Boolean(props.onSubmit) && (
        <form data-testid="reset-submit-form" onSubmit={props.onSubmit as React.FormEventHandler}>
          <button type="submit">submit</button>
        </form>
      )}
      {Boolean(props.onRedirectToLogin) && (
        <button data-testid="redirect-login" onClick={props.onRedirectToLogin as () => void}>
          redirect
        </button>
      )}
    </div>
  ),
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('../services/auth.service', () => ({
  useActivateAccount: () => mockActivateMutation.value,
  useValidateActivationToken: () => mockTokenQuery.value,
  useRequestNewInvitation: () => mockRequestInvitationMutation.value,
}));

import { render, screen, fireEvent } from '@testing-library/react';

import ProcurementOfficerActivateAccountPage from './ProcurementOfficerActivateAccountPage';

describe('ProcurementOfficerActivateAccountPage', () => {
  beforeEach(() => {
    mockSearchParams.value = new URLSearchParams('token=test-token');
    mockTokenQuery.value = {
      data: { valid: true, email: 'test@example.com' },
      isLoading: false,
      isError: false,
    };
    mockActivateMutation.value = {
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
    };
    mockRequestInvitationMutation.value = {
      mutate: vi.fn(),
      isPending: false,
      isSuccess: false,
    };
  });

  it('shows loading state', () => {
    mockTokenQuery.value.isLoading = true;
    render(<ProcurementOfficerActivateAccountPage />);
    expect(screen.getByTestId('page-loader')).toBeInTheDocument();
  });

  it('shows expired token screen on error', () => {
    mockTokenQuery.value.isError = true;
    render(<ProcurementOfficerActivateAccountPage />);
    expect(screen.getByText('invitationExpiredTitle')).toBeInTheDocument();
  });

  it('shows expired screen when token invalid', () => {
    mockTokenQuery.value.data = { valid: false, email: 'test@example.com' };
    render(<ProcurementOfficerActivateAccountPage />);
    expect(screen.getByText('invitationExpiredTitle')).toBeInTheDocument();
    expect(screen.getByText('requestNewLink')).toBeInTheDocument();
  });

  it('shows password form when token is valid', () => {
    render(<ProcurementOfficerActivateAccountPage />);
    expect(screen.getByTestId('reset-form')).toBeInTheDocument();
    expect(screen.getByText('setPassword')).toBeInTheDocument();
    expect(screen.getByText('activateAccount')).toBeInTheDocument();
  });

  it('shows activation error content when mutation has error', () => {
    mockActivateMutation.value = {
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      isSuccess: false,
    };
    render(<ProcurementOfficerActivateAccountPage />);
    expect(screen.getByTestId('reset-form')).toBeInTheDocument();
  });

  it('renders success state when activation succeeds', () => {
    mockActivateMutation.value = {
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: true,
    };
    render(<ProcurementOfficerActivateAccountPage />);
    expect(screen.getByTestId('reset-form')).toBeInTheDocument();
  });

  it('shows request new invitation success state', () => {
    mockTokenQuery.value = {
      data: { valid: false, email: 'test@example.com' },
      isLoading: false,
      isError: false,
    };
    mockRequestInvitationMutation.value = {
      mutate: vi.fn(),
      isPending: false,
      isSuccess: true,
    };
    render(<ProcurementOfficerActivateAccountPage />);
    expect(screen.getByText('invitationExpiredTitle')).toBeInTheDocument();
  });

  it('calls requestNewInvitation mutate when request new link clicked', () => {
    mockTokenQuery.value = {
      data: { valid: false, email: 'test@example.com' },
      isLoading: false,
      isError: false,
    };
    const mutateFn = vi.fn();
    mockRequestInvitationMutation.value = {
      mutate: mutateFn,
      isPending: false,
      isSuccess: false,
    };
    render(<ProcurementOfficerActivateAccountPage />);
    fireEvent.click(screen.getByText('requestNewLink'));
    expect(mutateFn).toHaveBeenCalledWith('test@example.com');
  });

  it('calls onRedirectToLogin which navigates to /login', () => {
    render(<ProcurementOfficerActivateAccountPage />);
    fireEvent.click(screen.getByTestId('redirect-login'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('calls onSubmit which triggers form submission', () => {
    render(<ProcurementOfficerActivateAccountPage />);
    const form = screen.getByTestId('reset-submit-form');
    fireEvent.submit(form);
  });

  it('shows missing token screen when token is empty', () => {
    mockSearchParams.value = new URLSearchParams();
    render(<ProcurementOfficerActivateAccountPage />);
    expect(screen.getByText('activateLinkMissing')).toBeInTheDocument();
  });

  it('shows expired screen without email when data has no email', () => {
    mockTokenQuery.value = {
      data: { valid: false, email: null },
      isLoading: false,
      isError: false,
    };
    render(<ProcurementOfficerActivateAccountPage />);
    expect(screen.getByText('invitationExpiredTitle')).toBeInTheDocument();
  });

  it('disables request button when email is null', () => {
    mockTokenQuery.value = {
      data: { valid: false, email: null },
      isLoading: false,
      isError: false,
    };
    render(<ProcurementOfficerActivateAccountPage />);
    const btn = screen.getByText('requestNewLink');
    expect(btn).toBeDisabled();
  });

  it('does not call mutate when clicking request link without email', () => {
    const mutateFn = vi.fn();
    mockTokenQuery.value = {
      data: { valid: false, email: null },
      isLoading: false,
      isError: false,
    };
    mockRequestInvitationMutation.value = {
      mutate: mutateFn,
      isPending: false,
      isSuccess: false,
    };
    render(<ProcurementOfficerActivateAccountPage />);
    fireEvent.click(screen.getByText('requestNewLink'));
    expect(mutateFn).not.toHaveBeenCalled();
  });
});
