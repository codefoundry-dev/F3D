import { useTranslation } from '@forethread/i18n';
import {
  type BomExtractionResult,
  type BomLineItem,
  isBomExtractionResult,
} from '@forethread/shared-types/client';
import { Button, Input } from '@forethread/ui-components';
import { useCallback, useMemo } from 'react';

export interface BomReviewTableProps {
  /** Current edited result, in canonical BOM shape or anything that can be coerced. */
  value: Record<string, unknown> | null;
  /** Disable inputs while not in edit mode. */
  readOnly?: boolean;
  /** Fires every keystroke so the parent can run validation / dirty tracking. */
  onChange: (next: BomExtractionResult) => void;
}

const EMPTY_ROW: BomLineItem = {
  description: '',
  quantity: null,
  unit: null,
  targetPrice: null,
  notes: null,
};

function toBom(value: Record<string, unknown> | null): BomExtractionResult {
  if (isBomExtractionResult(value)) {
    // Defensive copy so callers can mutate freely.
    return {
      ...value,
      items: value.items.map((item) => ({ ...item })),
    };
  }
  return {
    title: null,
    projectName: null,
    currency: null,
    items: [],
    notes: null,
  };
}

function parseNumberInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const numeric = Number(trimmed.replace(/[,\s$]/gu, ''));
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

/**
 * Editable line-item table for confirmed BOMs. Replaces the generic JSON
 * textarea when the user is reviewing a BOM extraction (FOR-200).
 */
export function BomReviewTable({ value, readOnly, onChange }: BomReviewTableProps) {
  const { t } = useTranslation(['docExtractions']);
  const bom = useMemo(() => toBom(value), [value]);

  const updateItems = useCallback(
    (mutator: (items: BomLineItem[]) => BomLineItem[]) => {
      onChange({ ...bom, items: mutator(bom.items) });
    },
    [bom, onChange],
  );

  const updateMeta = useCallback(
    (patch: Partial<Omit<BomExtractionResult, 'items'>>) => {
      onChange({ ...bom, ...patch });
    },
    [bom, onChange],
  );

  const onItemChange = useCallback(
    (index: number, patch: Partial<BomLineItem>) => {
      updateItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
    },
    [updateItems],
  );

  const onRemoveRow = useCallback(
    (index: number) => updateItems((items) => items.filter((_, i) => i !== index)),
    [updateItems],
  );

  const onAddRow = useCallback(
    () => updateItems((items) => [...items, { ...EMPTY_ROW }]),
    [updateItems],
  );

  return (
    <section
      aria-labelledby="bom-review-title"
      data-testid="bom-review-table"
      className="space-y-3"
    >
      <h3 id="bom-review-title" className="sr-only">
        {t('bom.title')}
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium" htmlFor="bom-title">
            {t('bom.documentTitle')}
          </label>
          <Input
            id="bom-title"
            value={bom.title ?? ''}
            readOnly={readOnly}
            onChange={(e) => updateMeta({ title: e.target.value || null })}
          />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="bom-project">
            {t('bom.projectName')}
          </label>
          <Input
            id="bom-project"
            value={bom.projectName ?? ''}
            readOnly={readOnly}
            onChange={(e) => updateMeta({ projectName: e.target.value || null })}
          />
        </div>
      </div>

      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-sm" data-testid="bom-items-table">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="text-left p-2 w-[40%]">{t('bom.columns.description')}</th>
              <th className="text-left p-2 w-[12%]">{t('bom.columns.quantity')}</th>
              <th className="text-left p-2 w-[12%]">{t('bom.columns.unit')}</th>
              <th className="text-left p-2 w-[14%]">{t('bom.columns.targetPrice')}</th>
              <th className="text-left p-2 w-[18%]">{t('bom.columns.notes')}</th>
              <th className="w-10" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {bom.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  {t('bom.empty')}
                </td>
              </tr>
            ) : (
              bom.items.map((item, index) => (
                <tr key={index} data-testid={`bom-row-${index}`}>
                  <td className="p-1">
                    <Input
                      aria-label={t('bom.columns.description')}
                      value={item.description}
                      readOnly={readOnly}
                      onChange={(e) => onItemChange(index, { description: e.target.value })}
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      aria-label={t('bom.columns.quantity')}
                      inputMode="decimal"
                      value={item.quantity ?? ''}
                      readOnly={readOnly}
                      onChange={(e) =>
                        onItemChange(index, { quantity: parseNumberInput(e.target.value) })
                      }
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      aria-label={t('bom.columns.unit')}
                      value={item.unit ?? ''}
                      readOnly={readOnly}
                      onChange={(e) => onItemChange(index, { unit: e.target.value || null })}
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      aria-label={t('bom.columns.targetPrice')}
                      inputMode="decimal"
                      value={item.targetPrice ?? ''}
                      readOnly={readOnly}
                      onChange={(e) =>
                        onItemChange(index, { targetPrice: parseNumberInput(e.target.value) })
                      }
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      aria-label={t('bom.columns.notes')}
                      value={item.notes ?? ''}
                      readOnly={readOnly}
                      onChange={(e) => onItemChange(index, { notes: e.target.value || null })}
                    />
                  </td>
                  <td className="p-1 text-right">
                    {!readOnly ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        iconOnly
                        aria-label={t('bom.actions.removeRow')}
                        data-testid={`bom-remove-row-${index}`}
                        onClick={() => onRemoveRow(index)}
                      >
                        ×
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!readOnly ? (
        <div>
          <Button type="button" variant="outline" onClick={onAddRow} data-testid="bom-add-row">
            {t('bom.actions.addRow')}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
