import { type useTranslation } from '@forethread/i18n';
import {
  CustomDropdown,
  DatePicker,
  formatCurrency,
  Input,
  MaterialSearchPanel,
  onDecimalOnly,
  onDigitsOnly,
  todayIso,
  type LineItemField,
  type MaterialItem,
} from '@forethread/ui-components';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';

import { NAKED_INPUT_CLASS, UOM_OPTIONS } from '../constants/line-items';
import type { FormValues } from '../schemas/create-po.schema';

import type { MaterialSearchState } from './LineItemRow';

export type PoLineItem = FormValues['lineItems'][number];

/** One PO wizard line: its form index, watched values and whether a material is set. */
export interface PoLineRow {
  index: number;
  item: PoLineItem | undefined;
  isFilled: boolean;
  approvedQuotesCount: number;
  bulkOrdersCount: number;
}

export type PoLineFieldKey =
  | 'name'
  | 'materialCode'
  | 'costCode'
  | 'uom'
  | 'unitPrice'
  | 'qty'
  | 'availableQty'
  | 'apprRfq'
  | 'bulkOrders'
  | 'delivery'
  | 'deliveryTime'
  | 'location'
  | 'notes';

export type PoLineField = LineItemField<PoLineRow> & { key: PoLineFieldKey };

export interface PoLineFieldsContext {
  t: ReturnType<typeof useTranslation<'purchaseOrders'>>['t'];
  register: UseFormRegister<FormValues>;
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  locationOptions: { value: string; label: string }[];
  materialSearch: MaterialSearchState;
  isDrawdownMode: boolean;
  /** Phone sheet: bordered, full-width inputs instead of borderless table cells. */
  isPhone: boolean;
  onApprRfqClick?: (index: number) => void;
  onBulkOrderClick?: (index: number) => void;
}

/**
 * Fill a line-item row from a catalogue pick: link the material (materialId)
 * and pre-fill its identity/accounting codes so they persist onto the PO line.
 */
function applyMaterialToRow(
  setValue: UseFormSetValue<FormValues>,
  index: number,
  mat: MaterialItem,
) {
  setValue(`lineItems.${index}.materialName`, mat.name);
  setValue(`lineItems.${index}.materialId`, mat.id);
  setValue(`lineItems.${index}.materialCode`, mat.sku ?? '');
  setValue(`lineItems.${index}.costCode`, mat.costCode ?? '');
  setValue(`lineItems.${index}.upc`, mat.upc ?? '');
  setValue(`lineItems.${index}.manufacturerPartNumber`, mat.manufacturerPartNumber ?? '');
  setValue(`lineItems.${index}.taxCode`, mat.taxCode ?? '');
}

/** The preset units plus the line's own unit when it isn't one of them (e.g. "M"
 * from a source PO), so the dropdown shows the value instead of its placeholder. */
function uomOptionsFor(value: string | undefined): { value: string; label: string }[] {
  const base = UOM_OPTIONS.map((o) => ({ value: o.value as string, label: o.label as string }));
  if (value && !base.some((o) => o.value === value)) base.unshift({ value, label: value });
  return base;
}

/** Drawdown over-limit flag: ordered qty exceeds the bulk-order remaining qty. */
export function exceedsAvailableQty(row: PoLineRow, isDrawdownMode: boolean): boolean {
  return (
    isDrawdownMode &&
    row.isFilled &&
    row.item?.availableQty != null &&
    Number(row.item?.quantityOrdered) > Number(row.item?.availableQty)
  );
}

/**
 * The PO wizard's line fields, defined once (ADR-0019 B10, FOR-376): the desktop
 * `LineItemRow` renders each `input` in its table cell, and on phones
 * `LineItemEditor` stacks the same inputs in the line sheet.
 */
export function buildPoLineFields(ctx: PoLineFieldsContext): PoLineField[] {
  const {
    t,
    register,
    control,
    errors,
    setValue,
    locationOptions,
    materialSearch,
    isDrawdownMode,
    isPhone,
    onApprRfqClick,
    onBulkOrderClick,
  } = ctx;
  const inputClass = isPhone ? undefined : NAKED_INPUT_CLASS;
  // Right-aligned in the narrow table cells, left-aligned in the phone sheet.
  const countCellClass = isPhone
    ? 'flex items-center gap-1 h-9'
    : 'flex items-center justify-end gap-1 h-9 pr-1';

  return [
    {
      key: 'name',
      label: t('create.materialName'),
      required: true,
      input: ({ index, item, isFilled }) => {
        if (isFilled) {
          return <span className="text-sm text-foreground px-2">{item?.materialName}</span>;
        }
        // FOR-274 parity with the RFQ manual row: the cell popup is single-pick —
        // clicking anywhere on a result row links the material to the line.
        const pickMaterial = (mat: MaterialItem) => {
          applyMaterialToRow(setValue, index, mat);
          if (mat.unit) setValue(`lineItems.${index}.unitOfMeasure`, mat.unit);
          materialSearch.onCellSearchClose();
        };
        return (
          <MaterialSearchPanel
            search={materialSearch.cellSearchOpen === index ? materialSearch.cellSearchQuery : ''}
            onSearchChange={(v) => materialSearch.onCellSearchChange(index, v)}
            results={materialSearch.results}
            selected={materialSearch.selected}
            onSelect={pickMaterial}
            onPickItem={pickMaterial}
            onDeselect={materialSearch.onDeselect}
            onQuantityChange={materialSearch.onQtyChange}
            onAddToList={() => undefined}
            filters={materialSearch.filters}
            onFiltersChange={materialSearch.onFiltersChange}
            open={materialSearch.cellSearchOpen === index}
            onOpenChange={(open) => {
              if (open) materialSearch.onCellSearchChange(index, materialSearch.cellSearchQuery);
              else materialSearch.onCellSearchClose();
            }}
            searchPlaceholder={t('create.enterMaterialName')}
            compact
          />
        );
      },
    },
    {
      key: 'materialCode',
      label: t('create.materialCode'),
      input: ({ index }) => (
        <Input {...register(`lineItems.${index}.materialCode`)} className={inputClass} />
      ),
    },
    {
      key: 'costCode',
      label: t('create.costCode'),
      input: ({ index }) => (
        <Input {...register(`lineItems.${index}.costCode`)} className={inputClass} />
      ),
    },
    {
      key: 'uom',
      label: t('create.uom'),
      required: true,
      value: ({ item }) => item?.unitOfMeasure || '-',
      input: ({ index }) => (
        <Controller
          name={`lineItems.${index}.unitOfMeasure`}
          control={control}
          render={({ field: f }) => (
            <CustomDropdown
              options={uomOptionsFor(f.value)}
              value={f.value}
              onChange={f.onChange}
              placeholder="UoM"
              error={!!errors.lineItems?.[index]?.unitOfMeasure}
              borderless={!isPhone}
            />
          )}
        />
      ),
    },
    {
      key: 'unitPrice',
      label: t('create.pricePerUnit'),
      value: ({ item }) =>
        item?.unitPrice != null && !Number.isNaN(Number(item.unitPrice)) ? item.unitPrice : '-',
      input: ({ index, item }) =>
        // FOR-391: a line bought from an approved quote keeps the quoted price.
        item?.quoteLineItemId ? (
          <div
            className={
              isPhone
                ? 'flex items-center gap-1.5 h-9 min-w-0'
                : // Stacked so a narrow cell never squeezes the price itself.
                  'flex flex-col items-start justify-center gap-0.5 min-h-9 min-w-0 px-2'
            }
            title={t('create.quotedPriceHint')}
          >
            <span className="max-w-full text-sm text-foreground tabular-nums truncate">
              {formatCurrency(Number(item.unitPrice) || 0)}
            </span>
            <span className="shrink-0 rounded-full bg-[hsl(var(--success))]/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-[hsl(var(--success))]">
              {t('create.quotedPriceTag')}
            </span>
          </div>
        ) : (
          <Input
            inputMode="decimal"
            onKeyDown={onDecimalOnly}
            {...register(`lineItems.${index}.unitPrice`, { valueAsNumber: true })}
            className={inputClass}
            placeholder="0"
          />
        ),
    },
    {
      key: 'qty',
      label: t('create.qtyOrdered'),
      required: true,
      value: ({ item }) =>
        item?.quantityOrdered != null && !Number.isNaN(Number(item.quantityOrdered))
          ? item.quantityOrdered
          : '-',
      input: (row) => (
        <Input
          onKeyDown={onDigitsOnly}
          {...register(`lineItems.${row.index}.quantityOrdered`, { valueAsNumber: true })}
          className={inputClass}
          placeholder="0"
          aria-invalid={exceedsAvailableQty(row, isDrawdownMode) || undefined}
        />
      ),
    },
    {
      // US 5.09 drawdown: read-only bulk-order remaining qty.
      key: 'availableQty',
      label: t('create.availableQty'),
      hidden: () => !isDrawdownMode,
      value: ({ item }) => item?.availableQty ?? '-',
      input: (row) => {
        const exceeds = exceedsAvailableQty(row, isDrawdownMode);
        return (
          <div className="flex flex-col justify-center h-9 px-2">
            {row.isFilled && (
              <>
                <span
                  className={`text-sm ${exceeds ? 'text-destructive font-medium' : 'text-foreground'}`}
                >
                  {row.item?.availableQty ?? '-'}
                </span>
                {exceeds && (
                  <span className="text-[10px] leading-tight text-destructive">
                    {t('create.drawdownExceedsRemaining')}
                  </span>
                )}
              </>
            )}
          </div>
        );
      },
    },
    {
      key: 'apprRfq',
      label: t('create.approvedRfq'),
      hidden: (row) => isDrawdownMode || !row.isFilled,
      input: ({ index, isFilled, approvedQuotesCount }) => (
        <div className={countCellClass}>
          {isFilled && (
            <span
              className={`text-xs ${approvedQuotesCount > 0 ? 'text-[hsl(var(--success))]' : 'text-foreground'}`}
            >
              {approvedQuotesCount} quotes
            </span>
          )}
          <button
            type="button"
            disabled={!isFilled}
            onClick={() => onApprRfqClick?.(index)}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <InfoIcon style={{ width: 13, height: 13 }} />
          </button>
        </div>
      ),
    },
    {
      key: 'bulkOrders',
      label: t('create.bulkOrders'),
      hidden: (row) => isDrawdownMode || !row.isFilled,
      input: ({ index, isFilled, bulkOrdersCount }) => (
        <div className={countCellClass}>
          {isFilled && <span className="text-xs text-foreground">{bulkOrdersCount} orders</span>}
          <button
            type="button"
            disabled={!isFilled}
            onClick={() => onBulkOrderClick?.(index)}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <InfoIcon style={{ width: 13, height: 13 }} />
          </button>
        </div>
      ),
    },
    {
      key: 'delivery',
      label: t('create.expDeliveryDate'),
      value: ({ item }) => item?.expectedDeliveryDate || '-',
      input: ({ index }) => (
        <Controller
          name={`lineItems.${index}.expectedDeliveryDate`}
          control={control}
          render={({ field: f }) => (
            <DatePicker
              value={f.value ?? ''}
              onChange={f.onChange}
              borderless={!isPhone}
              compact={!isPhone}
              minDate={todayIso()}
            />
          )}
        />
      ),
    },
    {
      key: 'deliveryTime',
      label: t('create.deliveryTimeCol'),
      input: ({ index }) => (
        <Controller
          name={`lineItems.${index}.deliveryTime`}
          control={control}
          render={({ field: f }) => (
            <input
              type="time"
              value={f.value ?? ''}
              onChange={f.onChange}
              aria-label="Delivery time"
              // The table cell drops the native clock icon to fit "09:30 AM" (FOR-390),
              // so a click opens the picker instead.
              onClick={
                isPhone
                  ? undefined
                  : (e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch {
                        // Already open, or unsupported — typing still works.
                      }
                    }
              }
              className={
                isPhone
                  ? 'h-11 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground outline-none'
                  : 'h-9 w-full min-w-0 bg-transparent px-1 text-sm text-foreground outline-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-datetime-edit]:p-0'
              }
            />
          )}
        />
      ),
    },
    {
      key: 'location',
      label: t('create.deliveryLocationCol'),
      input: ({ index }) => (
        <Controller
          name={`lineItems.${index}.deliveryLocationId`}
          control={control}
          render={({ field: f }) => (
            <CustomDropdown
              options={locationOptions}
              value={f.value ?? ''}
              onChange={f.onChange}
              placeholder="Location"
              borderless={!isPhone}
            />
          )}
        />
      ),
    },
    {
      key: 'notes',
      label: (
        <>
          Additional Notes <span className="text-muted-foreground font-normal">(optional)</span>
        </>
      ),
      input: ({ index }) => (
        <textarea
          {...register(`lineItems.${index}.notes`)}
          placeholder="Add any additional information about this material..."
          className="w-full min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 resize-y"
        />
      ),
    },
  ];
}
