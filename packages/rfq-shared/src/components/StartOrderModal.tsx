import { useTranslation } from '@forethread/i18n';
import { Button, GridModal } from '@forethread/ui-components';
import FileTextIcon from '@forethread/ui-components/assets/icons/file-text.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';

export type StartOrderKind = 'po' | 'bulk';

export interface StartOrderModalProps {
  kind: StartOrderKind;
  isCreating?: boolean;
  onStartNow: () => void;
  onCreateDraft: () => void;
  onClose: () => void;
}

/**
 * "Do you want to start PO creation?" / "…Bulk order creation?" prompt shown
 * after approving quote items (US 5.19). "Start now" opens the guided creation
 * flow; "Create draft" saves a draft order immediately.
 */
export function StartOrderModal({
  kind,
  isCreating = false,
  onStartNow,
  onCreateDraft,
  onClose,
}: StartOrderModalProps) {
  const { t } = useTranslation('rfqs');

  return (
    <GridModal
      onClose={onClose}
      icon={
        kind === 'po' ? (
          <FileTextIcon className="size-6 text-gray-700" />
        ) : (
          <PackageIcon className="size-6 text-gray-700" />
        )
      }
      title={t(kind === 'po' ? 'startOrder.poTitle' : 'startOrder.bulkTitle')}
      description={t(kind === 'po' ? 'startOrder.poSubtitle' : 'startOrder.bulkSubtitle')}
      actions={
        <>
          <Button size="lg" className="w-full" onClick={onStartNow} disabled={isCreating}>
            {t('startOrder.startNow')}
          </Button>
          <Button
            size="lg"
            className="w-full"
            variant="outline"
            onClick={onCreateDraft}
            disabled={isCreating}
          >
            {isCreating ? t('startOrder.creating') : t('startOrder.createDraft')}
          </Button>
        </>
      }
    />
  );
}
