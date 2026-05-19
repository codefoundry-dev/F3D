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
  createAuthStore: vi.fn(() => vi.fn()),
}));

import { createAuthHooks } from '@forethread/auth';

import { useAuthStore } from '../state/auth.store';

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
  it('calls createAuthHooks with correct arguments', () => {
    expect(createAuthHooks).toHaveBeenCalledWith('forethread-otp-session', useAuthStore);
  });

  it.each([
    ['saveOtpSession', saveOtpSession],
    ['loadOtpSession', loadOtpSession],
    ['clearOtpSession', clearOtpSession],
    ['useCheckAuth', useCheckAuth],
    ['useLogin', useLogin],
    ['useVerifyOtp', useVerifyOtp],
    ['useLogout', useLogout],
    ['useForgotPassword', useForgotPassword],
    ['useResetPassword', useResetPassword],
    ['useActivateAccount', useActivateAccount],
    ['useValidateActivationToken', useValidateActivationToken],
    ['useRequestNewInvitation', useRequestNewInvitation],
  ])('%s is defined', (_name, fn) => {
    expect(fn).toBeDefined();
  });
});
