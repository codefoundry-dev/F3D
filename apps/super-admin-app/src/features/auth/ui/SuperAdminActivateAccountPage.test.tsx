import { render, screen, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockActivateMutate = vi.fn();
const mockRequestInvitationMutate = vi.fn();
let mockSearchParams = new URLSearchParams('token=valid-token');

const mockTokenQuery = {
  data: { valid: true, email: 'admin@test.com' } as { valid: boolean; email?: string } | undefined,
  isLoading: false,
  isError: false,
};
const mockActivateMutation = {
  mutate: mockActivateMutate,
  isPending: false,
  isError: false,
  isSuccess: false,
};
const mockRequestInvitationMutation = {
  mutate: mockRequestInvitationMutate,
  isPending: false,
  isSuccess: false,
};

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams],
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('@forethread/shared-types/client', async () => {
  const { z } = await import('zod');
  return {
    passwordFormSchema: z.object({
      newPassword: z
        .string()
        .min(8)
        .regex(/[a-z]/)
        .regex(/[A-Z]/)
        .regex(/[0-9]/)
        .regex(/[^A-Za-z0-9]/),
      confirmPassword: z.string(),
    }),
  };
});

vi.mock('../services/auth.service', () => ({
  useActivateAccount: () => mockActivateMutation,
  useRequestNewInvitation: () => mockRequestInvitationMutation,
  useValidateActivationToken: () => mockTokenQuery,
}));

// Mock the ResetPasswordForm — it's a complex presentational component
vi.mock('@forethread/ui-components', () => ({
  AuthLayout: ({ children, title, description }: Record<string, unknown>) => (
    <div data-testid="auth-layout">
      <h1>{title as string}</h1>
      <p>{description as string}</p>
      {children as React.ReactNode}
    </div>
  ),
  Button: ({ children, onClick, disabled, isLoading, ...rest }: Record<string, unknown>) => (
    <button
      onClick={onClick as () => void}
      disabled={(disabled as boolean) || (isLoading as boolean)}
      {...(rest as Record<string, unknown>)}
    >
      {children as React.ReactNode}
    </button>
  ),
  ContactSupportLink: ({ label }: { label: string }) => (
    <span data-testid="support-link">{label}</span>
  ),
  IconBadge: ({ icon }: { icon: React.ReactNode }) => <span>{icon}</span>,
  PageLoader: () => <div data-testid="page-loader">Loading...</div>,
  ResetPasswordForm: (props: Record<string, unknown>) => (
    <div data-testid="reset-password-form">
      <span>{props.title as string}</span>
      <span>{props.description as string}</span>
      <span>{props.submitLabel as string}</span>
      {props.errorContent ? (
        <span data-testid="error-content">{props.errorContent as React.ReactNode}</span>
      ) : null}
      {props.isSuccess ? (
        <div data-testid="success-view">
          <span>{props.successTitle as string}</span>
          <button data-testid="redirect-btn" onClick={props.onRedirectToLogin as () => void}>
            redirect
          </button>
        </div>
      ) : null}
      <form data-testid="activate-form" onSubmit={props.onSubmit as (e: React.FormEvent) => void}>
        <button type="submit">Submit</button>
      </form>
    </div>
  ),
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <div data-testid="check-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/clock-icon.svg?react', () => ({
  default: () => <div data-testid="clock-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-closed.svg?react', () => ({
  default: () => <div data-testid="eye-closed-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <div data-testid="eye-opened-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/info.svg?react', () => ({
  default: () => <div data-testid="info-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/key-icon.svg?react', () => ({
  default: () => <div data-testid="key-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/lock-simple.svg?react', () => ({
  default: () => <div data-testid="lock-icon" />,
}));

import SuperAdminActivateAccountPage from './SuperAdminActivateAccountPage';

describe('SuperAdminActivateAccountPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockActivateMutate.mockClear();
    mockRequestInvitationMutate.mockClear();
    mockSearchParams = new URLSearchParams('token=valid-token');
    mockTokenQuery.data = { valid: true, email: 'admin@test.com' };
    mockTokenQuery.isLoading = false;
    mockTokenQuery.isError = false;
    mockActivateMutation.isPending = false;
    mockActivateMutation.isError = false;
    mockActivateMutation.isSuccess = false;
    mockRequestInvitationMutation.isPending = false;
    mockRequestInvitationMutation.isSuccess = false;
  });

  it('shows missing token message when no token in URL', () => {
    mockSearchParams = new URLSearchParams('');
    render(<SuperAdminActivateAccountPage />);
    expect(screen.getByText('activateLinkMissing')).toBeInTheDocument();
  });

  it('shows loading state while validating token', () => {
    mockTokenQuery.isLoading = true;
    render(<SuperAdminActivateAccountPage />);
    expect(screen.getByTestId('page-loader')).toBeInTheDocument();
  });

  it('shows expired invitation when token is invalid', () => {
    mockTokenQuery.data = { valid: false, email: 'admin@test.com' };
    render(<SuperAdminActivateAccountPage />);
    expect(screen.getByText('invitationExpiredTitle')).toBeInTheDocument();
    expect(screen.getByText('invitationExpiredSubtitle')).toBeInTheDocument();
  });

  it('shows expired invitation when token query errors', () => {
    mockTokenQuery.isError = true;
    mockTokenQuery.data = undefined;
    render(<SuperAdminActivateAccountPage />);
    expect(screen.getByText('invitationExpiredTitle')).toBeInTheDocument();
  });

  it('shows request new link button for expired token', () => {
    mockTokenQuery.data = { valid: false, email: 'admin@test.com' };
    render(<SuperAdminActivateAccountPage />);
    const button = screen.getByText('requestNewLink');
    expect(button).toBeInTheDocument();
  });

  it('calls requestInvitationMutation on request new link click', () => {
    mockTokenQuery.data = { valid: false, email: 'admin@test.com' };
    render(<SuperAdminActivateAccountPage />);
    fireEvent.click(screen.getByText('requestNewLink'));
    expect(mockRequestInvitationMutate).toHaveBeenCalledWith('admin@test.com');
  });

  it('renders password form when token is valid', () => {
    render(<SuperAdminActivateAccountPage />);
    expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
    expect(screen.getByText('setPassword')).toBeInTheDocument();
    expect(screen.getByText('setPasswordDescription')).toBeInTheDocument();
  });

  it('shows activate account submit label', () => {
    render(<SuperAdminActivateAccountPage />);
    expect(screen.getByText('activateAccount')).toBeInTheDocument();
  });

  it('shows success view after activation', () => {
    mockActivateMutation.isSuccess = true;
    render(<SuperAdminActivateAccountPage />);
    expect(screen.getByTestId('success-view')).toBeInTheDocument();
    expect(screen.getByText('activateSuccessTitle')).toBeInTheDocument();
  });

  it('navigates to /login on redirect after success', () => {
    mockActivateMutation.isSuccess = true;
    render(<SuperAdminActivateAccountPage />);
    fireEvent.click(screen.getByTestId('redirect-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('shows back to sign in link on expired token page', () => {
    mockTokenQuery.data = { valid: false, email: 'admin@test.com' };
    render(<SuperAdminActivateAccountPage />);
    expect(screen.getByText('backToSignIn')).toBeInTheDocument();
    const link = screen.getByText('backToSignIn').closest('a');
    expect(link).toHaveAttribute('href', '/login');
  });

  it('submits the activation form', () => {
    render(<SuperAdminActivateAccountPage />);
    const form = screen.getByTestId('activate-form');
    fireEvent.submit(form);
    // Form submission triggers handleSubmit — should not crash
    expect(form).toBeInTheDocument();
  });

  it('shows error content when activation mutation errors', () => {
    mockActivateMutation.isError = true;
    render(<SuperAdminActivateAccountPage />);
    expect(screen.getByTestId('error-content')).toBeInTheDocument();
    const errorEl = screen.getByTestId('error-content');
    expect(errorEl.textContent).toContain('activateLinkInvalid');
  });

  it('disables request new link button when email is undefined', () => {
    mockTokenQuery.data = { valid: false, email: undefined };
    mockTokenQuery.isError = false;
    render(<SuperAdminActivateAccountPage />);
    const button = screen.getByText('requestNewLink');
    expect(button).toBeDisabled();
  });

  it('disables request new link button when already requested successfully', () => {
    mockTokenQuery.data = { valid: false, email: 'admin@test.com' };
    mockRequestInvitationMutation.isSuccess = true;
    render(<SuperAdminActivateAccountPage />);
    const button = screen.getByText('requestNewLink');
    expect(button).toBeDisabled();
  });
});
