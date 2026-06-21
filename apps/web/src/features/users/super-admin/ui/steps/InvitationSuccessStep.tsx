import { useTranslation } from '@forethread/i18n';
import { Button, ModalGridHeader } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import { useEffect, useState } from 'react';

interface InvitationSuccessStepProps {
  email: string;
  onClose: () => void;
}

const COUNTDOWN_SECONDS = 5;

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
    <>
      <ModalGridHeader
        icon={<CheckCircleIcon className="size-6 text-gray-700" />}
        title={t('invitationSuccess.title')}
      />

      <div className="relative flex w-full flex-col text-left">
        {/* Green info box with bold email */}
        <div className="w-full rounded-xl border border-success/20 bg-success/10 px-4 py-3">
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
        <p className="mt-4 w-full text-sm text-foreground">{t('invitationSuccess.linkExpiry')}</p>

        {/* Back button */}
        <Button onClick={onClose} size="lg" className="mt-5 w-full">
          {t('invitationSuccess.backToUsers')}
        </Button>

        {/* Countdown */}
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {t('invitationSuccess.redirecting', { seconds: countdown })}
        </p>
      </div>
    </>
  );
}
