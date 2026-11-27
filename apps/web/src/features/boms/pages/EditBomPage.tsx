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
import { UnmatchedItemsModal } from '../components/create/UnmatchedItemsModal';
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
  const { t: tProjects } = useTranslation('projects');
  const navigate = useNavigate();
  const setPageTitle = usePageTitleStore((s) => s.setTitle);
  const updateMutation = useUpdateBom(bom.id);

  // Seeded once at mount from the already-loaded BOM (the table appends its own
  // trailing empty row).
  const [rows, setRows] = useState<BomDraftRow[]>(() => rowsFromBomItems(bom.items));

  const detailUrl = ROUTES.projectBomDetail.replace(':id', projectId).replace(':bomId', bom.id);

  const bomTabUrl = `${ROUTES.projectDetail.replace(':id', projectId)}?tab=bom`;

  // App-bar breadcrumb: Projects › Bill of Materials (BOM) › BOM-XXXX › Edit BOM.
  useEffect(() => {
    setPageTitle(t('edit.title'), t('edit.subtitle'), detailUrl, [
      { label: tProjects('list.title'), to: ROUTES.projects },
      { label: tProjects('detail.tabs.bom'), to: bomTabUrl },
      { label: bom.bomNumber, to: detailUrl },
      { label: t('edit.title') },
    ]);
    return () => setPageTitle(null);
  }, [setPageTitle, t, tProjects, detailUrl, bomTabUrl, bom.bomNumber]);

  const unmatched = unmatchedCount(rows);
  const [confirmUnmatched, setConfirmUnmatched] = useState(false);

  const handleSave = () => {
    updateMutation.mutate(
      { items: rowsToCreateItems(rows) },
      {
        onSuccess: () => {
          notificationService.success(t('edit.saveSuccess'));
          void navigate(detailUrl);
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
          onClick={() => void navigate(detailUrl)}
        >
          {t('edit.cancel')}
        </Button>
        <Button
          size="lg"
          className="h-12 text-sm"
          isLoading={updateMutation.isPending}
          // Unmatched lines don't block: confirm them first, then save.
          onClick={() => (unmatched > 0 ? setConfirmUnmatched(true) : handleSave())}
          data-testid="bom-save"
        >
          {t('edit.save')}
        </Button>
      </div>

      {confirmUnmatched && (
        <UnmatchedItemsModal
          rows={rows}
          confirmLabel={t('unmatchedModal.saveAnyway')}
          onClose={() => setConfirmUnmatched(false)}
          onConfirm={() => {
            setConfirmUnmatched(false);
            handleSave();
          }}
        />
      )}
    </div>
  );
}
