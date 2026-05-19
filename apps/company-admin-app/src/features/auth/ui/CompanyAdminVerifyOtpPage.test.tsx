import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', () => ({
  isApiError: vi.fn(() => false),
  HTTP_STATUS: { LOCKED: 423 },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockMutate = vi.fn();
const mockVerifyState = vi.hoisted(() => ({
  isPending: false,
  isError: false,
  error: null as any,
}));
vi.mock('../services/auth.service', () => ({
  useVerifyOtp: () => ({ mutate: mockMutate, ...mockVerifyState }),
  loadOtpSession: vi.fn(() => null),
}));

vi.mock('@forethread/ui-components', () => ({
  TwoFactorCard: ({
    title,
    email,
    onVerify,
    onBackToLogin,
    onContactSupport,
    digitLabel,
    resendTimerText,
    isError,
    errorMessage,
  }: any) => (
    <div data-testid="two-factor">
      {title} {email}
      <button data-testid="verify-btn" onClick={() => onVerify?.('123456')}>
        Verify
      </button>
      <button data-testid="back-btn" onClick={onBackToLogin}>
        Back
      </button>
      <button data-testid="support-btn" onClick={onContactSupport}>
        Support
      </button>
      <span data-testid="digit-label">{digitLabel?.(1)}</span>
      <span data-testid="resend-timer">{resendTimerText?.('0:30')}</span>
      {isError && <span data-testid="otp-error">{errorMessage}</span>}
    </div>
  ),
}));

import CompanyAdminVerifyOtpPage from './CompanyAdminVerifyOtpPage';

describe('CompanyAdminVerifyOtpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockVerifyState, { isPending: false, isError: false, error: null });
  });

  it('redirects to login when no session', () => {
    render(<CompanyAdminVerifyOtpPage />);
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('renders two factor card when session exists', async () => {
    const { loadOtpSession } = await import('../services/auth.service');
    vi.mocked(loadOtpSession).mockReturnValue({
      userId: 'u1',
      email: 'test@test.com',
      otpExpiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    render(<CompanyAdminVerifyOtpPage />);
    expect(screen.getByTestId('two-factor')).toBeInTheDocument();
  });

  it('calls verifyMutation.mutate when onVerify is triggered', async () => {
    const { loadOtpSession } = await import('../services/auth.service');
    vi.mocked(loadOtpSession).mockReturnValue({
      userId: 'u1',
      email: 'test@test.com',
      otpExpiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    render(<CompanyAdminVerifyOtpPage />);
    fireEvent.click(screen.getByTestId('verify-btn'));
    expect(mockMutate).toHaveBeenCalledWith({ userId: 'u1', otp: '123456' });
  });

  it('navigates to login when onBackToLogin is triggered', async () => {
    const { loadOtpSession } = await import('../services/auth.service');
    vi.mocked(loadOtpSession).mockReturnValue({
      userId: 'u1',
      email: 'test@test.com',
      otpExpiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    render(<CompanyAdminVerifyOtpPage />);
    fireEvent.click(screen.getByTestId('back-btn'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('opens support email when onContactSupport is triggered', async () => {
    const { loadOtpSession } = await import('../services/auth.service');
    vi.mocked(loadOtpSession).mockReturnValue({
      userId: 'u1',
      email: 'test@test.com',
      otpExpiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    const mockOpen = vi.fn();
    vi.stubGlobal('open', mockOpen);
    render(<CompanyAdminVerifyOtpPage />);
    fireEvent.click(screen.getByTestId('support-btn'));
    expect(mockOpen).toHaveBeenCalledWith('mailto:support@forethread.com');
  });

  it('renders digitLabel and resendTimerText callbacks', async () => {
    const { loadOtpSession } = await import('../services/auth.service');
    vi.mocked(loadOtpSession).mockReturnValue({
      userId: 'u1',
      email: 'test@test.com',
      otpExpiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    render(<CompanyAdminVerifyOtpPage />);
    expect(screen.getByTestId('digit-label')).toHaveTextContent('twoFactorDigitLabel');
    expect(screen.getByTestId('resend-timer')).toHaveTextContent('resendAvailableIn');
  });

  it('shows error when verification fails and not locked', async () => {
    const { loadOtpSession } = await import('../services/auth.service');
    vi.mocked(loadOtpSession).mockReturnValue({
      userId: 'u1',
      email: 'test@test.com',
      otpExpiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    mockVerifyState.isError = true;
    mockVerifyState.error = { status: 400 };
    render(<CompanyAdminVerifyOtpPage />);
    expect(screen.getByTestId('otp-error')).toHaveTextContent('twoFactorInvalid');
  });
});
