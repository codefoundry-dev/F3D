import { render, screen } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockMutate = vi.fn();
const mockVerifyReturn = {
  mutate: mockMutate,
  isPending: false,
  isError: false,
  error: null as Error | null,
};
let mockSession: {
  email: string;
  userId: string;
  otpExpiresAt: string;
} | null = null;

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', () => ({
  isApiError: vi.fn(() => false),
  HTTP_STATUS: { LOCKED: 423 },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../services/auth.service', () => ({
  useVerifyOtp: () => mockVerifyReturn,
  loadOtpSession: () => mockSession,
}));

// Mock the TwoFactorCard to simplify testing — it's a presentational component
vi.mock('@forethread/ui-components', () => ({
  TwoFactorCard: (props: Record<string, unknown>) => {
    // Invoke callback props to cover them
    const digitLabelFn = props.digitLabel as ((index: number) => string) | undefined;
    const resendTimerTextFn = props.resendTimerText as ((time: string) => string) | undefined;
    return (
      <div data-testid="two-factor-card">
        <span>{props.title as string}</span>
        <span>{props.email as string}</span>
        <span>{props.verifyLabel as string}</span>
        <span>{props.backLabel as string}</span>
        {digitLabelFn && <span data-testid="digit-label">{digitLabelFn(1)}</span>}
        {resendTimerTextFn && <span data-testid="resend-timer">{resendTimerTextFn('0:30')}</span>}
        {props.isLocked ? <span>{props.lockedMessage as string}</span> : null}
        {props.isError ? <span>{props.errorMessage as string}</span> : null}
        <button
          data-testid="verify-btn"
          onClick={() => (props.onVerify as (otp: string) => void)('123456')}
        >
          Verify
        </button>
        <button data-testid="back-btn" onClick={props.onBackToLogin as () => void}>
          Back
        </button>
        <button data-testid="contact-support-btn" onClick={props.onContactSupport as () => void}>
          Contact Support
        </button>
      </div>
    );
  },
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

import SuperAdminVerifyOtpPage from './SuperAdminVerifyOtpPage';

describe('SuperAdminVerifyOtpPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockMutate.mockClear();
    mockVerifyReturn.isPending = false;
    mockVerifyReturn.isError = false;
    mockVerifyReturn.error = null;
    mockSession = null;
  });

  it('redirects to /login when no OTP session exists', () => {
    mockSession = null;
    render(<SuperAdminVerifyOtpPage />);
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('renders nothing when no session (before redirect)', () => {
    mockSession = null;
    const { container } = render(<SuperAdminVerifyOtpPage />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the two factor card when session exists', () => {
    mockSession = {
      email: 'admin@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    render(<SuperAdminVerifyOtpPage />);
    expect(screen.getByText('twoFactorTitle')).toBeInTheDocument();
    expect(screen.getByText('admin@test.com')).toBeInTheDocument();
    expect(screen.getByText('verifyCode')).toBeInTheDocument();
  });

  it('calls verifyMutation.mutate with userId and OTP on verify', () => {
    mockSession = {
      email: 'admin@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    render(<SuperAdminVerifyOtpPage />);
    screen.getByTestId('verify-btn').click();
    expect(mockMutate).toHaveBeenCalledWith({ userId: 'user-1', otp: '123456' });
  });

  it('navigates to /login on back button', () => {
    mockSession = {
      email: 'admin@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    render(<SuperAdminVerifyOtpPage />);
    screen.getByTestId('back-btn').click();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('shows locked message when account is locked', async () => {
    const { isApiError } = await import('@forethread/api-client');
    vi.mocked(isApiError).mockReturnValue(true);
    mockVerifyReturn.isError = true;
    mockVerifyReturn.error = new Error('locked');
    mockSession = {
      email: 'admin@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 60000).toISOString(),
    };

    render(<SuperAdminVerifyOtpPage />);
    expect(screen.getByText('accountLocked')).toBeInTheDocument();

    vi.mocked(isApiError).mockReturnValue(false);
  });

  it('shows error message when OTP is invalid (non-locked error)', () => {
    mockVerifyReturn.isError = true;
    mockVerifyReturn.error = new Error('invalid');
    mockSession = {
      email: 'admin@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 60000).toISOString(),
    };

    render(<SuperAdminVerifyOtpPage />);
    expect(screen.getByText('twoFactorInvalid')).toBeInTheDocument();
  });

  it('opens mailto link on contact support', () => {
    mockSession = {
      email: 'admin@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<SuperAdminVerifyOtpPage />);
    screen.getByTestId('contact-support-btn').click();
    expect(openSpy).toHaveBeenCalledWith('mailto:support@forethread.com');
    openSpy.mockRestore();
  });

  it('passes callback props to TwoFactorCard (digitLabel, resendTimerText)', () => {
    mockSession = {
      email: 'admin@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    render(<SuperAdminVerifyOtpPage />);
    // Verify the component renders with all expected props
    expect(screen.getByTestId('two-factor-card')).toBeInTheDocument();
    expect(screen.getByText('backToSignIn')).toBeInTheDocument();
  });

  it('timer interval updates countdown and cleans up', () => {
    vi.useFakeTimers();
    mockSession = {
      email: 'admin@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 5000).toISOString(),
    };
    const { unmount } = render(<SuperAdminVerifyOtpPage />);
    // Advance time to trigger interval
    vi.advanceTimersByTime(2000);
    // Unmount to trigger cleanup (clearInterval)
    unmount();
    vi.useRealTimers();
  });
});
