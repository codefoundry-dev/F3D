import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/shared-types/client', () => ({
  passwordFormSchema: { parse: vi.fn() },
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => () => ({ values: {}, errors: {} }),
}));

const mockResetWatchValues = vi.hoisted(() => ({ newPassword: '', confirmPassword: '' }));

vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: vi.fn((name: string) => ({ name })),
    handleSubmit: vi.fn((fn: any) => (e: any) => {
      e?.preventDefault?.();
      return fn({ newPassword: 'Test1234!', confirmPassword: 'Test1234!' });
    }),
    watch: vi.fn((field: string) => {
      if (field === 'newPassword') return mockResetWatchValues.newPassword;
      if (field === 'confirmPassword') return mockResetWatchValues.confirmPassword;
      return '';
    }),
    formState: { isValid: true },
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  ResetPasswordForm: ({ title, onSubmit, onRedirectToLogin, errorContent }: any) => (
    <form data-testid="reset-form" onSubmit={onSubmit}>
      <span>{title}</span>
      {errorContent && <span data-testid="error-content">{errorContent}</span>}
      <button type="button" data-testid="redirect-login" onClick={onRedirectToLogin}>
        redirect
      </button>
    </form>
  ),
}));

const iconMocks = [
  'checkcircle-icon',
  'eye-closed',
  'eye-opened',
  'info',
  'key-icon',
  'lock-simple',
];
iconMocks.forEach((name) => {
  vi.mock(`@forethread/ui-components/assets/icons/${name}.svg?react`, () => ({
    default: () => <div />,
  }));
});

const mockNavigate = vi.fn();

const mockResetMutate = vi.hoisted(() => vi.fn());
const mockResetState = vi.hoisted(() => ({ isPending: false, isError: false, isSuccess: false }));

vi.mock('../services/auth.service', () => ({
  useResetPassword: () => ({ mutate: mockResetMutate, ...mockResetState }),
}));

const mockSearchParams = vi.hoisted(() => ({ token: 'abc123' as string | null }));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [
    new URLSearchParams(mockSearchParams.token ? `token=${mockSearchParams.token}` : ''),
  ],
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

import CompanyAdminResetPasswordPage from './CompanyAdminResetPasswordPage';

describe('CompanyAdminResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.token = 'abc123';
    Object.assign(mockResetState, { isPending: false, isError: false, isSuccess: false });
    mockResetWatchValues.newPassword = '';
    mockResetWatchValues.confirmPassword = '';
  });

  it('renders reset password form when token exists', () => {
    render(<CompanyAdminResetPasswordPage />);
    expect(screen.getByTestId('reset-form')).toBeInTheDocument();
    expect(screen.getByText('setNewPasswordTitle')).toBeInTheDocument();
  });

  it('shows missing token message when no token in URL', () => {
    mockSearchParams.token = null;
    render(<CompanyAdminResetPasswordPage />);
    expect(screen.getByText('resetLinkMissing')).toBeInTheDocument();
  });

  it('shows request new link when no token', () => {
    mockSearchParams.token = null;
    render(<CompanyAdminResetPasswordPage />);
    expect(screen.getByText('requestNewLink')).toBeInTheDocument();
  });

  it('renders the form with correct title when token is present', () => {
    render(<CompanyAdminResetPasswordPage />);
    expect(screen.getByText('setNewPasswordTitle')).toBeInTheDocument();
  });

  it('submits the form and calls resetMutate', () => {
    render(<CompanyAdminResetPasswordPage />);
    const form = screen.getByTestId('reset-form');
    fireEvent.submit(form);
    expect(mockResetMutate).toHaveBeenCalledWith({ token: 'abc123', newPassword: 'Test1234!' });
  });

  it('navigates to login when onRedirectToLogin is triggered', () => {
    render(<CompanyAdminResetPasswordPage />);
    fireEvent.click(screen.getByTestId('redirect-login'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('shows passwords mismatch error when passwords differ', () => {
    mockResetWatchValues.newPassword = 'Test1234!';
    mockResetWatchValues.confirmPassword = 'Different1!';
    render(<CompanyAdminResetPasswordPage />);
    expect(screen.getByTestId('error-content')).toHaveTextContent('passwordsDoNotMatch');
  });

  it('shows reset link invalid error when mutation fails', () => {
    mockResetState.isError = true;
    render(<CompanyAdminResetPasswordPage />);
    const errorContent = screen.getByTestId('error-content');
    expect(errorContent).toBeInTheDocument();
    expect(errorContent.textContent).toContain('resetLinkInvalid');
    expect(errorContent.textContent).toContain('requestNewLink');
  });
});
