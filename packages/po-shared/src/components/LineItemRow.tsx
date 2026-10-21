import { useTranslation } from '@forethread/i18n';
import type { MaterialItem, SelectedMaterial, MaterialFilters } from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import EditInSquareIcon from '@forethread/ui-components/assets/icons/edit-in-square.svg?react';
import { MessageBadgeIcon } from '@forethread/ui-components';
import React from 'react';
import {
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';

import { ACTION_ICON_SIZE } from '../constants/line-items';
import type { FormValues } from '../schemas/create-po.schema';

import {
  buildPoLineFields,
  exceedsAvailableQty,
  type PoLineFieldKey,
  type PoLineRow,
} from './poLineFields';

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
  const row: PoLineRow = { index, item, isFilled, approvedQuotesCount, bulkOrdersCount };
  // Cells render the shared line fields; phones stack the same inputs in a sheet (B10).
  const fields = buildPoLineFields({
    t,
    register,
    control,
    errors,
    setValue,
    locationOptions,
    materialSearch,
    isDrawdownMode,
    isPhone: false,
    onApprRfqClick,
    onBulkOrderClick,
  });
  const field = (key: PoLineFieldKey) => fields.find((f) => f.key === key)?.input(row, index);
  const exceedsAvailable = exceedsAvailableQty(row, isDrawdownMode);

  return (
    <React.Fragment>
      <tr>
        {/* Material Name */}
        <td className={`${cell} ${cellBorder} relative`}>{field('name')}</td>

        {/* Material code */}
        <td className={`${cell} ${cellBorder}`}>{field('materialCode')}</td>

        {/* Cost code */}
        <td className={`${cell} ${cellBorder}`}>{field('costCode')}</td>

        {/* UoM */}
        <td className={`${cell} ${cellBorder}`}>{field('uom')}</td>

        {/* Price/unit */}
        <td className={`${cell} ${cellBorder}`}>{field('unitPrice')}</td>

        {/* Qty ordered */}
        <td className={`${cell} ${cellBorder} ${exceedsAvailable ? 'bg-destructive/5' : ''}`}>
          {field('qty')}
        </td>

        {isDrawdownMode ? (
          /* Available qty (drawdown) — read-only bulk-order remaining qty */
          <td className={`${cell} ${cellBorder}`}>{field('availableQty')}</td>
        ) : (
          <>
            {/* Appr. RFQ */}
            <td className={`${cell} ${cellBorder}`}>{field('apprRfq')}</td>

            {/* Bulk orders */}
            <td className={`${cell} ${cellBorder}`}>{field('bulkOrders')}</td>
          </>
        )}

        {/* Exp. delivery date — always editable */}
        <td className={`${cell} ${cellBorder}`}>{field('delivery')}</td>

        {/* Delivery time — optional, always editable */}
        <td className={`${cell} ${cellBorder}`}>{field('deliveryTime')}</td>

        {/* Delivery location — always editable */}
        <td className={`${cell} ${cellBorder}`}>{field('location')}</td>

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
            colSpan={isDrawdownMode ? 11 : 12}
            className={`px-3 py-3 ${isLast ? '' : 'border-b'} border-border`}
          >
            <div className="flex flex-col gap-2">
              <span className="text-sm text-foreground">
                Additional Notes{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </span>
              {field('notes')}
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}
