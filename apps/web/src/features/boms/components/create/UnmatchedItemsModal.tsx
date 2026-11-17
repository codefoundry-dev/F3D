import { useTranslation } from '@forethread/i18n';
import { Button, GridModal } from '@forethread/ui-components';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';

import { unmatchedRows, type BomDraftRow } from './bom-draft';

type TFn = (key: string, options?: Record<string, unknown>) => string;

export interface UnmatchedItemsModalProps {
  rows: BomDraftRow[];
  /** Label of the button that proceeds anyway ("Continue anyway" / "Save anyway"). */
  confirmLabel: string;
  onConfirm: () => void;
  /** Close without proceeding, back to the table to match the lines. */
  onClose: () => void;
}

/**
 * Lists the lines that still have no catalogue match and asks whether to carry
 * on regardless. Proceeding saves them as unmatched; they can be matched later
 * from Edit BOM.
 */
export function UnmatchedItemsModal({
  rows,
  confirmLabel,
  onConfirm,
  onClose,
}: UnmatchedItemsModalProps) {
  const { t: tRaw } = useTranslation('boms');
  const t = tRaw as TFn;
  const unmatched = unmatchedRows(rows);

  return (
    <GridModal
      onClose={onClose}
      scrollBody
      icon={<InfoIcon className="size-6 text-gray-700" />}
      title={t('unmatchedModal.title', { count: unmatched.length })}
      description={t('unmatchedModal.description')}
      actions={
        <>
          <Button className="w-full" onClick={onClose} data-testid="bom-unmatched-back">
            {t('unmatchedModal.back')}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={onConfirm}
            data-testid="bom-unmatched-confirm"
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <ul
        className="divide-y divide-border rounded-lg border border-border bg-background"
        data-testid="bom-unmatched-list"
      >
        {unmatched.map((row, index) => {
          const amount = [row.quantity.trim(), row.uom.trim()].filter(Boolean).join(' ');
          return (
            <li key={index} className="flex items-start justify-between gap-4 px-3 py-2.5 text-sm">
              <span className="min-w-0 break-words text-foreground">
                {row.materialName.trim() || row.description.trim() || '—'}
              </span>
              {amount && (
                <span className="shrink-0 whitespace-nowrap text-muted-foreground">{amount}</span>
              )}
            </li>
          );
        })}
      </ul>
    </GridModal>
  );
}
