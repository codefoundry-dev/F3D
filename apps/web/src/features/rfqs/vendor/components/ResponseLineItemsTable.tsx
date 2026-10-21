import type { MaterialListItemDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { MaterialImageThumb } from '@forethread/rfq-shared';
import {
  Button,
  cn,
  Input,
  LineItemEditor,
  MessageBadgeIcon,
  ScrollTable,
  useIsPhone,
  type LineItemField,
} from '@forethread/ui-components';
import CircleReloadIcon from '@forethread/ui-components/assets/icons/circle-reload.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import EditInSquareIcon from '@forethread/ui-components/assets/icons/edit-in-square.svg?react';
import HalfClockIcon from '@forethread/ui-components/assets/icons/half-clock.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import SearchIcon from '@forethread/ui-components/assets/icons/search.svg?react';
import { Link } from 'react-router-dom';

import { availExceedsRequested } from '../hooks/availExceedsRequested';
import type { LineItemFormState, QuoteTotals } from '../hooks/useRfqResponse';

import { LineItemExpandedRow } from './LineItemExpandedRow';
import { MaterialSearchPopup } from './MaterialSearchPopup';
import {
  calcLineTotal,
  useQuoteLineFields,
  type QuoteLineField,
  type QuoteLineFieldKey,
} from './quoteLineFields';

type CellFields = Record<QuoteLineFieldKey, QuoteLineField>;

const TH_CLASS =
  'py-2.5 px-3 text-xs font-bold whitespace-nowrap tracking-wide border-r border-border';

/** Yellow highlight for rows with a substitute material (design #FFF2B5) */
const SUBSTITUTE_ROW_BG = 'bg-[hsl(var(--row-highlight))]';

interface ResponseLineItemsTableProps {
  lineItems: LineItemFormState[];
  onToggleInclude: (index: number) => void;
  onUpdateItem: (index: number, field: keyof LineItemFormState, value: unknown) => void;
  onToggleExpanded: (index: number, section: 'notes' | 'backorder') => void;
  totals: QuoteTotals;
  /** Index of the row whose substitute search is open (null = closed) */
  substituteOpenIdx: number | null;
  substituteQuery: string;
  onSubstituteQueryChange: (value: string) => void;
  onOpenSubstitute: (index: number) => void;
  onCloseSubstitute: () => void;
  onSelectSubstitute: (material: MaterialListItemDto) => void;
  /** Material search needs a session, so the guest page turns substitutes off (phone sheet). */
  substituteEnabled?: boolean;
}

export function ResponseLineItemsTable({
  lineItems,
  onToggleInclude,
  onUpdateItem,
  onToggleExpanded,
  totals,
  substituteOpenIdx,
  substituteQuery,
  onSubstituteQueryChange,
  onOpenSubstitute,
  onCloseSubstitute,
  onSelectSubstitute,
  substituteEnabled = true,
}: ResponseLineItemsTableProps) {
  const { t } = useTranslation('rfqs');
  const isPhone = useIsPhone();
  // Line fields are defined once (B10): grid cells on desktop, the edit sheet on phones.
  const cellFields = Object.fromEntries(
    useQuoteLineFields({ onUpdateItem, onToggleInclude, variant: 'cell' }).map((f) => [f.key, f]),
  ) as CellFields;
  const sheetFields = useQuoteLineFields({ onUpdateItem, onToggleInclude, variant: 'sheet' });

  if (isPhone) {
    const substituteField: LineItemField<LineItemFormState> = {
      key: 'substitute',
      label: t('response.substituteItem'),
      hidden: (item) => !substituteEnabled || !item.included,
      input: (item, index) =>
        substituteOpenIdx === index ? (
          <div className="flex flex-col gap-2">
            <Input
              ref={(el) => {
                if (el && document.activeElement !== el) el.focus();
              }}
              value={substituteQuery}
              onChange={(e) => onSubstituteQueryChange(e.target.value)}
              placeholder={t('response.searchMaterials')}
              leftIcon={<SearchIcon className="w-4 h-4 text-muted-foreground" />}
              className="h-11 w-full text-base"
            />
            <MaterialSearchPopup
              open
              inline
              searchQuery={substituteQuery}
              onClose={onCloseSubstitute}
              onSelect={onSelectSubstitute}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {item.substituteName ?? '-'}
            </span>
            {item.substituteItemId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onUpdateItem(index, 'substituteItemId', null);
                  onUpdateItem(index, 'substituteName', null);
                }}
              >
                {t('response.clearAll')}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<PackageIcon className="size-4" />}
              onClick={() => onOpenSubstitute(index)}
            >
              {t('response.searchMaterials')}
            </Button>
          </div>
        ),
    };
    const lineTotalField: LineItemField<LineItemFormState> = {
      key: 'lineTotal',
      label: t('response.lineTotal'),
      value: (item) =>
        item.included ? formatCurrency(calcLineTotal(item)) : t('response.noQuote'),
      hidden: () => true,
      input: () => null,
    };

    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-medium text-foreground">{t('response.lineItems')}</h2>
        <LineItemEditor
          lines={lineItems}
          fields={[...sheetFields, substituteField, lineTotalField]}
          getKey={(item) => item.rfqLineItemId}
          getTitle={(item) => item.substituteName ?? item.materialName}
          getSubtitle={(item) =>
            `${t('response.reqQty')}: ${item.requestedQty} ${item.unit}` +
            (item.included ? '' : ` · ${t('response.noQuote')}`)
          }
          hasError={(item) => availExceedsRequested(item)}
          // FOR-273: Avail Qty may not exceed Req Qty — keep the sheet on the line.
          validateLine={(i) => {
            const item = lineItems[i];
            return !item || !availExceedsRequested(item);
          }}
        />
        <QuoteTotalsSummary totals={totals} stacked />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="p-4 pb-0">
        <h2 className="text-base font-medium text-foreground">{t('response.lineItems')}</h2>
      </div>

      <ScrollTable className="p-4">
        <table className="min-w-[1200px] w-full text-sm border border-border rounded-lg">
          <thead>
            <tr className="border-b border-border text-left bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))]">
              <th className={cn(TH_CLASS, 'w-[64px]')}>{t('response.incl')}</th>
              <th className={cn(TH_CLASS, 'w-[208px]')}>{t('response.materialName')}</th>
              <th className={cn(TH_CLASS, 'w-[78px]')}>{t('response.uom')}</th>
              <th className={cn(TH_CLASS, 'w-[112px]')}>{t('response.reqQty')}</th>
              <th className={cn(TH_CLASS, 'w-[112px]')}>{t('response.availQty')}</th>
              <th className={cn(TH_CLASS, 'w-[112px]')}>{t('response.unitPrice')}</th>
              <th className={cn(TH_CLASS, 'w-[88px]')}>{t('response.discount')}</th>
              <th className={cn(TH_CLASS, 'w-[88px]')}>{t('response.gst')}</th>
              <th className={cn(TH_CLASS, 'w-[80px]')}>{t('response.taxIncl')}</th>
              <th className={cn(TH_CLASS, 'w-[148px]')}>{t('response.deliveryDate')}</th>
              <th className={cn(TH_CLASS, 'w-[120px]')}>{t('response.lineTotal')}</th>
              <th className="py-2.5 px-3 text-xs font-bold whitespace-nowrap tracking-wide w-[92px] text-right">
                {t('columns.actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, idx) => {
              const lineTotal = calcLineTotal(item);
              const hasQuote =
                item.included &&
                parseFloat(item.availQty || '0') > 0 &&
                parseFloat(item.unitPrice || '0') > 0;

              return (
                <LineItemRow
                  key={item.rfqLineItemId}
                  item={item}
                  index={idx}
                  lineTotal={lineTotal}
                  hasQuote={hasQuote}
                  onUpdateItem={onUpdateItem}
                  onToggleExpanded={onToggleExpanded}
                  isSubstituteOpen={substituteOpenIdx === idx}
                  substituteQuery={substituteQuery}
                  onSubstituteQueryChange={onSubstituteQueryChange}
                  onOpenSubstitute={onOpenSubstitute}
                  onCloseSubstitute={onCloseSubstitute}
                  onSelectSubstitute={onSelectSubstitute}
                  fields={cellFields}
                />
              );
            })}

            {/* Footer totals row */}
            <tr className="border-t border-border bg-[hsl(var(--table-header))]">
              <td colSpan={12} className="py-3 px-4">
                <QuoteTotalsSummary totals={totals} />
              </td>
            </tr>
          </tbody>
        </table>
      </ScrollTable>
    </div>
  );
}

/* ─── Line Item Row ─────────────────────────────────────────────────────────── */

const TD_CLASS = 'py-1 px-3 border border-border h-[44px]';

function LineItemRow({
  item,
  index,
  lineTotal,
  hasQuote,
  onUpdateItem,
  onToggleExpanded,
  isSubstituteOpen,
  substituteQuery,
  onSubstituteQueryChange,
  onOpenSubstitute,
  onCloseSubstitute,
  onSelectSubstitute,
  fields,
}: {
  fields: CellFields;
  item: LineItemFormState;
  index: number;
  lineTotal: number;
  hasQuote: boolean;
  onUpdateItem: (i: number, field: keyof LineItemFormState, value: unknown) => void;
  onToggleExpanded: (i: number, section: 'notes' | 'backorder') => void;
  isSubstituteOpen: boolean;
  substituteQuery: string;
  onSubstituteQueryChange: (value: string) => void;
  onOpenSubstitute: (i: number) => void;
  onCloseSubstitute: () => void;
  onSelectSubstitute: (material: MaterialListItemDto) => void;
}) {
  const { t } = useTranslation('rfqs');

  const highlighted = Boolean(item.substituteItemId) || isSubstituteOpen;
  const rowBg = highlighted ? SUBSTITUTE_ROW_BG : '';
  const excluded = !item.included;
  const hasNotes = Boolean(item.notes);
  const hasBackOrder =
    Boolean(item.backOrderQty && parseFloat(item.backOrderQty) > 0) ||
    Boolean(item.backOrderDeliveryDate);
  const hasSubstitute = Boolean(item.substituteItemId);
  // FOR-273: flag the row when the available qty exceeds the requested qty.
  const availExceedsReq = availExceedsRequested(item);

  return (
    <>
      <tr className={cn(rowBg, excluded && 'text-muted-foreground')}>
        {/* Include toggle */}
        <td className={TD_CLASS}>{fields.included.input(item, index)}</td>

        {/* Material Name (or inline substitute search) */}
        <td className={cn(TD_CLASS, 'overflow-clip')}>
          {isSubstituteOpen ? (
            <Input
              ref={(el) => {
                if (el && document.activeElement !== el) el.focus();
              }}
              value={substituteQuery}
              onChange={(e) => onSubstituteQueryChange(e.target.value)}
              placeholder={t('response.searchMaterials')}
              leftIcon={<SearchIcon className="w-4 h-4 text-muted-foreground" />}
              className="h-8 w-full text-sm !bg-card"
              onKeyDown={(e) => {
                if (e.key === 'Escape') onCloseSubstitute();
              }}
            />
          ) : (
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              {hasSubstitute ? (
                <CircleReloadIcon
                  className="w-4 h-4 shrink-0 text-foreground"
                  aria-label={t('response.substituteItem')}
                />
              ) : (
                // The requested material's image — hidden once a substitute is
                // picked, since it would no longer show the item being quoted.
                <MaterialImageThumb url={item.imageUrl} name={item.materialName} />
              )}
              {item.materialId ? (
                <Link
                  to={`/materials/${item.substituteItemId ?? item.materialId}`}
                  className={cn(
                    'text-sm hover:underline whitespace-nowrap',
                    excluded ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {item.substituteName ?? item.materialName}
                </Link>
              ) : (
                <span
                  className={cn(
                    'text-sm whitespace-nowrap',
                    excluded ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {item.substituteName ?? item.materialName}
                </span>
              )}
            </span>
          )}
        </td>

        {/* UoM */}
        <td className={TD_CLASS}>{item.unit}</td>

        {/* Req Qty */}
        <td className={cn(TD_CLASS, 'overflow-clip')}>{item.requestedQty}</td>

        {/* Avail Qty */}
        <td className={cn(TD_CLASS, 'px-1', availExceedsReq && 'bg-destructive/5')}>
          <div className="flex flex-col gap-0.5">
            {fields.availQty.input(item, index)}
            {fields.availQty.hint?.(item, index)}
          </div>
        </td>

        {/* Unit Price */}
        <td className={cn(TD_CLASS, 'overflow-clip')}>{fields.unitPrice.input(item, index)}</td>

        {/* Discount */}
        <td className={cn(TD_CLASS, 'overflow-clip')}>{fields.discount.input(item, index)}</td>

        {/* GST */}
        <td className={cn(TD_CLASS, 'overflow-clip')}>{fields.gst.input(item, index)}</td>

        {/* Tax Incl */}
        <td className={cn(TD_CLASS, 'text-center')}>{fields.taxIncluded.input(item, index)}</td>

        {/* Delivery Date */}
        <td className={TD_CLASS}>{fields.deliveryDate.input(item, index)}</td>

        {/* Line Total — empty until quoted; "No quote" only for excluded rows */}
        <td className={cn(TD_CLASS, 'overflow-clip')}>
          <span
            className={cn(
              'text-sm font-medium',
              hasQuote ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {hasQuote ? `${formatCurrency(lineTotal)}` : excluded ? t('response.noQuote') : ''}
          </span>
        </td>

        {/* Actions — back-order & substitute are only available for quoted items */}
        <td className={TD_CLASS}>
          <div className="flex items-center justify-end gap-3">
            {item.expandedSection === 'notes' ? (
              <MessageBadgeIcon
                icon={<CrossInCircleIcon className="w-4 h-4 block text-foreground" />}
                onClick={() => onToggleExpanded(index, 'notes')}
              />
            ) : (
              <MessageBadgeIcon
                hasNotification={hasNotes}
                icon={<EditInSquareIcon className="w-4 h-4 block text-foreground" />}
                onClick={() => onToggleExpanded(index, 'notes')}
              />
            )}
            {!excluded && (
              <>
                {item.expandedSection === 'backorder' ? (
                  <MessageBadgeIcon
                    icon={<CrossInCircleIcon className="w-4 h-4 block text-foreground" />}
                    onClick={() => onToggleExpanded(index, 'backorder')}
                  />
                ) : (
                  <MessageBadgeIcon
                    hasNotification={hasBackOrder}
                    icon={<HalfClockIcon className="w-4 h-4 block text-foreground" />}
                    onClick={() => onToggleExpanded(index, 'backorder')}
                  />
                )}
                <MessageBadgeIcon
                  hasNotification={hasSubstitute}
                  icon={<PackageIcon className="w-4 h-4 block text-foreground" />}
                  onClick={() => (isSubstituteOpen ? onCloseSubstitute() : onOpenSubstitute(index))}
                />
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Inline substitute search results, anchored right below this row */}
      {isSubstituteOpen && (
        <tr>
          <td colSpan={12} className="p-0 border-0 relative">
            <MaterialSearchPopup
              open
              searchQuery={substituteQuery}
              onClose={onCloseSubstitute}
              onSelect={onSelectSubstitute}
              positionClassName="absolute left-[64px] top-0 z-50"
            />
          </td>
        </tr>
      )}

      {/* Expanded row for notes / back-order */}
      {item.expandedSection && (
        <tr className={cn(rowBg)}>
          <td colSpan={12} className="p-0">
            <LineItemExpandedRow
              item={item}
              index={index}
              section={item.expandedSection}
              onUpdateItem={onUpdateItem}
            />
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

function formatCurrency(value: number): string {
  if (value === 0) return '0';
  return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/* ─── Totals ────────────────────────────────────────────────────────────────── */

function QuoteTotalsSummary({
  totals,
  stacked = false,
}: {
  totals: QuoteTotals;
  stacked?: boolean;
}) {
  const { t } = useTranslation('rfqs');
  if (totals.totalItemsQuoted === 0) {
    return (
      <div
        className={cn(
          'text-sm text-muted-foreground',
          stacked && 'rounded-xl border border-border bg-card p-4',
        )}
      >
        {t('response.totalItems')}{' '}
        <span className="font-medium text-foreground">{totals.totalItems}</span>
      </div>
    );
  }
  const pct = (part: number) =>
    part > 0 ? `${((part / (totals.subtotal || 1)) * 100).toFixed(0)}%` : '-';
  const rows: [string, string][] = [
    [t('response.totalItemsQuoted'), `${totals.totalItemsQuoted}/${totals.totalItems}`],
    [t('response.subtotal'), formatCurrency(totals.subtotal)],
    [t('response.discounts'), pct(totals.discountTotal)],
    ['GST', pct(totals.gstTotal)],
  ];

  // Phones: a stacked summary card instead of one wide row.
  if (stacked) {
    return (
      <dl
        className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-sm"
        data-testid="quote-totals"
      >
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium text-foreground">{value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
          <dt className="text-muted-foreground">{t('response.totalQuote')}</dt>
          <dd className="font-semibold text-foreground">{formatCurrency(totals.totalQuote)}</dd>
        </div>
      </dl>
    );
  }

  return (
    <div className="flex items-center gap-8 text-sm">
      {rows.map(([label, value]) => (
        <span key={label} className="text-muted-foreground">
          {label} <span className="font-medium text-foreground">{value}</span>
        </span>
      ))}
      <span className="ml-auto text-muted-foreground">
        {t('response.totalQuote')}{' '}
        <span className="font-semibold text-foreground">{formatCurrency(totals.totalQuote)}</span>
      </span>
    </div>
  );
}
