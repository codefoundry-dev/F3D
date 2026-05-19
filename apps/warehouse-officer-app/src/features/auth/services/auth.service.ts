import { createAuthHooks } from '@forethread/auth';

import { useAuthStore } from '../state/auth.store';

const hooks = createAuthHooks('forethread-warehouse-officer-otp-session', useAuthStore);

export const {
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
} = hooks;
