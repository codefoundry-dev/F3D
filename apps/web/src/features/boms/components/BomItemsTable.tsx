import type { BomItemDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Badge } from '@forethread/ui-components';

type TFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Confidence pill + percentage for a saved BOM item. A null score means the
 * line was matched by hand ("Manual"); otherwise it bands the similarity score
 * the same way the create wizard does.
 */
function confidenceLabel(confidence: number | null, t: TFn): { badge: string; pct: string | null } {
  if (confidence === null) return { badge: t('viewModal.manual'), pct: null };
  const pct = `${Math.round(confidence * 100)}%`;
  if (confidence >= 0.85) return { badge: t('create.high'), pct };
  if (confidence >= 0.5) return { badge: t('create.medium'), pct };
  return { badge: t('create.low'), pct };
}

/**
 * Read-only line-item table for a saved BOM — shared by the full-page BOM
 * detail view (US 5.02) and the legacy quick-view modal.
 */
export function BomItemsTable({ items }: { items: BomItemDto[] }) {
  const { t: tRaw } = useTranslation('boms');
  const t = tRaw as TFn;

  const th = 'px-3 py-3 text-left text-xs font-bold leading-4 tracking-[0.6px] whitespace-nowrap';
  const td = 'px-3 py-3 text-sm text-foreground align-top';

  return (
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
          {items.map((item) => {
            const { badge, pct } = confidenceLabel(item.matchConfidence, t);
            return (
              <tr
                key={item.id}
                className="border-t border-border"
                data-testid={`bom-item-${item.id}`}
              >
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
  );
}
