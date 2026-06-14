import { useTranslation } from '@forethread/i18n';
import {
  Input,
  CustomDropdown,
  DatePicker,
  MaterialSearchPanel,
  onDigitsOnly,
  onDecimalOnly,
} from '@forethread/ui-components';
import type { MaterialItem, SelectedMaterial, MaterialFilters } from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import EditInSquareIcon from '@forethread/ui-components/assets/icons/edit-in-square.svg?react';
import { MessageBadgeIcon } from '@forethread/ui-components';
import InfoIcon from '@forethread/ui-components/assets/icons/info.svg?react';
import React from 'react';
import {
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
  Controller,
} from 'react-hook-form';

import { UOM_OPTIONS, ACTION_ICON_SIZE, NAKED_INPUT_CLASS } from '../constants/line-items';
import type { FormValues } from '../schemas/create-po.schema';

/** Grouped material search state to reduce prop drilling (ISP) */
export interface MaterialSearchState {
  cellSearchOpen: number | null;
  cellSearchQuery: string;
  onCellSearchChange: (index: number, query: string) => void;
  onCellSearchClose: () => void;
  results: MaterialItem[];
  selected: SelectedMaterial[];
  filters: MaterialFilters;
  onFiltersChange: (f: MaterialFilters) => void;
  onDeselect: (id: string) => void;
  onQtyChange: (id: string, qty: number) => void;
  addToListLabel: string;
}

export interface LineItemRowProps {
  index: number;
  isFilled: boolean;
  isLast: boolean;
  hasNotes: boolean;
  item: FormValues['lineItems'][number] | undefined;
  register: UseFormRegister<FormValues>;
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  remove: (index: number) => void;
  locationOptions: { value: string; label: string }[];
  onToggleNotes: (index: number) => void;
  /** Grouped material search state */
  materialSearch: MaterialSearchState;
  onApprRfqClick?: (index: number) => void;
  onBulkOrderClick?: (index: number) => void;
  approvedQuotesCount?: number;
  bulkOrdersCount?: number;
  /**
   * US 5.09 drawdown: render a read-only "Available qty" cell (= bulk-order line
   * qtyRemaining) instead of the "Appr. RFQ"/"Bulk orders" cells, and flag the
   * Qty Ordered input when it exceeds the available quantity.
   */
  isDrawdownMode?: boolean;
}

export function LineItemRow({
  index,
  isFilled,
  isLast,
  hasNotes,
  item,
  register,
  control,
  errors,
  setValue,
  remove,
  locationOptions,
  onToggleNotes,
  materialSearch,
  onApprRfqClick,
  onBulkOrderClick,
  approvedQuotesCount = 0,
  bulkOrdersCount = 0,
  isDrawdownMode = false,
}: LineItemRowProps) {
  const { t } = useTranslation('purchaseOrders');
  const rowBorder = isLast && !hasNotes ? '' : 'border-b';
  const cellBorder = `border-r border-border ${rowBorder}`;
  const cell = 'px-1 py-1';
  // Drawdown over-limit flag: ordered qty exceeds the bulk-order remaining qty.
  const exceedsAvailable =
    isDrawdownMode &&
    isFilled &&
    item?.availableQty != null &&
    Number(item?.quantityOrdered) > Number(item?.availableQty);

  return (
    <React.Fragment>
      <tr>
        {/* Material Name */}
        <td className={`${cell} ${cellBorder} relative`}>
          {isFilled ? (
            <span className="text-sm text-foreground px-2">{item?.materialName}</span>
          ) : (
            <MaterialSearchPanel
              search={materialSearch.cellSearchOpen === index ? materialSearch.cellSearchQuery : ''}
              onSearchChange={(v) => materialSearch.onCellSearchChange(index, v)}
              results={materialSearch.results}
              selected={materialSearch.selected}
              onSelect={(mat) => {
                setValue(`lineItems.${index}.materialName`, mat.name);
                setValue(`lineItems.${index}.materialCode`, mat.id);
                if (mat.unit) setValue(`lineItems.${index}.unitOfMeasure`, mat.unit);
                materialSearch.onCellSearchClose();
              }}
              onDeselect={materialSearch.onDeselect}
              onQuantityChange={materialSearch.onQtyChange}
              onAddToList={() => {
                for (const mat of materialSearch.selected) {
                  setValue(`lineItems.${index}.materialName`, mat.name);
                  setValue(`lineItems.${index}.materialCode`, mat.id);
                  if (mat.unit) setValue(`lineItems.${index}.unitOfMeasure`, mat.unit);
                  setValue(`lineItems.${index}.quantityOrdered`, mat.quantity);
                }
                materialSearch.onCellSearchClose();
              }}
              filters={materialSearch.filters}
              onFiltersChange={materialSearch.onFiltersChange}
              open={materialSearch.cellSearchOpen === index}
              onOpenChange={(open) => {
                if (open) materialSearch.onCellSearchChange(index, materialSearch.cellSearchQuery);
                else materialSearch.onCellSearchClose();
              }}
              searchPlaceholder=""
              addToListLabel={materialSearch.addToListLabel}
              compact
            />
          )}
        </td>

        {/* Material code */}
        <td className={`${cell} ${cellBorder}`}>
          <Input {...register(`lineItems.${index}.materialCode`)} className={NAKED_INPUT_CLASS} />
        </td>

        {/* Cost code */}
        <td className={`${cell} ${cellBorder}`}>
          <Input {...register(`lineItems.${index}.costCode`)} className={NAKED_INPUT_CLASS} />
        </td>

        {/* UoM */}
        <td className={`${cell} ${cellBorder}`}>
          <Controller
            name={`lineItems.${index}.unitOfMeasure`}
            control={control}
            render={({ field: f }) => (
              <CustomDropdown
                options={[...UOM_OPTIONS]}
                value={f.value}
                onChange={f.onChange}
                placeholder="UoM"
                error={!!errors.lineItems?.[index]?.unitOfMeasure}
                borderless
              />
            )}
          />
        </td>

        {/* Price/unit */}
        <td className={`${cell} ${cellBorder}`}>
          <Input
            inputMode="decimal"
            onKeyDown={onDecimalOnly}
            {...register(`lineItems.${index}.unitPrice`, { valueAsNumber: true })}
            className={NAKED_INPUT_CLASS}
            placeholder="0"
          />
        </td>

        {/* Qty ordered */}
        <td className={`${cell} ${cellBorder} ${exceedsAvailable ? 'bg-destructive/5' : ''}`}>
          <Input
            onKeyDown={onDigitsOnly}
            {...register(`lineItems.${index}.quantityOrdered`, { valueAsNumber: true })}
            className={NAKED_INPUT_CLASS}
            placeholder="0"
            aria-invalid={exceedsAvailable || undefined}
          />
        </td>

        {isDrawdownMode ? (
          /* Available qty (drawdown) — read-only bulk-order remaining qty */
          <td className={`${cell} ${cellBorder}`}>
            <div className="flex flex-col justify-center h-9 px-2">
              {isFilled && (
                <>
                  <span
                    className={`text-sm ${exceedsAvailable ? 'text-destructive font-medium' : 'text-foreground'}`}
                  >
                    {item?.availableQty ?? '-'}
                  </span>
                  {exceedsAvailable && (
                    <span className="text-[10px] leading-tight text-destructive">
                      {t('create.drawdownExceedsRemaining')}
                    </span>
                  )}
                </>
              )}
            </div>
          </td>
        ) : (
          <>
            {/* Appr. RFQ */}
            <td className={`${cell} ${cellBorder}`}>
              <div className="flex items-center justify-end gap-1 h-9 pr-1">
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
            </td>

            {/* Bulk orders */}
            <td className={`${cell} ${cellBorder}`}>
              <div className="flex items-center justify-end gap-1 h-9 pr-1">
                {isFilled && (
                  <span className="text-xs text-foreground">{bulkOrdersCount} orders</span>
                )}
                <button
                  type="button"
                  disabled={!isFilled}
                  onClick={() => onBulkOrderClick?.(index)}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <InfoIcon style={{ width: 13, height: 13 }} />
                </button>
              </div>
            </td>
          </>
        )}

        {/* Exp. delivery date — always editable */}
        <td className={`${cell} ${cellBorder}`}>
          <Controller
            name={`lineItems.${index}.expectedDeliveryDate`}
            control={control}
            render={({ field: f }) => (
              <DatePicker
                value={f.value ?? ''}
                onChange={f.onChange}
                borderless
                minDate={new Date().toISOString().slice(0, 10)}
              />
            )}
          />
        </td>

        {/* Delivery location — always editable */}
        <td className={`${cell} ${cellBorder}`}>
          <Controller
            name={`lineItems.${index}.deliveryLocationId`}
            control={control}
            render={({ field: f }) => (
              <CustomDropdown
                options={locationOptions}
                value={f.value ?? ''}
                onChange={f.onChange}
                placeholder="Location"
                borderless
              />
            )}
          />
        </td>

        {/* Actions */}
        <td className={`px-1 py-1 ${rowBorder} border-border`}>
          {isFilled ? (
            <div className="flex items-center justify-center gap-1">
              <MessageBadgeIcon
                hasNotification={Boolean(item?.notes)}
                icon={
                  <EditInSquareIcon style={ACTION_ICON_SIZE} className="block text-foreground" />
                }
                onClick={() => onToggleNotes(index)}
              />
              <button
                type="button"
                onClick={() => remove(index)}
                className="p-1 text-foreground hover:text-foreground/70"
              >
                <DeleteIcon style={ACTION_ICON_SIZE} />
              </button>
            </div>
          ) : null}
        </td>
      </tr>

      {/* Additional Notes row */}
      {hasNotes && (
        <tr>
          <td
            colSpan={isDrawdownMode ? 10 : 11}
            className={`px-3 py-3 ${isLast ? '' : 'border-b'} border-border`}
          >
            <div className="flex flex-col gap-2">
              <span className="text-sm text-foreground">
                Additional Notes{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </span>
              <textarea
                {...register(`lineItems.${index}.notes`)}
                placeholder="Add any additional information about this material..."
                className="w-full min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 resize-y"
              />
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}
