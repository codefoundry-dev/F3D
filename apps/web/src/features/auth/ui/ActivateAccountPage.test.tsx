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

const mockActivateWatchValues = vi.hoisted(() => ({ newPassword: '', confirmPassword: '' }));

vi.mock('react-hook-form', () => ({
  useForm: () => ({
    register: vi.fn((name: string) => ({ name })),
    handleSubmit: vi.fn((fn: any) => (e: any) => {
      e?.preventDefault?.();
      return fn({ newPassword: 'Test1234!', confirmPassword: 'Test1234!' });
    }),
    watch: vi.fn((field: string) => {
      if (field === 'newPassword') return mockActivateWatchValues.newPassword;
      if (field === 'confirmPassword') return mockActivateWatchValues.confirmPassword;
      return '';
    }),
    formState: { isValid: true },
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  AuthLayout: ({ title, children }: any) => (
    <div data-testid="auth-layout">
      {title}
      {children}
    </div>
  ),
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  ContactSupportLink: ({ label }: any) => <span>{label}</span>,
  IconBadge: ({ icon }: any) => <div>{icon}</div>,
  PageLoader: () => <div data-testid="page-loader" />,
  ResetPasswordForm: ({ title, onSubmit, onRedirectToLogin, errorContent }: any) => (
    <form data-testid="reset-form" onSubmit={onSubmit}>
      <span>{title}</span>
      {errorContent && <span data-testid="error-content">{errorContent}</span>}
      <button type="button" data-testid="redirect-login" onClick={onRedirectToLogin}>
        redirect
      </button>
    </form>
  ),
  Text: ({ children }: any) => <span>{children}</span>,
}));

const iconMocks = [
  'checkcircle-icon',
  'clock-icon',
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

const mockActivateMutate = vi.hoisted(() => vi.fn());
const mockRequestInvitationMutate = vi.hoisted(() => vi.fn());
const mockActivateState = vi.hoisted(() => ({
  isPending: false,
  isError: false,
  isSuccess: false,
}));
const mockRequestInvitationState = vi.hoisted(() => ({ isPending: false, isSuccess: false }));
const mockTokenQueryState = vi.hoisted(() => ({
  data: { valid: true, email: 'test@test.com' } as any,
  isLoading: false,
  isError: false,
}));

vi.mock('../services/auth.service', () => ({
  useActivateAccount: () => ({ mutate: mockActivateMutate, ...mockActivateState }),
  useRequestNewInvitation: () => ({
    mutate: mockRequestInvitationMutate,
    ...mockRequestInvitationState,
  }),
  useValidateActivationToken: () => mockTokenQueryState,
}));

const mockSearchParams = vi.hoisted(() => ({ token: 'abc123' as string | null }));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [
    new URLSearchParams(mockSearchParams.token ? `token=${mockSearchParams.token}` : ''),
  ],
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

import ActivateAccountPage from './ActivateAccountPage';

describe('ActivateAccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.token = 'abc123';
    Object.assign(mockActivateState, { isPending: false, isError: false, isSuccess: false });
    Object.assign(mockRequestInvitationState, { isPending: false, isSuccess: false });
    Object.assign(mockTokenQueryState, {
      data: { valid: true, email: 'test@test.com' },
      isLoading: false,
      isError: false,
    });
    mockActivateWatchValues.newPassword = '';
    mockActivateWatchValues.confirmPassword = '';
  });

  it('renders password form when token is valid', () => {
    render(<ActivateAccountPage />);
    expect(screen.getByTestId('reset-form')).toBeInTheDocument();
    expect(screen.getByText('setPassword')).toBeInTheDocument();
  });

  it('shows missing token message when no token in URL', () => {
    mockSearchParams.token = null;
    render(<ActivateAccountPage />);
    expect(screen.getByText('activateLinkMissing')).toBeInTheDocument();
  });

  it('shows page loader when token is being validated', () => {
    mockTokenQueryState.isLoading = true;
    mockTokenQueryState.data = undefined;
    render(<ActivateAccountPage />);
    expect(screen.getByTestId('page-loader')).toBeInTheDocument();
  });

  it('shows expired invitation layout when token is invalid', () => {
    mockTokenQueryState.data = { valid: false, email: 'test@test.com' };
    render(<ActivateAccountPage />);
    expect(screen.getByTestId('auth-layout')).toBeInTheDocument();
    expect(screen.getByText('invitationExpiredTitle')).toBeInTheDocument();
  });

  it('shows expired invitation layout when token query has error', () => {
    mockTokenQueryState.isError = true;
    mockTokenQueryState.data = null;
    render(<ActivateAccountPage />);
    expect(screen.getByTestId('auth-layout')).toBeInTheDocument();
    expect(screen.getByText('invitationExpiredTitle')).toBeInTheDocument();
  });

  it('shows request new link button on expired token page', () => {
    mockTokenQueryState.data = { valid: false, email: 'test@test.com' };
    render(<ActivateAccountPage />);
    expect(screen.getByText('requestNewLink')).toBeInTheDocument();
  });

  it('calls requestInvitationMutate when request new link is clicked', () => {
    mockTokenQueryState.data = { valid: false, email: 'test@test.com' };
    render(<ActivateAccountPage />);
    fireEvent.click(screen.getByText('requestNewLink'));
    expect(mockRequestInvitationMutate).toHaveBeenCalledWith('test@test.com');
  });

  it('shows back to sign in link on expired token page', () => {
    mockTokenQueryState.data = { valid: false, email: 'test@test.com' };
    render(<ActivateAccountPage />);
    expect(screen.getByText('backToSignIn')).toBeInTheDocument();
  });

  it('shows contact support on expired token page', () => {
    mockTokenQueryState.data = { valid: false, email: 'test@test.com' };
    render(<ActivateAccountPage />);
    expect(screen.getByText('contactSupport')).toBeInTheDocument();
  });

  it('calls handleSubmit when form is submitted', () => {
    render(<ActivateAccountPage />);
    const form = screen.getByTestId('reset-form');
    fireEvent.submit(form);
    expect(mockActivateMutate).toHaveBeenCalledWith({ token: 'abc123', password: 'Test1234!' });
  });

  it('navigates to login when onRedirectToLogin is triggered', () => {
    render(<ActivateAccountPage />);
    fireEvent.click(screen.getByTestId('redirect-login'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('shows passwords mismatch error when passwords differ', () => {
    mockActivateWatchValues.newPassword = 'Test1234!';
    mockActivateWatchValues.confirmPassword = 'Different1!';
    render(<ActivateAccountPage />);
    expect(screen.getByTestId('error-content')).toHaveTextContent('passwordsDoNotMatch');
  });

  it('shows activate link invalid error when mutation fails', () => {
    mockActivateState.isError = true;
    render(<ActivateAccountPage />);
    const errorContent = screen.getByTestId('error-content');
    expect(errorContent).toBeInTheDocument();
    expect(errorContent.textContent).toContain('activateLinkInvalid');
    expect(errorContent.textContent).toContain('backToSignIn');
  });
});
