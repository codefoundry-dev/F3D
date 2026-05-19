import { isApiError, HTTP_STATUS } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { TwoFactorCard } from '@forethread/ui-components';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useVerifyOtp, loadOtpSession } from '../services/auth.service';

export default function SuperAdminVerifyOtpPage() {
  const navigate = useNavigate();
  const { t } = useTranslation(['auth']);
  const session = loadOtpSession();
  const verifyMutation = useVerifyOtp();

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

  const isLocked = isApiError(verifyMutation.error, HTTP_STATUS.LOCKED);

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
      errorMessage={t('twoFactorInvalid')}
      isPending={verifyMutation.isPending}
      isError={verifyMutation.isError && !isLocked}
      secondsLeft={secondsLeft}
      isLocked={isLocked}
      lockedMessage={t('accountLocked')}
      contactSupportLabel={t('contactSupport')}
      onVerify={(otp) => verifyMutation.mutate({ userId: session.userId, otp })}
      onBackToLogin={() => navigate('/login')}
      onContactSupport={() => window.open('mailto:support@forethread.com')}
    />
  );
}
