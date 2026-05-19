const mockNavigate = vi.hoisted(() => vi.fn());
const mockSession = vi.hoisted(() => ({
  value: null as { email: string; userId: string; otpExpiresAt: string } | null,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/api-client', () => ({
  isApiError: vi.fn(() => false),
  HTTP_STATUS: { LOCKED: 423 },
}));

vi.mock('@forethread/ui-components', () => ({
  TwoFactorCard: (props: Record<string, unknown>) => (
    <div data-testid="two-factor">
      <span>{props.title as string}</span>
      <span>{props.email as string}</span>
      {Boolean(props.onVerify) && (
        <button
          data-testid="verify-btn"
          onClick={() => (props.onVerify as (otp: string) => void)('123456')}
        >
          verify
        </button>
      )}
      {Boolean(props.onBackToLogin) && (
        <button data-testid="back-to-login" onClick={props.onBackToLogin as () => void}>
          back
        </button>
      )}
      {Boolean(props.onContactSupport) && (
        <button data-testid="contact-support" onClick={props.onContactSupport as () => void}>
          support
        </button>
      )}
    </div>
  ),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('../services/auth.service', () => ({
  useVerifyOtp: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
  loadOtpSession: () => mockSession.value,
}));

import { render, screen, fireEvent } from '@testing-library/react';

import ProcurementOfficerVerifyOtpPage from './ProcurementOfficerVerifyOtpPage';

describe('ProcurementOfficerVerifyOtpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.value = null;
  });

  it('redirects to login when no session', () => {
    render(<ProcurementOfficerVerifyOtpPage />);
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('renders two factor card when session exists', () => {
    mockSession.value = {
      email: 'test@example.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 300000).toISOString(),
    };
    render(<ProcurementOfficerVerifyOtpPage />);
    expect(screen.getByTestId('two-factor')).toBeInTheDocument();
    expect(screen.getByText('twoFactorTitle')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('calls onVerify callback with otp', () => {
    mockSession.value = {
      email: 'test@example.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 300000).toISOString(),
    };
    render(<ProcurementOfficerVerifyOtpPage />);
    fireEvent.click(screen.getByTestId('verify-btn'));
    // The onVerify callback calls verifyMutation.mutate
  });

  it('calls onBackToLogin which navigates to /login', () => {
    mockSession.value = {
      email: 'test@example.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 300000).toISOString(),
    };
    render(<ProcurementOfficerVerifyOtpPage />);
    fireEvent.click(screen.getByTestId('back-to-login'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('calls onContactSupport which opens mailto', () => {
    mockSession.value = {
      email: 'test@example.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 300000).toISOString(),
    };
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<ProcurementOfficerVerifyOtpPage />);
    fireEvent.click(screen.getByTestId('contact-support'));
    expect(openSpy).toHaveBeenCalledWith('mailto:support@forethread.com');
    openSpy.mockRestore();
  });
});
