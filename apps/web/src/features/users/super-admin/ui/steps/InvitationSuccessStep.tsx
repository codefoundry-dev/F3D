import { useTranslation } from '@forethread/i18n';
import { Button, IconBadge } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import { useEffect, useState } from 'react';

interface InvitationSuccessStepProps {
  email: string;
  onClose: () => void;
}

const COUNTDOWN_SECONDS = 3;

export function InvitationSuccessStep({ email, onClose }: InvitationSuccessStepProps) {
  const { t } = useTranslation(['users', 'common']);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (countdown <= 0) {
      onClose();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onClose]);

  // Render the "email sent" copy with the email address emphasised in bold to
  // match the Figma success screen. The i18n value embeds {{email}} mid-sentence,
  // so we split the resolved string around the email and bold the matching part.
  const sentText = t('invitationSuccess.emailSent', { email });
  const parts = email ? sentText.split(email) : [sentText];

  return (
    <div className="flex flex-col items-center text-center">
      <IconBadge icon={<CheckCircleIcon className="w-6 h-6 text-foreground" />} />

      <h2 className="text-2xl font-semibold leading-[140%] text-foreground mt-4">
        {t('invitationSuccess.title')}
      </h2>
      <p className="text-sm text-muted-foreground mt-1">{t('invitationSuccess.subtitle')}</p>

      {/* Green info box with bold email */}
      <div className="w-full mt-5 rounded-xl bg-success/10 border border-success/20 px-4 py-3 text-left">
        <p className="text-sm leading-relaxed text-success">
          {parts.length > 1
            ? parts.flatMap((part, i) =>
                i < parts.length - 1
                  ? [
                      part,
                      <strong key={i} className="font-bold">
                        {email}
                      </strong>,
                    ]
                  : [part],
              )
            : sentText}
        </p>
      </div>

      {/* Expiry note */}
      <p className="w-full mt-4 text-left text-sm text-foreground">
        {t('invitationSuccess.linkExpiry')}
      </p>

      {/* Back button */}
      <Button onClick={onClose} className="w-full mt-5">
        {t('invitationSuccess.backToUsers')}
      </Button>

      {/* Countdown */}
      <p className="text-sm text-muted-foreground mt-3">
        {t('invitationSuccess.redirecting', { seconds: countdown })}
      </p>
    </div>
  );
}
