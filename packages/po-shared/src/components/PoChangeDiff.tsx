import type { PoChangedFields, PoChangeFieldDiff } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Alert, formatCurrency, formatDate } from '@forethread/ui-components';
import ArrowRightIcon from '@forethread/ui-components/assets/icons/arrow-right.svg?react';

/** Fields rendered as currency in the diff. */
const CURRENCY_FIELDS = new Set(['unitPrice']);
/** Fields rendered as a localised date in the diff (yyyy-MM-dd or ISO). */
const DATE_FIELDS = new Set(['plannedDeliveryDate', 'expectedDeliveryDate']);

export interface PoChangeDiffProps {
  changedFields: PoChangedFields;
  /** Resolve a deliveryLocationId to its human label for the diff. */
  locationOptions?: { value: string; label: string }[];
  /**
   * Render each changed line item inside its own bordered card (PO detail
   * "Changes request" tab, pc5). When false, line items render as a flat list
   * under a single heading (wizard step 3, pc3).
   */
  lineItemsAsCards?: boolean;
  /** Optional "Edit" affordances next to each section heading (wizard step 3). */
  onEditFields?: () => void;
  onEditLineItems?: () => void;
}

/**
 * FLOW 3 — shared PO change diff renderer. Draws the "Suggested changes:" band
 * (PO-level old→new rows, old struck-through) followed by the per-line-item
 * changes. Reused by the wizard review step, the PO detail "Changes request"
 * tab, the resolved-CR action-log entry, and the vendor change modal so the diff
 * looks identical everywhere (SPEC FLOW 3 / pc3, pc5, pc6).
 */
export function PoChangeDiff({
  changedFields,
  locationOptions,
  lineItemsAsCards = false,
  onEditFields,
  onEditLineItems,
}: PoChangeDiffProps) {
  const { t } = useTranslation('purchaseOrders');

  const fieldEntries = Object.entries(changedFields.fields ?? {});
  const lineItems = changedFields.lineItems ?? [];
  const removedLineItems = changedFields.removedLineItems ?? [];
  const addedLineItems = changedFields.addedLineItems ?? [];
  const isCancellation = changedFields.cancelPo === true;

  const formatValue = (field: string, value: unknown): string => {
    if (value === null || value === undefined || value === '') return t('change.empty');
    if (CURRENCY_FIELDS.has(field)) return formatCurrency(value as number);
    if (DATE_FIELDS.has(field)) return formatDate(String(value));
    if (field === 'deliveryLocationId' && locationOptions) {
      return locationOptions.find((l) => l.value === value)?.label ?? String(value);
    }
    return String(value);
  };

  const poFieldLabel = (field: string): string =>
    t(`change.fields.${field}` as never, { defaultValue: field });
  const lineFieldLabel = (field: string): string =>
    t(`change.lineFields.${field}` as never, { defaultValue: field });

  return (
    <div className="flex flex-col gap-6">
      {/* Cancellation request (FOR-352) — supersedes any other diff */}
      {isCancellation && <Alert variant="destructive">{t('change.cancelBanner')}</Alert>}

      {/* Suggested changes (PO-level) */}
      {fieldEntries.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground">{t('change.suggestedChanges')}</h3>
            {onEditFields && (
              <button
                type="button"
                onClick={onEditFields}
                className="text-sm text-foreground hover:text-foreground/70 transition-colors"
              >
                {t('change.edit')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            {fieldEntries.map(([field, diff]) => (
              <DiffRow
                key={field}
                label={poFieldLabel(field)}
                diff={diff}
                format={(v) => formatValue(field, v)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Line item changes */}
      {lineItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground">{t('change.lineItemChanges')}</h3>
            {onEditLineItems && (
              <button
                type="button"
                onClick={onEditLineItems}
                className="text-sm text-foreground hover:text-foreground/70 transition-colors"
              >
                {t('change.edit')}
              </button>
            )}
          </div>
          <div className={lineItemsAsCards ? 'flex flex-col gap-3' : 'flex flex-col gap-5'}>
            {lineItems.map((li, idx) => (
              <div
                key={`${li.lineItemId}-${idx}`}
                className={lineItemsAsCards ? 'rounded-lg border border-border p-4' : undefined}
              >
                <p className="font-semibold text-foreground mb-3">{li.name}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                  {Object.entries(li.changes).map(([field, diff]) => (
                    <DiffRow
                      key={field}
                      label={lineFieldLabel(field)}
                      diff={diff}
                      format={(v) => formatValue(field, v)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Added line items — created on the PO on approval */}
      {addedLineItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground">{t('change.addedLineItems')}</h3>
            {onEditLineItems && (
              <button
                type="button"
                onClick={onEditLineItems}
                className="text-sm text-foreground hover:text-foreground/70 transition-colors"
              >
                {t('change.edit')}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {addedLineItems.map((li, idx) => (
              <div key={`${li.name}-${idx}`} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-foreground truncate">{li.name}</p>
                  <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                    {t('change.addedBadge')}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                  <AddedValue
                    label={lineFieldLabel('quantityOrdered')}
                    value={String(li.quantityOrdered)}
                  />
                  <AddedValue label={lineFieldLabel('unitOfMeasure')} value={li.unitOfMeasure} />
                  <AddedValue
                    label={lineFieldLabel('unitPrice')}
                    value={formatCurrency(li.unitPrice)}
                  />
                  {li.expectedDeliveryDate && (
                    <AddedValue
                      label={lineFieldLabel('expectedDeliveryDate')}
                      value={formatDate(li.expectedDeliveryDate)}
                    />
                  )}
                  {li.deliveryTime && (
                    <AddedValue label={lineFieldLabel('deliveryTime')} value={li.deliveryTime} />
                  )}
                  {li.costCode && (
                    <AddedValue label={lineFieldLabel('costCode')} value={li.costCode} />
                  )}
                  {li.notes && <AddedValue label={lineFieldLabel('notes')} value={li.notes} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Removed line items (FOR-352) — deleted from the PO on approval */}
      {removedLineItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground">{t('change.removedLineItems')}</h3>
            {onEditLineItems && (
              <button
                type="button"
                onClick={onEditLineItems}
                className="text-sm text-foreground hover:text-foreground/70 transition-colors"
              >
                {t('change.edit')}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {removedLineItems.map((li, idx) => (
              <div
                key={`${li.lineItemId}-${idx}`}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <span className="text-sm text-muted-foreground line-through truncate">
                  {li.name}
                </span>
                <span className="shrink-0 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                  {t('change.removedBadge')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface DiffRowProps {
  label: string;
  diff: PoChangeFieldDiff;
  format: (value: unknown) => string;
}

/** A single `{label}` / `{value}` cell for an added line item (no old value). */
function AddedValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground truncate">{value}</p>
    </div>
  );
}

/** A single `{label}` / `{old struck} → {new}` diff cell. */
function DiffRow({ label, diff, format }: DiffRowProps) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="flex items-center gap-1.5 text-sm text-foreground">
        <span className="line-through text-muted-foreground truncate">{format(diff.from)}</span>
        <ArrowRightIcon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{format(diff.to)}</span>
      </p>
    </div>
  );
}
