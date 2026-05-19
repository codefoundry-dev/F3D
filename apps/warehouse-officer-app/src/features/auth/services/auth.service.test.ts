import { describe, it, expect, vi } from 'vitest';

const mockCreateAuthHooks = vi.fn(() => ({
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
}));

vi.mock('@forethread/auth', () => ({
  createAuthHooks: mockCreateAuthHooks,
}));

vi.mock('../state/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

describe('auth.service', () => {
  it('creates auth hooks with correct storage key and auth store', async () => {
    const { useAuthStore } = await import('../state/auth.store');

    await import('./auth.service');

    expect(mockCreateAuthHooks).toHaveBeenCalledWith(
      'forethread-warehouse-officer-otp-session',
      useAuthStore,
    );
  });

  it('exports all required hooks', async () => {
    const service = await import('./auth.service');

    expect(service.saveOtpSession).toBeDefined();
    expect(service.loadOtpSession).toBeDefined();
    expect(service.clearOtpSession).toBeDefined();
    expect(service.useCheckAuth).toBeDefined();
    expect(service.useLogin).toBeDefined();
    expect(service.useVerifyOtp).toBeDefined();
    expect(service.useLogout).toBeDefined();
    expect(service.useForgotPassword).toBeDefined();
    expect(service.useResetPassword).toBeDefined();
    expect(service.useActivateAccount).toBeDefined();
    expect(service.useValidateActivationToken).toBeDefined();
    expect(service.useRequestNewInvitation).toBeDefined();
  });
});
