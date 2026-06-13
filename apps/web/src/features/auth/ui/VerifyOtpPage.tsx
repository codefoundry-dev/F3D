import { isApiError, HTTP_STATUS } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { TwoFactorCard } from '@forethread/ui-components';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useVerifyOtp, useResendOtp, loadOtpSession } from '../services/auth.service';

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const { t } = useTranslation(['auth']);
  const session = loadOtpSession();
  const verifyMutation = useVerifyOtp();
  const resendMutation = useResendOtp();

  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (!session) {
      navigate('/login', { replace: true });
      return;
    }

    const expiry = new Date(session.otpExpiresAt).getTime();
    const updateTimer = () => {
      const diff = Math.max(0, Math.round((expiry - Date.now()) / 1000));
      setSecondsLeft(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session, navigate]);

  if (!session) return null;

  const error = verifyMutation.error;
  const isLocked = isApiError(error, HTTP_STATUS.LOCKED);

  // Surface the real reason instead of a catch-all "Invalid code":
  //   401 → wrong digits; 400 → code expired / already used / superseded
  //   (request a new one); anything else → a transient failure.
  const errorMessage = isApiError(error, 401)
    ? t('twoFactorInvalid')
    : isApiError(error, 400)
      ? t('twoFactorCodeUnavailable')
      : t('twoFactorVerifyFailed');

  return (
    <TwoFactorCard
      title={t('twoFactorTitle')}
      description={t('twoFactorDescription')}
      email={session.email}
      digitLabel={(index) => t('twoFactorDigitLabel', { index })}
      expiresInText={t('twoFactorExpiresIn')}
      expiredText={t('twoFactorExpired')}
      verifyLabel={t('verifyCode')}
      didntReceiveText={t('didntReceiveCode')}
      resendTimerText={(time) => t('resendAvailableIn', { time })}
      resendLabel={t('resendCode')}
      backLabel={t('backToSignIn')}
      errorMessage={errorMessage}
      isPending={verifyMutation.isPending}
      isError={verifyMutation.isError && !isLocked}
      secondsLeft={secondsLeft}
      isLocked={isLocked}
      lockedMessage={t('accountLocked')}
      contactSupportLabel={t('contactSupport')}
      isResending={resendMutation.isPending}
      onVerify={(otp) => verifyMutation.mutate({ userId: session.userId, otp })}
      onResend={() => resendMutation.mutate({ userId: session.userId })}
      onBackToLogin={() => navigate('/login')}
      onContactSupport={() => window.open('mailto:support@forethread.com')}
    />
  );
}
