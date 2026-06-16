import * as apiClient from '@forethread/api-client';
import { createAuthHooks } from '@forethread/auth';
import { notificationService } from '@forethread/ui-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// FOR-244: a correct OTP whose post-verify getMe() fails is a *session* problem,
// not a bad code. It must NOT surface as "Invalid code" on the verify screen.

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  notificationService: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof apiClient>();
  return { ...actual, verifyOtp: vi.fn(), getMe: vi.fn() };
});

const mockedVerifyOtp = apiClient.verifyOtp as unknown as ReturnType<typeof vi.fn>;
const mockedGetMe = apiClient.getMe as unknown as ReturnType<typeof vi.fn>;

const setAuth = vi.fn();
const clearAuth = vi.fn();
type StorePart = { setAuth: typeof setAuth; clearAuth: typeof clearAuth };
const useAuthStore = (<T,>(selector: (s: StorePart) => T): T =>
  selector({ setAuth, clearAuth })) as unknown as Parameters<typeof createAuthHooks>[1];

const OTP_KEY = 'test-otp-session';
const USER = {
  id: 'u1',
  name: 'Foreman',
  email: 'foreman@test.local',
  role: 'FOREMAN',
  companyId: 'c1',
  permissions: ['materialRequest.create'],
};

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const hooks = createAuthHooks(OTP_KEY, useAuthStore);
  const { result } = renderHook(() => hooks.useVerifyOtp(), { wrapper });
  return { result };
}

describe('useVerifyOtp — post-OTP session bootstrap (FOR-244)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.setItem(
      OTP_KEY,
      JSON.stringify({ userId: 'u1', email: 'foreman@test.local', otpExpiresAt: '' }),
    );
  });

  it('on a correct OTP, loads the user, clears the session and navigates home', async () => {
    mockedVerifyOtp.mockResolvedValue({ success: true });
    mockedGetMe.mockResolvedValue(USER);
    const { result } = setup();

    result.current.mutate({ userId: 'u1', otp: '123456' });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
    expect(setAuth).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1', role: 'FOREMAN' }));
    expect(notificationService.error).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(OTP_KEY)).toBeNull();
  });

  it('when the post-OTP session load 401s, shows a session error and returns to login — not "invalid code"', async () => {
    mockedVerifyOtp.mockResolvedValue({ success: true });
    mockedGetMe.mockRejectedValue({ statusCode: 401 });
    const { result } = setup();

    result.current.mutate({ userId: 'u1', otp: '123456' });

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
    expect(notificationService.error).toHaveBeenCalledWith('auth:twoFactorSessionFailed');
    expect(setAuth).not.toHaveBeenCalled();
    // The single-use OTP is spent, so the in-progress session is cleared for a clean retry.
    expect(sessionStorage.getItem(OTP_KEY)).toBeNull();
  });
});
