import { useTranslation } from '@forethread/i18n';
import { StatusSuccessModal } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';

import { useUsersStore } from '../state/users.store';

interface InvitationSuccessModalProps {
  onClose: () => void;
}

export function InvitationSuccessModal({ onClose }: InvitationSuccessModalProps) {
  const { t } = useTranslation(['users', 'common']);
  const createdUserEmail = useUsersStore((s) => s.createdUserEmail);

  const description = (
    <div className="w-full rounded-xl bg-success/10 border border-success/20 px-4 py-3">
      <p className="text-sm text-success">
        {t('invitationSuccess.emailSent', { email: createdUserEmail })}
      </p>
    </div>
  );

  return (
    <StatusSuccessModal
      onClose={onClose}
      maxWidth="max-w-[560px]"
      title={t('invitationSuccess.title')}
      subtitle={t('invitationSuccess.subtitle')}
      description={description}
      note={t('invitationSuccess.linkExpiry')}
      buttonLabel={t('invitationSuccess.backToUsers')}
      redirectLabel={(seconds) => t('invitationSuccess.redirecting', { seconds })}
      icon={<CheckCircleIcon className="w-6 h-6 text-success" />}
      iconBadgeClassName="bg-success/10"
    />
  );
}
