import { useTranslation } from '@forethread/i18n';
import { CopyEntityModal } from '@forethread/ui-components';

interface CopyRfqModalProps {
  projectName: string;
  copyState: 'loading' | 'success' | null;
  onClose: () => void;
  onOpenCopy: () => void;
}

export function CopyRfqModal({ projectName, copyState, onClose, onOpenCopy }: CopyRfqModalProps) {
  const { t } = useTranslation('rfqs');

  return (
    <CopyEntityModal
      copyState={copyState}
      onClose={onClose}
      onOpenCopy={onOpenCopy}
      title={t('actions.copyTitle', { name: projectName })}
      subtitle={t('actions.copySubtitle')}
      successMessage={t('actions.successfullyDuplicate')}
      dismissLabel={t('actions.dismiss')}
      openLabel={t('actions.openRfq')}
    />
  );
}
