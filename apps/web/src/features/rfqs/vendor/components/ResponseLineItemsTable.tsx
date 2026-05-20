import { useTranslation } from '@forethread/i18n';
import {
  Checkbox,
  cn,
  DatePicker,
  Input,
  MessageBadgeIcon,
  onDecimalOnly,
  StepperInput,
  ToggleSwitch,
} from '@forethread/ui-components';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import EditInSquareIcon from '@forethread/ui-components/assets/icons/edit-in-square.svg?react';
import HalfClockIcon from '@forethread/ui-components/assets/icons/half-clock.svg?react';
import RombIcon from '@forethread/ui-components/assets/icons/romb.svg?react';
import { Link } from 'react-router-dom';

import type { LineItemFormState, QuoteTotals } from '../hooks/useRfqResponse';

import { LineItemExpandedRow } from './LineItemExpandedRow';

const NAKED_INPUT_CLASS = '!bg-transparent !rounded-none !border-0 !shadow-none';

const TH_CLASS =
  'py-2.5 px-3 text-xs font-bold whitespace-nowrap tracking-wide border-r border-border';

interface ResponseLineItemsTableProps {
  lineItems: LineItemFormState[];
  onToggleInclude: (index: number) => void;
  onUpdateItem: (index: number, field: keyof LineItemFormState, value: unknown) => void;
  onToggleExpanded: (index: number, section: 'notes' | 'backorder') => void;
  totals: QuoteTotals;
  onOpenSubstitute: (index: number) => void;
}

export function ResponseLineItemsTable({
  lineItems,
  onToggleInclude,
  onUpdateItem,
  onToggleExpanded,
  totals,
  onOpenSubstitute,
}: ResponseLineItemsTableProps) {
  const { t } = useTranslation('rfqs');

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="p-4 pb-0">
        <h2 className="text-base font-medium text-foreground">{t('response.lineItems')}</h2>
      </div>

      <div className="p-4 overflow-x-auto">
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
                  onToggleInclude={onToggleInclude}
                  onUpdateItem={onUpdateItem}
                  onToggleExpanded={onToggleExpanded}
                  onOpenSubstitute={onOpenSubstitute}
                />
              );
            })}

            {/* Footer totals row */}
            <tr className="border-t border-border bg-[hsl(var(--table-header))]">
              <td colSpan={12} className="py-3 px-4">
                {totals.totalItemsQuoted > 0 ? (
                  <div className="flex items-center gap-8 text-sm">
                    <span className="text-muted-foreground">
                      {t('response.totalItemsQuoted')}{' '}
                      <span className="font-medium text-foreground">
                        {totals.totalItemsQuoted}/{totals.totalItems}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {t('response.subtotal')}{' '}
                      <span className="font-medium text-foreground">
                        {formatCurrency(totals.subtotal)}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {t('response.discounts')}{' '}
                      <span className="font-medium text-foreground">
                        {totals.discountTotal > 0
                          ? `${((totals.discountTotal / (totals.subtotal || 1)) * 100).toFixed(0)}%`
                          : '-'}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      GST{' '}
                      <span className="font-medium text-foreground">
                        {totals.gstTotal > 0
                          ? `${((totals.gstTotal / (totals.subtotal || 1)) * 100).toFixed(0)}%`
                          : '-'}
                      </span>
                    </span>
                    <span className="ml-auto text-muted-foreground">
                      {t('response.totalQuote')}{' '}
                      <span className="font-semibold text-foreground">
                        {formatCurrency(totals.totalQuote)}
                      </span>
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {t('response.totalItems')}{' '}
                    <span className="font-medium text-foreground">{totals.totalItems}</span>
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
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
  onToggleInclude,
  onUpdateItem,
  onToggleExpanded,
  onOpenSubstitute,
}: {
  item: LineItemFormState;
  index: number;
  lineTotal: number;
  hasQuote: boolean;
  onToggleInclude: (i: number) => void;
  onUpdateItem: (i: number, field: keyof LineItemFormState, value: unknown) => void;
  onToggleExpanded: (i: number, section: 'notes' | 'backorder') => void;
  onOpenSubstitute: (i: number) => void;
}) {
  const { t } = useTranslation('rfqs');

  const rowBg = item.substituteItemId ? 'bg-warning/20' : '';
  const hasNotes = Boolean(item.notes);
  const hasBackOrder =
    Boolean(item.backOrderQty && parseFloat(item.backOrderQty) > 0) ||
    Boolean(item.backOrderDeliveryDate);
  const hasSubstitute = Boolean(item.substituteItemId);

  return (
    <>
      <tr className={cn(rowBg)}>
        {/* Include toggle */}
        <td className={TD_CLASS}>
          <ToggleSwitch checked={item.included} onChange={() => onToggleInclude(index)} />
        </td>

        {/* Material Name */}
        <td className={cn(TD_CLASS, 'overflow-clip')}>
          {item.materialId ? (
            <Link
              to={`/materials/${item.substituteItemId ?? item.materialId}`}
              className="text-foreground text-sm hover:underline whitespace-nowrap"
            >
              {item.substituteName ?? item.materialName}
            </Link>
          ) : (
            <span className="text-foreground text-sm whitespace-nowrap">
              {item.substituteName ?? item.materialName}
            </span>
          )}
        </td>

        {/* UoM */}
        <td className={TD_CLASS}>{item.unit}</td>

        {/* Req Qty */}
        <td className={cn(TD_CLASS, 'overflow-clip')}>{item.requestedQty}</td>

        {/* Avail Qty */}
        <td className={cn(TD_CLASS, 'px-1')}>
          <StepperInput
            value={item.availQty}
            onValueChange={(v) => onUpdateItem(index, 'availQty', v)}
            className={cn('h-8 w-full text-sm', NAKED_INPUT_CLASS)}
            disabled={!item.included}
          />
        </td>

        {/* Unit Price */}
        <td className={cn(TD_CLASS, 'overflow-clip')}>
          <Input
            value={item.unitPrice}
            onChange={(e) => onUpdateItem(index, 'unitPrice', e.target.value)}
            onKeyDown={onDecimalOnly}
            className={cn('h-8 w-full text-sm', NAKED_INPUT_CLASS)}
            disabled={!item.included}
          />
        </td>

        {/* Discount */}
        <td className={cn(TD_CLASS, 'overflow-clip')}>
          <Input
            value={item.discount}
            onChange={(e) => {
              const v = e.target.value;
              if (item.discountType === 'PERCENT' && v !== '' && parseFloat(v) > 100) return;
              onUpdateItem(index, 'discount', v);
            }}
            onKeyDown={onDecimalOnly}
            rightIcon={
              <button
                type="button"
                disabled={!item.included}
                className="text-sm text-foreground cursor-pointer disabled:cursor-not-allowed"
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
            className={cn('h-8 w-full text-sm', NAKED_INPUT_CLASS)}
            disabled={!item.included}
          />
        </td>

        {/* GST */}
        <td className={cn(TD_CLASS, 'overflow-clip')}>
          <Input
            value={item.gst}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '' || parseFloat(v) <= 100) onUpdateItem(index, 'gst', v);
            }}
            onKeyDown={onDecimalOnly}
            rightIcon={<span className="text-sm text-foreground">%</span>}
            className={cn('h-8 w-full text-sm', NAKED_INPUT_CLASS)}
            disabled={!item.included}
          />
        </td>

        {/* Tax Incl */}
        <td className={cn(TD_CLASS, 'text-center')}>
          <Checkbox
            checked={item.taxIncluded}
            onChange={(v) => onUpdateItem(index, 'taxIncluded', v)}
            disabled={!item.included}
          />
        </td>

        {/* Delivery Date */}
        <td className={TD_CLASS}>
          <DatePicker
            value={item.deliveryDate}
            onChange={(v) => onUpdateItem(index, 'deliveryDate', v)}
            borderless
            disabled={!item.included}
            minDate={new Date().toISOString().slice(0, 10)}
          />
        </td>

        {/* Line Total */}
        <td className={cn(TD_CLASS, 'overflow-clip')}>
          <span
            className={cn(
              'text-sm font-medium',
              hasQuote ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {hasQuote ? `${formatCurrency(lineTotal)}` : t('response.noQuote')}
          </span>
        </td>

        {/* Actions */}
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
              icon={<RombIcon className="w-4 h-4 block text-foreground" />}
              onClick={() => onOpenSubstitute(index)}
            />
          </div>
        </td>
      </tr>

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

function calcLineTotal(item: LineItemFormState): number {
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

function formatCurrency(value: number): string {
  if (value === 0) return '0';
  return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
