import { render, screen, fireEvent } from '@testing-library/react';

const mockResetMutation = vi.hoisted(() => ({
  value: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
  },
}));

const mockSearchParams = vi.hoisted(() => ({
  value: new URLSearchParams('token=test-token'),
}));

const mockNavigate = vi.fn();

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams.value],
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => () => ({ values: {}, errors: {} }),
}));

vi.mock('../services/auth.service', () => ({
  useResetPassword: () => mockResetMutation.value,
}));

vi.mock('@forethread/ui-components', () => ({
  ResetPasswordForm: (props: Record<string, unknown>) => {
    const onSubmit = props.onSubmit as ((e: React.FormEvent) => void) | undefined;
    const onRedirectToLogin = props.onRedirectToLogin as (() => void) | undefined;
    return (
      <div data-testid="reset-password-form">
        <span>{props.title as string}</span>
        <span>{props.submitLabel as string}</span>
        {Boolean(props.errorContent) && (
          <span data-testid="error">{String(props.errorContent)}</span>
        )}
        {onSubmit && (
          <button data-testid="submit" onClick={(e) => onSubmit(e as unknown as React.FormEvent)}>
            Submit
          </button>
        )}
        {onRedirectToLogin && (
          <button data-testid="redirect" onClick={onRedirectToLogin}>
            Redirect
          </button>
        )}
      </div>
    );
  },
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-closed.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/info.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/key-icon.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/lock-simple.svg?react', () => ({
  default: () => <span />,
}));

import FinancialOfficerResetPasswordPage from './FinancialOfficerResetPasswordPage';

describe('FinancialOfficerResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.value = new URLSearchParams('token=test-token');
    mockResetMutation.value = {
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
    };
  });

  it('shows missing token message when no token', () => {
    mockSearchParams.value = new URLSearchParams('');
    render(<FinancialOfficerResetPasswordPage />);
    expect(screen.getByText('resetLinkMissing')).toBeInTheDocument();
  });

  it('shows request new link when no token', () => {
    mockSearchParams.value = new URLSearchParams('');
    render(<FinancialOfficerResetPasswordPage />);
    expect(screen.getByText('requestNewLink')).toBeInTheDocument();
  });

  it('renders reset password form when token present', () => {
    render(<FinancialOfficerResetPasswordPage />);
    expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
    expect(screen.getByText('setNewPasswordTitle')).toBeInTheDocument();
  });

  it('shows correct submit label', () => {
    render(<FinancialOfficerResetPasswordPage />);
    expect(screen.getByText('resetPassword')).toBeInTheDocument();
  });

  it('invokes submit handler', () => {
    render(<FinancialOfficerResetPasswordPage />);
    fireEvent.click(screen.getByTestId('submit'));
  });

  it('redirects to login on success', () => {
    render(<FinancialOfficerResetPasswordPage />);
    fireEvent.click(screen.getByTestId('redirect'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('shows error content when mutation fails', () => {
    mockResetMutation.value = { ...mockResetMutation.value, isError: true };
    render(<FinancialOfficerResetPasswordPage />);
    expect(screen.getByTestId('error')).toBeInTheDocument();
  });
});
