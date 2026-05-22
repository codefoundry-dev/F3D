import {
  login,
  verifyOtp,
  logout as apiLogout,
  forgotPassword as apiForgotPassword,
  resetPassword as apiResetPassword,
  activateAccount as apiActivateAccount,
  validateActivationToken as apiValidateActivationToken,
  requestNewInvitation as apiRequestNewInvitation,
  getMe,
  type LoginDto,
  type VerifyOtpDto,
  type ForgotPasswordDto,
  type ResetPasswordDto,
  type ActivateAccountDto,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { notificationService } from '@forethread/ui-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import type { AuthState } from './createAuthStore';

type UseAuthStore = {
  <T>(selector: (state: AuthState) => T): T;
};

export interface OtpSession {
  userId: string;
  email: string;
  otpExpiresAt: string;
}

function makeOtpHelpers(otpSessionKey: string) {
  const saveOtpSession = (session: OtpSession): void => {
    sessionStorage.setItem(otpSessionKey, JSON.stringify(session));
  };

  const loadOtpSession = (): OtpSession | null => {
    const raw = sessionStorage.getItem(otpSessionKey);
    return raw ? (JSON.parse(raw) as OtpSession) : null;
  };

  const clearOtpSession = (): void => {
    sessionStorage.removeItem(otpSessionKey);
  };

  return { saveOtpSession, loadOtpSession, clearOtpSession };
}

/**
 * Factory that creates all auth-related React hooks for a specific app.
 *
 * @param otpSessionKey - Unique sessionStorage key per app (e.g. 'forethread-company-otp-session')
 * @param useAuthStore  - The Zustand auth store hook created by `createAuthStore`
 */
export function createAuthHooks(otpSessionKey: string, useAuthStore: UseAuthStore) {
  const { saveOtpSession, loadOtpSession, clearOtpSession } = makeOtpHelpers(otpSessionKey);

  /**
   * Verifies the session on app mount by calling getMe() with persisted cookies.
   * Sets isAuthenticated=true if valid, clears auth if not.
   */
  function useCheckAuth() {
    const setAuth = useAuthStore((s) => s.setAuth);
    const clearAuth = useAuthStore((s) => s.clearAuth);

    useEffect(() => {
      const abortController = new AbortController();

      getMe({ skipErrorHandler: true, signal: abortController.signal })
        .then((user) => {
          if (!abortController.signal.aborted) {
            setAuth({
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              companyId: user.companyId,
              permissions: user.permissions ?? [],
            });
          }
        })
        .catch(() => {
          if (!abortController.signal.aborted) {
            clearAuth();
          }
        });

      return () => {
        abortController.abort();
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
  }

  function useLogin() {
    const navigate = useNavigate();
    const { t } = useTranslation(['auth']);

    return useMutation({
      mutationFn: (dto: LoginDto & { email: string }) => login(dto, { skipErrorHandler: true }),
      onSuccess: (data, variables) => {
        saveOtpSession({
          userId: data.userId,
          email: variables.email,
          otpExpiresAt: data.otpExpiresAt,
        });
        notificationService.info(t('auth:resendToast'));
        navigate('/verify-otp');
      },
    });
  }

  function useVerifyOtp() {
    const navigate = useNavigate();
    const setAuth = useAuthStore((s) => s.setAuth);

    return useMutation({
      mutationFn: (dto: VerifyOtpDto) => verifyOtp(dto, { skipErrorHandler: true }),
      onSuccess: async () => {
        // Cookies are set automatically by the backend response
        const user = await getMe({ skipErrorHandler: true });
        setAuth({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          permissions: user.permissions ?? [],
        });

        clearOtpSession();
        navigate('/');
      },
    });
  }

  function useLogout() {
    const navigate = useNavigate();
    const clearAuth = useAuthStore((s) => s.clearAuth);

    return useMutation({
      mutationFn: () => apiLogout(),
      onSettled: () => {
        clearAuth();
        navigate('/login');
      },
    });
  }

  function useForgotPassword() {
    return useMutation({
      mutationFn: (dto: ForgotPasswordDto) => apiForgotPassword(dto),
    });
  }

  function useResetPassword() {
    return useMutation({
      mutationFn: (dto: ResetPasswordDto) => apiResetPassword(dto, { skipErrorHandler: true }),
    });
  }

  function useActivateAccount() {
    return useMutation({
      mutationFn: (dto: ActivateAccountDto) => apiActivateAccount(dto, { skipErrorHandler: true }),
    });
  }

  function useValidateActivationToken(token: string) {
    return useQuery({
      queryKey: ['validateActivationToken', token],
      queryFn: () => apiValidateActivationToken(token, { skipErrorHandler: true }),
      enabled: !!token,
      retry: false,
    });
  }

  function useRequestNewInvitation() {
    const { t } = useTranslation(['auth']);

    return useMutation({
      mutationFn: (email: string) => apiRequestNewInvitation(email),
      onSuccess: () => {
        notificationService.success(t('auth:newInvitationSent'));
      },
    });
  }

  return {
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
  };
}

export type AuthHooks = ReturnType<typeof createAuthHooks>;
