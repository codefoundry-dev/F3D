import { useTranslation } from '@forethread/i18n';
import { Button, Modal, ModalGridBackground, Spinner } from '@forethread/ui-components';

import { useBom } from '../hooks/useBoms';

import { BomItemsTable } from './BomItemsTable';

/** Read-only line-item view for a saved BOM (legacy quick-view modal). */
export function BomItemsModal({ bomId, onClose }: { bomId: string; onClose: () => void }) {
  const { t: tRaw } = useTranslation('boms');
  const t = tRaw as (key: string, options?: Record<string, unknown>) => string;
  const { data: bom, isLoading } = useBom(bomId);

  return (
    <Modal onClose={onClose} maxWidth="max-w-6xl" scrollBody decoration={<ModalGridBackground />}>
      <div className="relative p-6 flex flex-col min-h-0">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          {t('viewModal.title', { bomNumber: bom?.bomNumber ?? '' })}
        </h3>

        {isLoading || !bom ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <BomItemsTable items={bom.items} />
        )}

        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={onClose}>
            {t('viewModal.close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
