import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', () => ({
  // Mirror the real helper: an ApiRequestError matches when its statusCode equals `code`.
  isApiError: (err: { statusCode?: number } | null, code: number) =>
    !!err && err.statusCode === code,
  HTTP_STATUS: { LOCKED: 423 },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockMutate = vi.fn();
const mockResendMutate = vi.fn();
const mockVerifyState = vi.hoisted(() => ({
  isPending: false,
  isError: false,
  error: null as any,
}));
vi.mock('../services/auth.service', () => ({
  useVerifyOtp: () => ({ mutate: mockMutate, ...mockVerifyState }),
  useResendOtp: () => ({ mutate: mockResendMutate, isPending: false }),
  loadOtpSession: vi.fn(() => null),
}));

vi.mock('@forethread/ui-components', () => ({
  TwoFactorCard: ({
    title,
    email,
    onVerify,
    onBackToLogin,
    onResend,
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
      <button data-testid="resend-btn" onClick={() => onResend?.()}>
        Resend
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

import VerifyOtpPage from './VerifyOtpPage';

describe('VerifyOtpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockVerifyState, { isPending: false, isError: false, error: null });
  });

  it('redirects to login when no session', () => {
    render(<VerifyOtpPage />);
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('renders two factor card when session exists', async () => {
    const { loadOtpSession } = await import('../services/auth.service');
    vi.mocked(loadOtpSession).mockReturnValue({
      userId: 'u1',
      email: 'test@test.com',
      otpExpiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    render(<VerifyOtpPage />);
    expect(screen.getByTestId('two-factor')).toBeInTheDocument();
  });

  it('calls verifyMutation.mutate when onVerify is triggered', async () => {
    const { loadOtpSession } = await import('../services/auth.service');
    vi.mocked(loadOtpSession).mockReturnValue({
      userId: 'u1',
      email: 'test@test.com',
      otpExpiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    render(<VerifyOtpPage />);
    fireEvent.click(screen.getByTestId('verify-btn'));
    expect(mockMutate).toHaveBeenCalledWith({ userId: 'u1', otp: '123456' });
  });

  it('calls resendMutation.mutate when onResend is triggered', async () => {
    const { loadOtpSession } = await import('../services/auth.service');
    vi.mocked(loadOtpSession).mockReturnValue({
      userId: 'u1',
      email: 'test@test.com',
      otpExpiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    render(<VerifyOtpPage />);
    fireEvent.click(screen.getByTestId('resend-btn'));
    expect(mockResendMutate).toHaveBeenCalledWith({ userId: 'u1' });
  });

  it('navigates to login when onBackToLogin is triggered', async () => {
    const { loadOtpSession } = await import('../services/auth.service');
    vi.mocked(loadOtpSession).mockReturnValue({
      userId: 'u1',
      email: 'test@test.com',
      otpExpiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    render(<VerifyOtpPage />);
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
    render(<VerifyOtpPage />);
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
    render(<VerifyOtpPage />);
    expect(screen.getByTestId('digit-label')).toHaveTextContent('twoFactorDigitLabel');
    expect(screen.getByTestId('resend-timer')).toHaveTextContent('resendAvailableIn');
  });

  async function renderWithError(error: unknown) {
    const { loadOtpSession } = await import('../services/auth.service');
    vi.mocked(loadOtpSession).mockReturnValue({
      userId: 'u1',
      email: 'test@test.com',
      otpExpiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    mockVerifyState.isError = true;
    mockVerifyState.error = error;
    render(<VerifyOtpPage />);
  }

  it('shows "invalid code" for a 401 (wrong digits)', async () => {
    await renderWithError({ statusCode: 401 });
    expect(screen.getByTestId('otp-error')).toHaveTextContent('twoFactorInvalid');
  });

  it('shows "code no longer valid" for a 400 (expired / already used / superseded)', async () => {
    await renderWithError({ statusCode: 400 });
    expect(screen.getByTestId('otp-error')).toHaveTextContent('twoFactorCodeUnavailable');
  });

  it('shows a transient-failure message for a network/5xx error', async () => {
    await renderWithError({ statusCode: 0 });
    expect(screen.getByTestId('otp-error')).toHaveTextContent('twoFactorVerifyFailed');
  });

  it('does not show the inline error when the account is locked (423)', async () => {
    await renderWithError({ statusCode: 423 });
    expect(screen.queryByTestId('otp-error')).not.toBeInTheDocument();
  });
});
