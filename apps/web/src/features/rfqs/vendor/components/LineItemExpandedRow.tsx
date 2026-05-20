import { useTranslation } from '@forethread/i18n';
import { DatePicker, StepperInput, Textarea } from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';

import type { LineItemFormState } from '../hooks/useRfqResponse';

interface LineItemExpandedRowProps {
  item: LineItemFormState;
  index: number;
  section: 'notes' | 'backorder';
  onUpdateItem: (index: number, field: keyof LineItemFormState, value: unknown) => void;
}

export function LineItemExpandedRow({
  item,
  index,
  section,
  onUpdateItem,
}: LineItemExpandedRowProps) {
  const { t } = useTranslation('rfqs');

  if (section === 'notes') {
    return (
      <div className="px-3 py-4 space-y-6 bg-card">
        {/* Contractor Notes (read-only) */}
        {item.description && (
          <div className="space-y-2">
            <span className="text-sm font-medium text-foreground">
              {t('response.contractorNotes')}
            </span>
            <p className="text-xs text-foreground leading-4">{item.description}</p>
          </div>
        )}

        {/* Line-level Notes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{t('response.lineNotes')}</span>
              <span className="text-sm text-muted-foreground">{t('response.optional')}</span>
            </div>
            {item.notes && (
              <button
                type="button"
                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                onClick={() => onUpdateItem(index, 'notes', '')}
              >
                <DeleteIcon className="w-4 h-4" />
              </button>
            )}
          </div>
          <Textarea
            value={item.notes}
            onChange={(e) => onUpdateItem(index, 'notes', e.target.value)}
            placeholder={t('response.addMessage')}
            className="min-h-[88px] rounded-lg"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-4 space-y-6 bg-card">
      {/* Back-order Details */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {t('response.backOrderDetails')}
        </span>
        <span className="text-sm text-muted-foreground">{t('response.backOrderSubtitle')}</span>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            {t('response.backOrderQty')}
          </label>
          <StepperInput
            value={item.backOrderQty}
            onValueChange={(v) => onUpdateItem(index, 'backOrderQty', v)}
            placeholder="Qty"
            className="h-12"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            {t('response.expectedDeliveryDate')}
          </label>
          <DatePicker
            value={item.backOrderDeliveryDate}
            onChange={(v) => onUpdateItem(index, 'backOrderDeliveryDate', v)}
            className="h-12"
            minDate={new Date().toISOString().slice(0, 10)}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{t('response.backOrderHint')}</p>
    </div>
  );
}
