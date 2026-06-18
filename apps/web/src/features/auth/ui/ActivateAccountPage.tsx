import { useTranslation } from '@forethread/i18n';
import { passwordFormSchema, type PasswordFormValues } from '@forethread/shared-types/client';
import {
  AuthLayout,
  Button,
  ContactSupportLink,
  IconBadge,
  PageLoader,
  ResetPasswordForm,
  Text,
} from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import ClockIcon from '@forethread/ui-components/assets/icons/clock-icon.svg?react';
import EyeClosedIcon from '@forethread/ui-components/assets/icons/eye-closed.svg?react';
import EyeOpenedIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import KeyIcon from '@forethread/ui-components/assets/icons/key-icon.svg?react';
import LockSimpleIcon from '@forethread/ui-components/assets/icons/lock-simple.svg?react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';

import {
  useActivateAccount,
  useRequestNewInvitation,
  useValidateActivationToken,
} from '../services/auth.service';

export default function ActivateAccountPage() {
  const { t } = useTranslation(['auth', 'common', 'validation']);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const tokenQuery = useValidateActivationToken(token);
  const activateMutation = useActivateAccount();
  const requestInvitationMutation = useRequestNewInvitation();

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
          <p className="text-destructive">{t('activateLinkMissing')}</p>
        </div>
      </div>
    );
  }

  if (tokenQuery.isLoading) {
    return <PageLoader />;
  }

  if (tokenQuery.isError || (tokenQuery.data && !tokenQuery.data.valid)) {
    const email = tokenQuery.data?.email;

    return (
      <AuthLayout
        icon={<IconBadge icon={<ClockIcon className="w-6 h-6 text-muted-foreground" />} />}
        title={t('invitationExpiredTitle')}
        description={t('invitationExpiredSubtitle')}
      >
        <div className="space-y-10">
          {email && (
            <Text variant="body-16" as="p">
              <span
                dangerouslySetInnerHTML={{
                  __html: t('invitationExpiredBody', { email }),
                }}
              />
            </Text>
          )}

          <div className="space-y-4">
            <Button
              type="button"
              size="lg"
              className="w-full"
              isLoading={requestInvitationMutation.isPending}
              disabled={!email || requestInvitationMutation.isSuccess}
              onClick={() => email && requestInvitationMutation.mutate(email)}
            >
              {t('requestNewLink')}
            </Button>

            <ContactSupportLink
              label={t('contactSupport')}
              className="text-lg font-medium text-foreground hover:underline"
            />
          </div>
        </div>
      </AuthLayout>
    );
  }

  const errorContent = passwordsMismatch ? (
    t('passwordsDoNotMatch')
  ) : activateMutation.isError ? (
    <>
      {t('activateLinkInvalid')}&nbsp;
      <Link to="/login" className="underline">
        {t('backToSignIn')}
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
      title={t('setPassword')}
      description={t('setPasswordDescription')}
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
      submitLabel={t('activateAccount')}
      backLabel={t('backToSignIn')}
      isPending={activateMutation.isPending}
      isValid={isValid && !passwordsMismatch}
      isSuccess={activateMutation.isSuccess}
      errorContent={errorContent}
      successTitle={t('activateSuccessTitle')}
      successSubtitle={t('activateSuccessSubtitle')}
      successAlertContent={<p>{t('activateSuccessAlertBody')}</p>}
      successBackLabel={t('backToSignIn')}
      successRedirectText={t('activateSuccessRedirect')}
      onRedirectToLogin={() => navigate('/login')}
      onSubmit={(e) =>
        void handleSubmit((data) => activateMutation.mutate({ token, password: data.newPassword }))(
          e,
        )
      }
      newPasswordInputProps={register('newPassword')}
      confirmPasswordInputProps={register('confirmPassword')}
    />
  );
}
