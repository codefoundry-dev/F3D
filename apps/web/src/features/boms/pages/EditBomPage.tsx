import type { BomDetailDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { Button, Spinner, notificationService } from '@forethread/ui-components';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import {
  rowsFromBomItems,
  rowsToCreateItems,
  unmatchedCount,
  type BomDraftRow,
} from '../components/create/bom-draft';
import { BomReviewStep } from '../components/create/BomReviewStep';
import { useBom, useUpdateBom } from '../hooks/useBoms';

/**
 * In-place BOM editor (US 5.02). Loads the BOM, then mounts the editor form
 * (which seeds its rows from the loaded items) so the review table renders
 * already populated — editing never touches downstream RFQs / POs / invoices,
 * surfaced via the banner.
 */
export default function EditBomPage() {
  const { bomId = '' } = useParams<{ id: string; bomId: string }>();
  const { t: tRaw } = useTranslation('boms');
  const t = tRaw as (key: string, options?: Record<string, unknown>) => string;
  const { data: bom, isLoading, isError } = useBom(bomId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !bom) {
    return <p className="p-8 text-sm text-destructive">{t('edit.notFound')}</p>;
  }

  return <EditBomForm bom={bom} />;
}

function EditBomForm({ bom }: { bom: BomDetailDto }) {
  const { id: projectId = '' } = useParams<{ id: string; bomId: string }>();
  const { t: tRaw } = useTranslation('boms');
  const t = tRaw as (key: string, options?: Record<string, unknown>) => string;
  const navigate = useNavigate();
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  const updateMutation = useUpdateBom(bom.id);

  // Seeded once at mount from the already-loaded BOM (the table appends its own
  // trailing empty row).
  const [rows, setRows] = useState<BomDraftRow[]>(() => rowsFromBomItems(bom.items));

  const detailUrl = ROUTES.projectBomDetail.replace(':id', projectId).replace(':bomId', bom.id);

  useEffect(() => {
    setPageTitle(t('edit.title'), t('edit.subtitle'), detailUrl);
    return () => setPageTitle(null);
  }, [setPageTitle, t, detailUrl]);

  const unmatched = unmatchedCount(rows);

  const handleSave = () => {
    updateMutation.mutate(
      { items: rowsToCreateItems(rows) },
      {
        onSuccess: () => {
          notificationService.success(t('edit.saveSuccess'));
          navigate(detailUrl);
        },
        onError: () => notificationService.error(t('edit.saveError')),
      },
    );
  };

  return (
    <div className="p-4 sm:p-8 space-y-6" data-testid="edit-bom-page">
      <div className="rounded-xl bg-[#175CD3]/[0.06] p-4 flex items-start gap-2.5">
        <InfoIcon className="w-[18px] h-[18px] shrink-0 mt-0.5 text-[#175CD3]" />
        <p className="text-sm text-[#175CD3] leading-relaxed">{t('edit.banner')}</p>
      </div>

      <BomReviewStep rows={rows} onRowsChange={setRows} variant="edit" />

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="lg"
          className="h-12 text-sm"
          onClick={() => navigate(detailUrl)}
        >
          {t('edit.cancel')}
        </Button>
        <Button
          size="lg"
          className="h-12 text-sm disabled:bg-[#999FAD] disabled:opacity-100"
          disabled={unmatched > 0}
          isLoading={updateMutation.isPending}
          onClick={handleSave}
          data-testid="bom-save"
        >
          {unmatched > 0 ? t('edit.matchItemsFirst') : t('edit.save')}
        </Button>
      </div>
    </div>
  );
}
