import { render, screen, fireEvent } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockResetMutate = vi.fn();
let mockSearchParams = new URLSearchParams('token=reset-token');

const mockResetMutation = {
  mutate: mockResetMutate,
  isPending: false,
  isError: false,
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
  useResetPassword: () => mockResetMutation,
}));

vi.mock('@forethread/ui-components', () => ({
  ResetPasswordForm: (props: Record<string, unknown>) => (
    <div data-testid="reset-password-form">
      <span>{props.title as string}</span>
      <span>{props.description as string}</span>
      <span>{props.submitLabel as string}</span>
      <span>{props.backLabel as string}</span>
      {props.errorContent ? (
        <span data-testid="error-content">{props.errorContent as React.ReactNode}</span>
      ) : null}
      {props.isSuccess ? (
        <div data-testid="success-view">
          <span>{props.successTitle as string}</span>
          <span>{props.successSubtitle as string}</span>
          <button data-testid="redirect-btn" onClick={props.onRedirectToLogin as () => void}>
            redirect
          </button>
        </div>
      ) : null}
      <form data-testid="reset-form" onSubmit={props.onSubmit as (e: React.FormEvent) => void}>
        <button type="submit">Submit</button>
      </form>
    </div>
  ),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <div data-testid="check-icon" />,
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

import SuperAdminResetPasswordPage from './SuperAdminResetPasswordPage';

describe('SuperAdminResetPasswordPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockResetMutate.mockClear();
    mockSearchParams = new URLSearchParams('token=reset-token');
    mockResetMutation.isPending = false;
    mockResetMutation.isError = false;
    mockResetMutation.isSuccess = false;
  });

  it('shows missing token message when no token in URL', () => {
    mockSearchParams = new URLSearchParams('');
    render(<SuperAdminResetPasswordPage />);
    expect(screen.getByText('resetLinkMissing')).toBeInTheDocument();
  });

  it('shows request new link when no token', () => {
    mockSearchParams = new URLSearchParams('');
    render(<SuperAdminResetPasswordPage />);
    const link = screen.getByText('requestNewLink');
    expect(link.closest('a')).toHaveAttribute('href', '/forgot-password');
  });

  it('renders the reset password form when token is present', () => {
    render(<SuperAdminResetPasswordPage />);
    expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
    expect(screen.getByText('setNewPasswordTitle')).toBeInTheDocument();
    expect(screen.getByText('setNewPasswordDescription')).toBeInTheDocument();
  });

  it('shows submit label', () => {
    render(<SuperAdminResetPasswordPage />);
    expect(screen.getByText('resetPassword')).toBeInTheDocument();
  });

  it('shows back to sign in label', () => {
    render(<SuperAdminResetPasswordPage />);
    expect(screen.getByText('backToSignIn')).toBeInTheDocument();
  });

  it('shows success view after password reset', () => {
    mockResetMutation.isSuccess = true;
    render(<SuperAdminResetPasswordPage />);
    expect(screen.getByTestId('success-view')).toBeInTheDocument();
    expect(screen.getByText('resetSuccessTitle')).toBeInTheDocument();
    expect(screen.getByText('resetSuccessSubtitle')).toBeInTheDocument();
  });

  it('navigates to /login on redirect after success', () => {
    mockResetMutation.isSuccess = true;
    render(<SuperAdminResetPasswordPage />);
    fireEvent.click(screen.getByTestId('redirect-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('shows error content when reset mutation errors', () => {
    mockResetMutation.isError = true;
    render(<SuperAdminResetPasswordPage />);
    expect(screen.getByTestId('error-content')).toBeInTheDocument();
    const errorEl = screen.getByTestId('error-content');
    expect(errorEl.textContent).toContain('resetLinkInvalid');
  });

  it('shows request new link in error content', () => {
    mockResetMutation.isError = true;
    render(<SuperAdminResetPasswordPage />);
    const link = screen.getByText('requestNewLink');
    expect(link.closest('a')).toHaveAttribute('href', '/forgot-password');
  });

  it('submits the form', () => {
    render(<SuperAdminResetPasswordPage />);
    const form = screen.getByTestId('reset-form');
    fireEvent.submit(form);
    // Form submission triggers handleSubmit — should not crash
    expect(form).toBeInTheDocument();
  });
});
