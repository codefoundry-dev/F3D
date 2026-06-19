import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { Button, Spinner } from '@forethread/ui-components';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { BomItemsTable } from '../components/BomItemsTable';
import { useBom } from '../hooks/useBoms';

/**
 * Full-page read-only view of a saved BOM (US 5.02). Reached from the project
 * Bill-of-Materials tab; the global header carries the BOM number + back arrow,
 * and the Edit action drops into the in-place editor.
 */
export default function BomDetailPage() {
  const { id: projectId = '', bomId = '' } = useParams<{ id: string; bomId: string }>();
  const { t: tRaw } = useTranslation('boms');
  const t = tRaw as (key: string, options?: Record<string, unknown>) => string;
  const navigate = useNavigate();
  const setPageTitle = usePageTitleStore((s) => s.setTitle);

  const { data: bom, isLoading, isError } = useBom(bomId);
  const backToBomTab = `${ROUTES.projectDetail.replace(':id', projectId)}?tab=bom`;

  useEffect(() => {
    if (bom) setPageTitle(bom.bomNumber, t('detail.subtitle'), backToBomTab);
    return () => setPageTitle(null);
  }, [bom, setPageTitle, t, backToBomTab]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !bom) {
    return <p className="p-8 text-sm text-destructive">{t('detail.notFound')}</p>;
  }

  return (
    <div className="p-4 sm:p-8 space-y-4" data-testid="bom-detail-page">
      <div className="flex justify-end">
        <Button
          variant="outline"
          leftIcon={<EditIcon className="w-4 h-4" />}
          onClick={() =>
            navigate(ROUTES.projectBomEdit.replace(':id', projectId).replace(':bomId', bom.id))
          }
          data-testid="bom-edit"
        >
          {t('detail.edit')}
        </Button>
      </div>

      <BomItemsTable items={bom.items} />
    </div>
  );
}
