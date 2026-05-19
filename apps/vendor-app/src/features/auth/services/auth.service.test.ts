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
  it('exports saveOtpSession', () => {
    expect(saveOtpSession).toBeDefined();
  });

  it('exports loadOtpSession', () => {
    expect(loadOtpSession).toBeDefined();
  });

  it('exports clearOtpSession', () => {
    expect(clearOtpSession).toBeDefined();
  });

  it('exports useCheckAuth', () => {
    expect(useCheckAuth).toBeDefined();
  });

  it('exports useLogin', () => {
    expect(useLogin).toBeDefined();
  });

  it('exports useVerifyOtp', () => {
    expect(useVerifyOtp).toBeDefined();
  });

  it('exports useLogout', () => {
    expect(useLogout).toBeDefined();
  });

  it('exports useForgotPassword', () => {
    expect(useForgotPassword).toBeDefined();
  });

  it('exports useResetPassword', () => {
    expect(useResetPassword).toBeDefined();
  });

  it('exports useActivateAccount', () => {
    expect(useActivateAccount).toBeDefined();
  });

  it('exports useValidateActivationToken', () => {
    expect(useValidateActivationToken).toBeDefined();
  });

  it('exports useRequestNewInvitation', () => {
    expect(useRequestNewInvitation).toBeDefined();
  });
});
