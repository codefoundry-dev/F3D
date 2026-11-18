import * as apiClient from '@forethread/api-client';
import { createAuthHooks } from '@forethread/auth';
import { notificationService } from '@forethread/ui-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The one-time code is only asked for on a new device or browser. On a trusted
// browser the password step already signs the user in, so the app must go
// straight in rather than to the code screen.

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
  return { ...actual, login: vi.fn(), getMe: vi.fn() };
});

const mockedLogin = apiClient.login as unknown as ReturnType<typeof vi.fn>;
const mockedGetMe = apiClient.getMe as unknown as ReturnType<typeof vi.fn>;

const setAuth = vi.fn();
const clearAuth = vi.fn();
type StorePart = { setAuth: typeof setAuth; clearAuth: typeof clearAuth };
const useAuthStore = (<T,>(selector: (s: StorePart) => T): T =>
  selector({ setAuth, clearAuth })) as unknown as Parameters<typeof createAuthHooks>[1];

const OTP_KEY = 'test-otp-session';
const CREDS = { email: 'buyer@test.local', password: 'Password123' };
const USER = {
  id: 'u1',
  name: 'Buyer',
  email: CREDS.email,
  role: 'PROCUREMENT_OFFICER',
  companyId: 'c1',
  permissions: ['rfq.list'],
};

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const hooks = createAuthHooks(OTP_KEY, useAuthStore);
  return renderHook(() => hooks.useLogin(), { wrapper });
}

describe('useLogin — trusted browser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('on a new browser, saves the code session and goes to the code screen', async () => {
    mockedLogin.mockResolvedValue({
      otpRequired: true,
      userId: 'u1',
      otpExpiresAt: '2026-11-18T12:00:00.000Z',
    });
    const { result } = setup();

    result.current.mutate(CREDS);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/verify-otp'));
    expect(JSON.parse(sessionStorage.getItem(OTP_KEY) as string)).toEqual({
      userId: 'u1',
      email: CREDS.email,
      otpExpiresAt: '2026-11-18T12:00:00.000Z',
    });
    expect(mockedGetMe).not.toHaveBeenCalled();
    expect(setAuth).not.toHaveBeenCalled();
  });

  it('on a trusted browser, signs straight in without the code screen', async () => {
    mockedLogin.mockResolvedValue({ otpRequired: false });
    mockedGetMe.mockResolvedValue(USER);
    const { result } = setup();

    result.current.mutate(CREDS);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
    expect(mockNavigate).not.toHaveBeenCalledWith('/verify-otp');
    expect(setAuth).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', role: 'PROCUREMENT_OFFICER' }),
    );
    expect(sessionStorage.getItem(OTP_KEY)).toBeNull();
    // No "we sent you a code" toast — no code was sent.
    expect(notificationService.info).not.toHaveBeenCalled();
  });

  it('on a trusted browser whose session fails to start, says so and stays on sign-in', async () => {
    mockedLogin.mockResolvedValue({ otpRequired: false });
    mockedGetMe.mockRejectedValue(new Error('401'));
    const { result } = setup();

    result.current.mutate(CREDS);

    await waitFor(() =>
      expect(notificationService.error).toHaveBeenCalledWith('auth:signInSessionFailed'),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(setAuth).not.toHaveBeenCalled();
  });
});
