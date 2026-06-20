import { isApiError, HTTP_STATUS } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import EnvelopeSimpleIcon from '../assets/icons/envelope-simple.svg?react';
import EyeClosedIcon from '../assets/icons/eye-closed.svg?react';
import EyeOpenedIcon from '../assets/icons/eye-opened.svg?react';
import InfoIcon from '../assets/icons/info.svg?react';
import LockSimpleIcon from '../assets/icons/lock-simple.svg?react';

import { LoginForm } from './LoginForm';

type LoginFormData = {
  email: string;
  password: string;
};

export interface LoginPageProps {
  /** TanStack Query mutation for login */
  loginMutation: {
    mutate: (data: LoginFormData) => void;
    isPending: boolean;
    isError: boolean;
    error: unknown;
  };
}

export function LoginPage({ loginMutation }: LoginPageProps) {
  const { t } = useTranslation(['auth', 'common', 'validation']);

  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('validation:emailRequired')),
        password: z.string().min(8, t('validation:passwordMin')),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFormData>({
    mode: 'onChange',
    resolver: zodResolver(loginSchema),
  });

  const isNotActivated = isApiError(
    loginMutation.error,
    HTTP_STATUS.FORBIDDEN,
    'ACCOUNT_NOT_ACTIVATED',
  );

  const errorMessage = isNotActivated ? t('accountNotActivated') : t('loginError');

  return (
    <LoginForm
      emailIcon={<EnvelopeSimpleIcon className="w-5 h-5" />}
      passwordIcon={<LockSimpleIcon className="w-5 h-5" />}
      eyeOpenIcon={<EyeOpenedIcon className="w-5 h-5" />}
      eyeClosedIcon={<EyeClosedIcon className="w-5 h-5" />}
      errorIcon={<InfoIcon className="w-5 h-5" />}
      title={t('signInTitle')}
      description={t('signInDescription')}
      emailLabel={t('emailLabel')}
      emailPlaceholder={t('emailPlaceholder')}
      emailError={errors.email?.message}
      passwordLabel={t('passwordLabel')}
      passwordError={errors.password?.message}
      forgotPasswordLabel={t('forgotPassword')}
      submitLabel={t('signIn')}
      isError={loginMutation.isError}
      errorMessage={errorMessage}
      isPending={loginMutation.isPending}
      isValid={isValid}
      onSubmit={(e) => void handleSubmit((data) => loginMutation.mutate(data))(e)}
      emailInputProps={register('email')}
      passwordInputProps={register('password')}
    />
  );
}
