import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNavigate = vi.fn();
const mockMutate = vi.fn();
let mockSession: { email: string; userId: string; otpExpiresAt: string } | null = null;
let mockVerifyReturn = {
  mutate: mockMutate,
  isPending: false,
  isError: false,
  error: null as Error | null,
};
let mockIsApiError = vi.fn((_error: unknown, _statusCode: number, _message?: string) => false);

vi.mock('@forethread/api-client', () => ({
  isApiError: (error: unknown, statusCode: number, message?: string) =>
    mockIsApiError(error, statusCode, message),
  HTTP_STATUS: { LOCKED: 423 },
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  TwoFactorCard: (props: Record<string, unknown>) => (
    <div data-testid="two-factor-card">
      <span data-testid="title">{props.title as string}</span>
      <span data-testid="email">{props.email as string}</span>
      <span data-testid="is-pending">{String(props.isPending)}</span>
      <span data-testid="is-error">{String(props.isError)}</span>
      <span data-testid="is-locked">{String(props.isLocked)}</span>
      <span data-testid="seconds-left">{String(props.secondsLeft)}</span>
      <span data-testid="digit-label">{(props.digitLabel as (i: number) => string)(1)}</span>
      <span data-testid="resend-timer">
        {(props.resendTimerText as (t: string) => string)('30')}
      </span>
      <button
        data-testid="verify"
        onClick={() => (props.onVerify as (otp: string) => void)('123456')}
      >
        verify
      </button>
      <button data-testid="back-to-login" onClick={props.onBackToLogin as () => void}>
        back
      </button>
      <button data-testid="contact-support" onClick={props.onContactSupport as () => void}>
        support
      </button>
    </div>
  ),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../services/auth.service', () => ({
  useVerifyOtp: () => mockVerifyReturn,
  loadOtpSession: () => mockSession,
}));

import WarehouseOfficerVerifyOtpPage from './WarehouseOfficerVerifyOtpPage';

describe('WarehouseOfficerVerifyOtpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockSession = null;
    mockIsApiError = vi.fn((_error: unknown, _statusCode: number, _message?: string) => false);
    mockVerifyReturn = {
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('redirects to login when no session', () => {
    mockSession = null;
    render(<WarehouseOfficerVerifyOtpPage />);
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('renders null when no session', () => {
    mockSession = null;
    const { container } = render(<WarehouseOfficerVerifyOtpPage />);
    expect(container.innerHTML).toBe('');
  });

  it('renders two-factor card when session exists', () => {
    mockSession = {
      email: 'test@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    render(<WarehouseOfficerVerifyOtpPage />);
    expect(screen.getByTestId('two-factor-card')).toBeInTheDocument();
    expect(screen.getByTestId('email')).toHaveTextContent('test@test.com');
  });

  it('calls verify mutate with userId and otp', () => {
    mockSession = {
      email: 'test@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    render(<WarehouseOfficerVerifyOtpPage />);
    fireEvent.click(screen.getByTestId('verify'));
    expect(mockMutate).toHaveBeenCalledWith({ userId: 'user-1', otp: '123456' });
  });

  it('navigates to login on back button', () => {
    mockSession = {
      email: 'test@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    render(<WarehouseOfficerVerifyOtpPage />);
    fireEvent.click(screen.getByTestId('back-to-login'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('opens mailto on contact support', () => {
    mockSession = {
      email: 'test@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const openMock = vi.fn();
    vi.stubGlobal('open', openMock);
    render(<WarehouseOfficerVerifyOtpPage />);
    fireEvent.click(screen.getByTestId('contact-support'));
    expect(openMock).toHaveBeenCalledWith('mailto:support@forethread.com');
    vi.unstubAllGlobals();
  });

  it('shows locked state when API returns LOCKED error', () => {
    mockIsApiError = vi.fn((_error: unknown, _statusCode: number, _message?: string) => true);
    mockVerifyReturn.isError = true;
    mockVerifyReturn.error = new Error('locked');
    mockSession = {
      email: 'test@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    render(<WarehouseOfficerVerifyOtpPage />);
    expect(screen.getByTestId('is-locked')).toHaveTextContent('true');
  });

  it('passes isError=true when error is not locked', () => {
    mockIsApiError = vi.fn((_error: unknown, _statusCode: number, _message?: string) => false);
    mockVerifyReturn.isError = true;
    mockVerifyReturn.error = new Error('bad code');
    mockSession = {
      email: 'test@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    render(<WarehouseOfficerVerifyOtpPage />);
    expect(screen.getByTestId('is-error')).toHaveTextContent('true');
    expect(screen.getByTestId('is-locked')).toHaveTextContent('false');
  });

  it('timer counts down and cleans up on unmount', () => {
    mockSession = {
      email: 'test@test.com',
      userId: 'user-1',
      otpExpiresAt: new Date(Date.now() + 5_000).toISOString(),
    };
    const { unmount } = render(<WarehouseOfficerVerifyOtpPage />);
    // Timer should show ~5 seconds
    const initialSeconds = Number(screen.getByTestId('seconds-left').textContent);
    expect(initialSeconds).toBeGreaterThanOrEqual(4);
    expect(initialSeconds).toBeLessThanOrEqual(5);

    // Unmounting triggers interval cleanup (no errors)
    unmount();
  });
});
