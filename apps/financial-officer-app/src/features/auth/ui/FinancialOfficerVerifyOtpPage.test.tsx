import { render, screen, fireEvent } from '@testing-library/react';

const mockSession = vi.hoisted(() => ({
  value: null as { email: string; userId: string; otpExpiresAt: string } | null,
}));

const mockVerifyMutation = vi.hoisted(() => ({
  value: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  },
}));

const mockNavigate = vi.fn();

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/api-client', () => ({
  isApiError: vi.fn(() => false),
  HTTP_STATUS: { LOCKED: 423 },
}));

vi.mock('../services/auth.service', () => ({
  useVerifyOtp: () => mockVerifyMutation.value,
  loadOtpSession: () => mockSession.value,
}));

vi.mock('@forethread/ui-components', () => ({
  TwoFactorCard: (props: Record<string, unknown>) => {
    const onVerify = props.onVerify as ((otp: string) => void) | undefined;
    const onBackToLogin = props.onBackToLogin as (() => void) | undefined;
    const onContactSupport = props.onContactSupport as (() => void) | undefined;
    const digitLabel = props.digitLabel as ((index: number) => string) | undefined;
    const resendTimerText = props.resendTimerText as ((time: string) => string) | undefined;
    return (
      <div data-testid="two-factor-card">
        <span>{props.title as string}</span>
        <span>{props.email as string}</span>
        {digitLabel && <span>{digitLabel(1)}</span>}
        {resendTimerText && <span>{resendTimerText('00:30')}</span>}
        {onVerify && (
          <button data-testid="verify" onClick={() => onVerify('123456')}>
            Verify
          </button>
        )}
        {onBackToLogin && (
          <button data-testid="back" onClick={onBackToLogin}>
            Back
          </button>
        )}
        {onContactSupport && (
          <button data-testid="support" onClick={onContactSupport}>
            Support
          </button>
        )}
      </div>
    );
  },
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

import FinancialOfficerVerifyOtpPage from './FinancialOfficerVerifyOtpPage';

describe('FinancialOfficerVerifyOtpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.value = null;
    mockVerifyMutation.value = {
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    };
  });

  it('redirects to login when no session', () => {
    render(<FinancialOfficerVerifyOtpPage />);
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('renders nothing when no session', () => {
    const { container } = render(<FinancialOfficerVerifyOtpPage />);
    expect(container.innerHTML).toBe('');
  });

  it('renders two-factor card when session exists', () => {
    mockSession.value = {
      email: 'test@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 300000).toISOString(),
    };
    render(<FinancialOfficerVerifyOtpPage />);
    expect(screen.getByTestId('two-factor-card')).toBeInTheDocument();
    expect(screen.getByText('twoFactorTitle')).toBeInTheDocument();
    expect(screen.getByText('test@test.com')).toBeInTheDocument();
  });

  it('calls verify with otp', () => {
    mockSession.value = {
      email: 'test@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 300000).toISOString(),
    };
    render(<FinancialOfficerVerifyOtpPage />);
    fireEvent.click(screen.getByTestId('verify'));
    expect(mockVerifyMutation.value.mutate).toHaveBeenCalledWith({
      userId: 'user-1',
      otp: '123456',
    });
  });

  it('navigates back to login', () => {
    mockSession.value = {
      email: 'test@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 300000).toISOString(),
    };
    render(<FinancialOfficerVerifyOtpPage />);
    fireEvent.click(screen.getByTestId('back'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('opens support email', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    mockSession.value = {
      email: 'test@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 300000).toISOString(),
    };
    render(<FinancialOfficerVerifyOtpPage />);
    fireEvent.click(screen.getByTestId('support'));
    expect(openSpy).toHaveBeenCalledWith('mailto:support@forethread.com');
    openSpy.mockRestore();
  });
});
