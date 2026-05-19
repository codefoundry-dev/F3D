vi.mock('@forethread/auth', () => ({
  createAuthHooks: vi.fn(() => ({
    saveOtpSession: vi.fn(),
    loadOtpSession: vi.fn(),
    clearOtpSession: vi.fn(),
    useCheckAuth: vi.fn(),
    useLogin: vi.fn(),
    useVerifyOtp: vi.fn(),
    useLogout: vi.fn(),
    useForgotPassword: vi.fn(),
    useResetPassword: vi.fn(),
    useActivateAccount: vi.fn(),
    useValidateActivationToken: vi.fn(),
    useRequestNewInvitation: vi.fn(),
  })),
}));

vi.mock('../state/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

import { createAuthHooks } from '@forethread/auth';

import {
  saveOtpSession,
  loadOtpSession,
  clearOtpSession,
  useCheckAuth,
  useLogin,
  useVerifyOtp,
  useLogout,
  useForgotPassword,
  useResetPassword,
  useActivateAccount,
  useValidateActivationToken,
  useRequestNewInvitation,
} from './auth.service';

describe('auth.service', () => {
  it('creates hooks with correct storage key', () => {
    expect(createAuthHooks).toHaveBeenCalledWith(
      'forethread-procurement-officer-otp-session',
      expect.any(Function),
    );
  });

  it('exports all hooks', () => {
    expect(saveOtpSession).toBeDefined();
    expect(loadOtpSession).toBeDefined();
    expect(clearOtpSession).toBeDefined();
    expect(useCheckAuth).toBeDefined();
    expect(useLogin).toBeDefined();
    expect(useVerifyOtp).toBeDefined();
    expect(useLogout).toBeDefined();
    expect(useForgotPassword).toBeDefined();
    expect(useResetPassword).toBeDefined();
    expect(useActivateAccount).toBeDefined();
    expect(useValidateActivationToken).toBeDefined();
    expect(useRequestNewInvitation).toBeDefined();
  });
});
