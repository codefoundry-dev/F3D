import { useTranslation } from '@forethread/i18n';
import { Badge, Button, Modal, Spinner } from '@forethread/ui-components';

import { useBom } from '../hooks/useBoms';

function confidenceLabel(
  confidence: number | null,
  t: (key: string) => string,
): { badge: string; pct: string | null } {
  if (confidence === null) return { badge: t('viewModal.manual'), pct: null };
  const pct = `${Math.round(confidence * 100)}%`;
  if (confidence >= 0.85) return { badge: t('create.high'), pct };
  if (confidence >= 0.5) return { badge: t('create.medium'), pct };
  return { badge: t('create.low'), pct };
}

/** Read-only line-item view for a saved BOM (the Eye action in the BOM tab). */
export function BomItemsModal({ bomId, onClose }: { bomId: string; onClose: () => void }) {
  const { t: tRaw } = useTranslation('boms');
  const t = tRaw as (key: string, options?: Record<string, unknown>) => string;
  const { data: bom, isLoading } = useBom(bomId);

  const th = 'px-3 py-3 text-left text-xs font-bold leading-4 tracking-[0.6px] whitespace-nowrap';
  const td = 'px-3 py-3 text-sm text-foreground align-top';

  return (
    <Modal onClose={onClose} maxWidth="max-w-6xl" scrollBody>
      <div className="p-6 flex flex-col min-h-0">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          {t('viewModal.title', { bomNumber: bom?.bomNumber ?? '' })}
        </h3>

        {isLoading || !bom ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="overflow-auto border border-border rounded-lg min-h-0">
            <table className="w-full min-w-[900px] text-sm" data-testid="bom-items-view-table">
              <thead>
                <tr className="bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))]">
                  <th className={th}>{t('viewModal.columns.materialName')}</th>
                  <th className={th}>{t('viewModal.columns.match')}</th>
                  <th className={th}>{t('viewModal.columns.description')}</th>
                  <th className={th}>{t('viewModal.columns.uom')}</th>
                  <th className={th}>{t('viewModal.columns.quantity')}</th>
                  <th className={th}>{t('viewModal.columns.category')}</th>
                  <th className={th}>{t('viewModal.columns.materialType')}</th>
                  <th className={th}>{t('viewModal.columns.confidence')}</th>
                </tr>
              </thead>
              <tbody>
                {bom.items.map((item) => {
                  const { badge, pct } = confidenceLabel(item.matchConfidence, t);
                  return (
                    <tr key={item.id} className="border-t border-border">
                      <td className={td}>{item.materialName}</td>
                      <td className={td}>{item.matchedMaterialName ?? '—'}</td>
                      <td className={`${td} text-muted-foreground`}>{item.description ?? '—'}</td>
                      <td className={td}>{item.uom ?? '—'}</td>
                      <td className={td}>{item.quantity ?? '—'}</td>
                      <td className={td}>{item.category ?? '—'}</td>
                      <td className={td}>{item.materialType ?? '—'}</td>
                      <td className={td}>
                        <span className="inline-flex items-center gap-2">
                          <Badge className="bg-muted text-foreground">{badge}</Badge>
                          {pct && <span className="text-sm text-foreground">{pct}</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
