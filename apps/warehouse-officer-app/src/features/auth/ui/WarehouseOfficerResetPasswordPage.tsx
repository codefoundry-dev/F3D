import { useTranslation } from '@forethread/i18n';
import { passwordFormSchema, type PasswordFormValues } from '@forethread/shared-types/client';
import { ResetPasswordForm } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import EyeClosedIcon from '@forethread/ui-components/assets/icons/eye-closed.svg?react';
import EyeOpenedIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import KeyIcon from '@forethread/ui-components/assets/icons/key-icon.svg?react';
import LockSimpleIcon from '@forethread/ui-components/assets/icons/lock-simple.svg?react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';

import { useResetPassword } from '../services/auth.service';

export default function WarehouseOfficerResetPasswordPage() {
  const { t } = useTranslation(['auth', 'common', 'validation']);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const resetMutation = useResetPassword();

  const {
    register,
    handleSubmit,
    watch,
    formState: { isValid },
  } = useForm<PasswordFormValues>({
    mode: 'onChange',
    resolver: zodResolver(passwordFormSchema),
  });

  const password = watch('newPassword', '');
  const confirmPassword = watch('confirmPassword', '');
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="bg-card rounded-2xl border border-destructive/20 p-8 max-w-md text-center">
          <p className="text-destructive">{t('resetLinkMissing')}</p>
          <Link
            to="/forgot-password"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            {t('requestNewLink')}
          </Link>
        </div>
      </div>
    );
  }

  const errorContent = passwordsMismatch ? (
    t('passwordsDoNotMatch')
  ) : resetMutation.isError ? (
    <>
      {t('resetLinkInvalid')}&nbsp;
      <Link to="/forgot-password" className="underline">
        {t('requestNewLink')}
      </Link>
      .
    </>
  ) : undefined;

  return (
    <ResetPasswordForm
      icon={<KeyIcon className="w-6 h-6 text-muted-foreground" />}
      passwordIcon={<LockSimpleIcon className="w-5 h-5" />}
      eyeOpenIcon={<EyeOpenedIcon className="w-5 h-5" />}
      eyeClosedIcon={<EyeClosedIcon className="w-5 h-5" />}
      checkIcon={<CheckCircleIcon className="w-4 h-4" />}
      errorIcon={<InfoIcon className="w-5 h-5" />}
      title={t('setNewPasswordTitle')}
      description={t('setNewPasswordDescription')}
      newPasswordLabel={t('newPasswordLabel')}
      newPasswordPlaceholder={t('newPasswordPlaceholder')}
      confirmPasswordLabel={t('confirmNewPasswordLabel')}
      confirmPasswordPlaceholder={t('confirmNewPasswordPlaceholder')}
      requirementsLabel={t('passwordMustContain')}
      rules={[
        { label: t('reqMinChars'), passed: password.length >= 8 },
        { label: t('reqLowercase'), passed: /[a-z]/.test(password) },
        { label: t('reqUppercase'), passed: /[A-Z]/.test(password) },
        { label: t('reqNumber'), passed: /[0-9]/.test(password) },
        { label: t('reqSymbol'), passed: /[^A-Za-z0-9]/.test(password) },
        { label: t('reqNotBreached'), passed: password.length > 0 },
      ]}
      submitLabel={t('resetPassword')}
      backLabel={t('backToSignIn')}
      isPending={resetMutation.isPending}
      isValid={isValid && !passwordsMismatch}
      isSuccess={resetMutation.isSuccess}
      errorContent={errorContent}
      successContent={resetMutation.isSuccess ? t('resetSuccess') : undefined}
      successTitle={t('resetSuccessTitle')}
      successSubtitle={t('resetSuccessSubtitle')}
      successAlertContent={
        <>
          <p>{t('resetSuccessAlertBody')}</p>
          <p className="mt-2">{t('resetSuccessAlertLogin')}</p>
        </>
      }
      successBackLabel={t('resetSuccessBackToLogin')}
      successRedirectText={t('resetSuccessRedirect')}
      onRedirectToLogin={() => navigate('/login')}
      onSubmit={(e) =>
        void handleSubmit((data) => resetMutation.mutate({ token, newPassword: data.newPassword }))(
          e,
        )
      }
      newPasswordInputProps={register('newPassword')}
      confirmPasswordInputProps={register('confirmPassword')}
    />
  );
}
