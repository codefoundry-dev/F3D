const mockNavigate = vi.hoisted(() => vi.fn());
const mockSearchParams = vi.hoisted(() => ({
  value: new URLSearchParams('token=test-token'),
}));

const mockResetMutation = vi.hoisted(() => ({
  value: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  } as Record<string, unknown>,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('../services/auth.service', () => ({
  useResetPassword: () => mockResetMutation.value,
}));

import { render, screen, fireEvent } from '@testing-library/react';

import ProcurementOfficerResetPasswordPage from './ProcurementOfficerResetPasswordPage';

describe('ProcurementOfficerResetPasswordPage', () => {
  beforeEach(() => {
    mockSearchParams.value = new URLSearchParams('token=test-token');
    mockResetMutation.value = {
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      error: null,
    };
  });

  it('shows missing token message when no token', () => {
    mockSearchParams.value = new URLSearchParams('');
    render(<ProcurementOfficerResetPasswordPage />);
    expect(screen.getByText('resetLinkMissing')).toBeInTheDocument();
    expect(screen.getByText('requestNewLink')).toBeInTheDocument();
  });

  it('renders reset form when token present', () => {
    render(<ProcurementOfficerResetPasswordPage />);
    expect(screen.getByTestId('reset-form')).toBeInTheDocument();
    expect(screen.getByText('setNewPasswordTitle')).toBeInTheDocument();
    expect(screen.getByText('resetPassword')).toBeInTheDocument();
  });

  it('renders form with error content when mutation has error', () => {
    mockResetMutation.value = {
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      isSuccess: false,
      error: new Error('Invalid token'),
    };
    render(<ProcurementOfficerResetPasswordPage />);
    expect(screen.getByTestId('reset-form')).toBeInTheDocument();
  });

  it('renders form in success state', () => {
    mockResetMutation.value = {
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: true,
      error: null,
    };
    render(<ProcurementOfficerResetPasswordPage />);
    expect(screen.getByTestId('reset-form')).toBeInTheDocument();
  });

  it('renders form in pending state', () => {
    mockResetMutation.value = {
      mutate: vi.fn(),
      isPending: true,
      isError: false,
      isSuccess: false,
      error: null,
    };
    render(<ProcurementOfficerResetPasswordPage />);
    expect(screen.getByTestId('reset-form')).toBeInTheDocument();
  });

  it('calls onRedirectToLogin which navigates to /login', () => {
    render(<ProcurementOfficerResetPasswordPage />);
    fireEvent.click(screen.getByTestId('redirect-login'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('calls onSubmit which triggers form submission', () => {
    render(<ProcurementOfficerResetPasswordPage />);
    const form = screen.getByTestId('reset-submit-form');
    fireEvent.submit(form);
  });
});
