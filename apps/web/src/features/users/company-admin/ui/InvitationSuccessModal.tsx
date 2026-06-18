import { useTranslation } from '@forethread/i18n';
import { Modal, ModalBody, ModalCloseButton, IconBadge, Button } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import { useEffect, useState } from 'react';

import { useUsersStore } from '../state/users.store';

interface InvitationSuccessModalProps {
  onClose: () => void;
}

const COUNTDOWN_SECONDS = 3;

export function InvitationSuccessModal({ onClose }: InvitationSuccessModalProps) {
  const { t } = useTranslation(['users', 'common']);
  const createdUserEmail = useUsersStore((s) => s.createdUserEmail);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  // Auto-redirect countdown (mirrors the shared StatusSuccessModal behaviour).
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
  const email = createdUserEmail ?? '';
  const sentText = t('invitationSuccess.emailSent', { email });
  const parts = email ? sentText.split(email) : [sentText];

  return (
    <Modal onClose={onClose} maxWidth="max-w-[560px]">
      <ModalBody>
        <div className="flex flex-col items-center text-center">
          {/* Header with icon badge + close */}
          <div className="flex w-full items-start justify-between">
            <div className="flex-1" />
            <IconBadge icon={<CheckCircleIcon className="h-6 w-6 text-foreground" />} />
            <div className="flex flex-1 justify-end">
              <ModalCloseButton onClose={onClose} />
            </div>
          </div>

          {/* Title */}
          <h2 className="mt-4 text-2xl font-semibold leading-[140%] text-foreground">
            {t('invitationSuccess.title')}
          </h2>

          {/* Subtitle */}
          <p className="mt-1 text-sm text-muted-foreground">{t('invitationSuccess.subtitle')}</p>

          {/* Green info box with bold email */}
          <div className="mt-5 w-full rounded-xl border border-success/20 bg-success/10 px-4 py-3 text-left">
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

          {/* Note */}
          <p className="mt-4 w-full text-left text-sm text-foreground">
            {t('invitationSuccess.linkExpiry')}
          </p>

          {/* Back button */}
          <Button onClick={onClose} className="mt-5 w-full">
            {t('invitationSuccess.backToUsers')}
          </Button>

          {/* Countdown */}
          <p className="mt-3 text-sm text-muted-foreground">
            {t('invitationSuccess.redirecting', { seconds: countdown })}
          </p>
        </div>
      </ModalBody>
    </Modal>
  );
}
