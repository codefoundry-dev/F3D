import { useTranslation } from '@forethread/i18n';
import { Button, Modal, ModalIconHeader } from '@forethread/ui-components';
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
    <Modal onClose={onClose} maxWidth="max-w-[520px]">
      <div className="p-6">
        <ModalIconHeader
          icon={
            kind === 'po' ? (
              <FileTextIcon className="w-6 h-6" />
            ) : (
              <PackageIcon className="w-6 h-6" />
            )
          }
          title={t(kind === 'po' ? 'startOrder.poTitle' : 'startOrder.bulkTitle')}
          subtitle={t(kind === 'po' ? 'startOrder.poSubtitle' : 'startOrder.bulkSubtitle')}
          onClose={onClose}
          className="mb-8"
        />
        <div className="flex flex-col gap-3">
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
        </div>
      </div>
    </Modal>
  );
}
