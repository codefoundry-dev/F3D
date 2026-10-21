import { useTranslation } from '@forethread/i18n';
import {
  Checkbox,
  cn,
  DatePicker,
  Input,
  onDecimalOnly,
  StepperInput,
  Textarea,
  ToggleSwitch,
  todayIso,
  type LineItemField,
} from '@forethread/ui-components';

import { availExceedsRequested } from '../hooks/availExceedsRequested';
import type { LineItemFormState } from '../hooks/useRfqResponse';

const NAKED_INPUT_CLASS = '!bg-transparent !rounded-none !border-0 !shadow-none';

export type QuoteLineFieldKey =
  | 'included'
  | 'availQty'
  | 'unitPrice'
  | 'discount'
  | 'gst'
  | 'taxIncluded'
  | 'deliveryDate'
  | 'notes'
  | 'backOrderQty'
  | 'backOrderDeliveryDate';

export type QuoteLineField = LineItemField<LineItemFormState> & { key: QuoteLineFieldKey };

interface QuoteLineFieldOptions {
  onUpdateItem: (index: number, field: keyof LineItemFormState, value: unknown) => void;
  onToggleInclude: (index: number) => void;
  /** `cell` = borderless inputs for the desktop grid; `sheet` = full-size phone inputs. */
  variant: 'cell' | 'sheet';
}

/**
 * The vendor quote line's editable fields, defined once (ADR-0019 B10,
 * FOR-376). The desktop grid renders each `input` in its cell; on phones
 * `LineItemEditor` stacks them in the line's edit sheet. Notes and back-order
 * fields live in the desktop expanded row, so they're sheet-only.
 */
export function useQuoteLineFields({
  onUpdateItem,
  onToggleInclude,
  variant,
}: QuoteLineFieldOptions): QuoteLineField[] {
  const { t } = useTranslation('rfqs');
  const cell = variant === 'cell';
  // Phone inputs: 44px tall, 16px text (no iOS zoom), white like the other sheet fields.
  const inputClass = cell
    ? cn('h-8 w-full text-sm', NAKED_INPUT_CLASS)
    : 'h-11 w-full bg-card text-base';
  const sheetOnly = () => cell;

  const fields: QuoteLineField[] = [
    {
      key: 'included',
      label: t('response.incl'),
      input: (item, index) => (
        <ToggleSwitch checked={item.included} onChange={() => onToggleInclude(index)} />
      ),
    },
    {
      key: 'availQty',
      label: t('response.availQty'),
      value: (item) => item.availQty || '-',
      input: (item, index) => (
        <StepperInput
          value={item.availQty}
          onValueChange={(v) => onUpdateItem(index, 'availQty', v)}
          inputMode="decimal"
          className={inputClass}
          disabled={!item.included}
          aria-invalid={availExceedsRequested(item) || undefined}
          aria-label={t('response.availQty')}
        />
      ),
      // FOR-273: same rule as both validators.
      hint: (item) =>
        availExceedsRequested(item) ? (
          <span
            className={cn(
              'text-destructive',
              cell ? 'text-[10px] leading-tight' : 'text-xs leading-snug',
            )}
          >
            {t('response.availExceedsReq', { requested: item.requestedQty })}
          </span>
        ) : null,
    },
    {
      key: 'unitPrice',
      label: t('response.unitPrice'),
      value: (item) => item.unitPrice || '-',
      input: (item, index) => (
        <Input
          value={item.unitPrice}
          onChange={(e) => onUpdateItem(index, 'unitPrice', e.target.value)}
          onKeyDown={onDecimalOnly}
          inputMode="decimal"
          className={inputClass}
          disabled={!item.included}
          aria-label={t('response.unitPrice')}
        />
      ),
    },
    {
      key: 'discount',
      label: t('response.discount'),
      input: (item, index) => (
        <Input
          value={item.discount}
          onChange={(e) => {
            const v = e.target.value;
            if (item.discountType === 'PERCENT' && v !== '' && parseFloat(v) > 100) return;
            onUpdateItem(index, 'discount', v);
          }}
          onKeyDown={onDecimalOnly}
          inputMode="decimal"
          rightIcon={
            <button
              type="button"
              disabled={!item.included}
              className="text-sm text-foreground cursor-pointer disabled:cursor-not-allowed disabled:text-muted-foreground"
              onClick={() =>
                onUpdateItem(
                  index,
                  'discountType',
                  item.discountType === 'PERCENT' ? 'AMOUNT' : 'PERCENT',
                )
              }
            >
              {item.discountType === 'PERCENT' ? '%' : '$'}
            </button>
          }
          className={inputClass}
          disabled={!item.included}
          aria-label={t('response.discount')}
        />
      ),
    },
    {
      key: 'gst',
      label: t('response.gst'),
      input: (item, index) => (
        <Input
          value={item.gst}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '' || parseFloat(v) <= 100) onUpdateItem(index, 'gst', v);
          }}
          onKeyDown={onDecimalOnly}
          inputMode="decimal"
          rightIcon={
            <span
              className={cn('text-sm', item.included ? 'text-foreground' : 'text-muted-foreground')}
            >
              %
            </span>
          }
          className={inputClass}
          disabled={!item.included}
          aria-label={t('response.gst')}
        />
      ),
    },
    {
      key: 'taxIncluded',
      label: t('response.taxIncl'),
      input: (item, index) => (
        <Checkbox
          checked={item.taxIncluded}
          onChange={(v) => onUpdateItem(index, 'taxIncluded', v)}
          disabled={!item.included}
        />
      ),
    },
    {
      key: 'deliveryDate',
      label: t('response.deliveryDate'),
      value: (item) => item.deliveryDate || '-',
      input: (item, index) => (
        <DatePicker
          value={item.deliveryDate}
          onChange={(v) => onUpdateItem(index, 'deliveryDate', v)}
          borderless={cell}
          className={cell ? undefined : 'h-11'}
          disabled={!item.included}
          minDate={todayIso()}
        />
      ),
    },
    {
      key: 'notes',
      label: t('response.lineNotes'),
      hidden: sheetOnly,
      input: (item, index) => (
        <Textarea
          value={item.notes}
          onChange={(e) => onUpdateItem(index, 'notes', e.target.value)}
          placeholder={t('response.addMessage')}
          className="min-h-[88px] rounded-lg text-base"
        />
      ),
      hint: (item) =>
        item.description ? (
          <span className="text-xs text-muted-foreground">
            {t('response.contractorNotes')}: {item.description}
          </span>
        ) : null,
    },
    {
      key: 'backOrderQty',
      label: t('response.backOrderQty'),
      hidden: (item) => cell || !item.included,
      input: (item, index) => (
        <StepperInput
          value={item.backOrderQty}
          onValueChange={(v) => onUpdateItem(index, 'backOrderQty', v)}
          placeholder="Qty"
          inputMode="decimal"
          className="h-11 bg-card text-base"
          aria-label={t('response.backOrderQty')}
        />
      ),
    },
    {
      key: 'backOrderDeliveryDate',
      label: t('response.expectedDeliveryDate'),
      hidden: (item) => cell || !item.included,
      input: (item, index) => (
        <DatePicker
          value={item.backOrderDeliveryDate}
          onChange={(v) => onUpdateItem(index, 'backOrderDeliveryDate', v)}
          className="h-11"
          minDate={todayIso()}
        />
      ),
      hint: () => (
        <span className="text-xs text-muted-foreground">{t('response.backOrderHint')}</span>
      ),
    },
  ];
  return fields;
}

/** Quote line total: qty × price, less discount, plus GST unless tax-inclusive. */
export function calcLineTotal(item: LineItemFormState): number {
  const qty = parseFloat(item.availQty || '0');
  const price = parseFloat(item.unitPrice || '0');
  const discountValue = parseFloat(item.discount || '0');
  const gstPct = parseFloat(item.gst || '0');
  const subtotal = qty * price;
  const discountAmount =
    item.discountType === 'AMOUNT' ? discountValue : subtotal * (discountValue / 100);
  const afterDiscount = subtotal - discountAmount;
  const gst = item.taxIncluded ? 0 : afterDiscount * (gstPct / 100);
  return afterDiscount + gst;
}
