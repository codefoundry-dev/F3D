import { useTranslation } from '@forethread/i18n';
import { CopyEntityModal } from '@forethread/ui-components';

interface CopyPoModalProps {
  projectName: string;
  copyState: 'loading' | 'success' | null;
  onClose: () => void;
  onOpenCopy: () => void;
}

export function CopyPoModal({ projectName, copyState, onClose, onOpenCopy }: CopyPoModalProps) {
  const { t } = useTranslation('purchaseOrders');

  return (
    <CopyEntityModal
      copyState={copyState}
      onClose={onClose}
      onOpenCopy={onOpenCopy}
      title={t('actions.copyTitle', { name: projectName })}
      subtitle={t('actions.copySubtitle')}
      successMessage={t('actions.successfullyDuplicate')}
      dismissLabel={t('actions.dismiss')}
      openLabel={t('actions.openPo')}
    />
  );
}
