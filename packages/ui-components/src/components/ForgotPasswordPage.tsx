import { useTranslation, Trans } from '@forethread/i18n';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import CheckCircleIcon from '../assets/icons/checkcircle-icon.svg?react';
import EnvelopeSimpleIcon from '../assets/icons/envelope-simple.svg?react';
import KeyIcon from '../assets/icons/key-icon.svg?react';

import { CheckEmailCard } from './CheckEmailCard';
import { ForgotPasswordForm } from './ForgotPasswordForm';

type ForgotFormData = {
  email: string;
};

export interface ForgotPasswordPageProps {
  /** TanStack Query mutation for forgot password */
  forgotMutation: {
    mutate: (data: ForgotFormData) => void;
    isPending: boolean;
    isSuccess: boolean;
  };
  /** Path to navigate back to the login page */
  loginPath?: string;
}

export function ForgotPasswordPage({
  forgotMutation,
  loginPath = '/login',
}: ForgotPasswordPageProps) {
  const { t } = useTranslation(['auth', 'common', 'validation']);

  const forgotSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('validation:emailRequired')),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    getValues,
  } = useForm<ForgotFormData>({ mode: 'onChange', resolver: zodResolver(forgotSchema) });

  if (forgotMutation.isSuccess) {
    return (
      <CheckEmailCard
        icon={<CheckCircleIcon className="w-6 h-6 text-muted-foreground" />}
        title={t('resetEmailSentTitle')}
        subtitle={t('resetEmailSentSubtitle')}
        alertContent={
          <Trans
            i18nKey="auth:resetEmailSentDescription"
            values={{ email: getValues('email') }}
            components={{ strong: <strong className="font-semibold" /> }}
          />
        }
        expiryText={t('resetLinkExpiry')}
        tips={[t('checkSpamFolder'), t('verifyEmailCorrect'), t('tryRequestingNewLink')]}
        backLabel={t('backToSignIn')}
        resendLabel={t('resendEmail')}
        isResending={forgotMutation.isPending}
        onBackToLogin={() => window.location.assign(loginPath)}
        onResend={() => forgotMutation.mutate({ email: getValues('email') })}
      />
    );
  }

  return (
    <ForgotPasswordForm
      icon={<KeyIcon className="w-6 h-6 text-muted-foreground" />}
      emailIcon={<EnvelopeSimpleIcon className="w-5 h-5" />}
      title={t('resetTitle')}
      description={t('resetDescription')}
      emailLabel={t('emailAddressLabel')}
      emailPlaceholder={t('emailPlaceholder')}
      emailError={errors.email?.message}
      submitLabel={forgotMutation.isPending ? t('sending') : t('sendResetLink')}
      backLabel={t('backToSignIn')}
      isPending={forgotMutation.isPending}
      isValid={isValid}
      onSubmit={(e) => void handleSubmit((data) => forgotMutation.mutate(data))(e)}
      emailInputProps={register('email')}
    />
  );
}
