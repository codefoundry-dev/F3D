import type {
  InvoicePoDeliveryStatus,
  InvoicePoMatchLine,
  InvoicePoMatchPoLine,
  InvoicePoMatchResult,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Badge,
  Button,
  DEFAULT_STATUS_COLOR,
  PO_STATUS_COLORS,
  cn,
  formatCurrency,
  formatDate,
  formatEnum,
  getStatusColor,
  ScrollTable,
} from '@forethread/ui-components';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';
import { useMemo, useState } from 'react';

/**
 * The delivery roll-up gets its own colour scale rather than reusing
 * DELIVERY_OUTCOME_COLORS: "awaiting delivery" is a normal state on a PO an
 * invoice arrives against, not the red NOT_DELIVERED failure.
 */
const DELIVERY_BADGE_COLORS: Record<InvoicePoDeliveryStatus, string> = {
  AWAITING_DELIVERY: DEFAULT_STATUS_COLOR,
  PARTIALLY_DELIVERED: 'bg-[hsl(var(--badge-orange))] text-[hsl(var(--badge-orange-text))]',
  DELIVERED: 'bg-success/10 text-success',
};

/** One comparison row: a PO line and the invoice line billed against it (if any). */
interface ComparisonRow {
  key: string;
  poLine: InvoicePoMatchPoLine | null;
  invoiceLine: InvoicePoMatchLine | null;
}

export interface InvoicePoComparisonProps {
  /** The reconciliation report; nothing renders until it resolved a PO. */
  match: InvoicePoMatchResult;
}

/**
 * The matched (or reviewer-selected) purchase order, shown beside the invoice
 * being reviewed: its lifecycle status, how much of it has actually been
 * delivered, and every one of its lines paired with what the invoice bills for
 * it — so over-billing, price drift and lines that were never ordered are
 * visible without leaving the review form.
 *
 * Two renderings of the same rows: a paired-column table from `md` up, stacked
 * PO-vs-invoice cards below it.
 */
export function InvoicePoComparison({ match }: InvoicePoComparisonProps) {
  const { t } = useTranslation(['invoices', 'purchaseOrders']);
  const [expanded, setExpanded] = useState(true);

  const po = match.po;

  // Invoice lines keyed by the PO line they were paired with, so each PO line can
  // show what the invoice bills against it.
  const rows: ComparisonRow[] = useMemo(() => {
    if (!po) return [];
    const byPoLineId = new Map<string, InvoicePoMatchLine>();
    match.lines.forEach((line) => {
      if (line.poLine) byPoLineId.set(line.poLine.id, line);
    });

    const ordered: ComparisonRow[] = match.poLines.map((poLine) => ({
      key: `po-${poLine.id}`,
      poLine,
      invoiceLine: byPoLineId.get(poLine.id) ?? null,
    }));
    // Billed lines with no counterpart on the PO close the list — they are the
    // ones the reviewer most needs to see, and they have no PO line to sort by.
    const unexpected: ComparisonRow[] = match.lines
      .filter((line) => line.poLine === null)
      .map((line) => ({ key: `inv-${line.invoiceLineId}`, poLine: null, invoiceLine: line }));

    return [...ordered, ...unexpected];
  }, [po, match.lines, match.poLines]);

  if (!po) return null;

  const { delivery } = po;
  const currency = po.currency;
  /** No saved invoice lines yet — show the PO on its own rather than marking every line unbilled. */
  const hasInvoiceLines = match.lines.length > 0;

  // Prefixed, because the PO's own status carries the same words when it is
  // sitting at PARTIALLY_DELIVERED — two identical pills side by side read as a
  // duplicate rather than as two different facts.
  const deliveryStatusLabel = t('invoices:review.match.po.deliveryBadge', {
    defaultValue: 'Delivery: {{status}}',
    status: t(`invoices:review.match.delivery.${delivery.status}`, {
      defaultValue: {
        AWAITING_DELIVERY: 'Awaiting delivery',
        PARTIALLY_DELIVERED: 'Partially delivered',
        DELIVERED: 'Delivered',
      }[delivery.status],
    }),
  });

  const signed = (value: number): string => (value > 0 ? `+${value}` : `${value}`);

  /**
   * How this row's billing compares with the PO — the same flags as the line
   * table. Only rendered once the invoice has saved lines to compare, so an
   * unreviewed invoice doesn't read as "nothing on this PO was billed".
   */
  const rowStatus = (row: ComparisonRow) => {
    if (!row.invoiceLine) {
      return (
        <Badge color="gray">
          {t('invoices:review.match.row.notBilled', { defaultValue: 'Not billed' })}
        </Badge>
      );
    }
    const { flags, priceVariancePct, quantityDelta } = row.invoiceLine;
    if (flags.length === 0) {
      return (
        <Badge color="success">
          {t('invoices:review.match.flag.matched', { defaultValue: 'Matched' })}
        </Badge>
      );
    }
    return (
      <div className="flex flex-wrap gap-1">
        {flags.includes('PRICE_VARIANCE') && priceVariancePct !== null && (
          <Badge color="warning">
            {t('invoices:review.match.flag.price', {
              defaultValue: 'Price {{pct}}%',
              pct: signed(priceVariancePct),
            })}
          </Badge>
        )}
        {flags.includes('QTY_VARIANCE') && quantityDelta !== null && (
          <Badge color="warning">
            {t('invoices:review.match.flag.qty', {
              defaultValue: 'Qty {{delta}}',
              delta: signed(quantityDelta),
            })}
          </Badge>
        )}
        {flags.includes('NOT_ON_PO') && (
          <Badge color="red">
            {t('invoices:review.match.flag.notOnPo', { defaultValue: 'Not on PO' })}
          </Badge>
        )}
      </div>
    );
  };

  const describe = (row: ComparisonRow): string =>
    row.poLine?.description ?? row.invoiceLine?.description ?? '—';

  /** Invoice figure emphasised when it disagrees with the PO figure beside it. */
  const invoiceCell = (value: string, varies: boolean) => (
    <span className={cn(varies && 'font-semibold text-warning')}>{value}</span>
  );

  const num = (value: number | null): string =>
    value === null ? '—' : String(Math.round(value * 100) / 100);

  const headerFields: Array<{ label: string; value: string }> = [
    {
      label: t('invoices:review.match.po.vendor', { defaultValue: 'Vendor' }),
      value: po.vendorName ?? '—',
    },
    {
      label: t('invoices:review.match.po.project', { defaultValue: 'Project' }),
      value: po.projectName ?? '—',
    },
    {
      label: t('invoices:review.match.po.total', { defaultValue: 'PO total' }),
      value: po.totalAmount === null ? '—' : formatCurrency(po.totalAmount, currency),
    },
    {
      label: t('invoices:review.match.po.plannedDelivery', { defaultValue: 'Planned delivery' }),
      value: delivery.plannedDeliveryDate ? formatDate(delivery.plannedDeliveryDate) : '—',
    },
  ];

  return (
    <section
      className="rounded-lg border border-border bg-card"
      data-testid="invoice-po-comparison"
      aria-label={t('invoices:review.match.po.sectionLabel', {
        defaultValue: 'Matched purchase order',
      })}
    >
      {/* ── PO header: number, lifecycle status, delivery status ───────────── */}
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            {t('invoices:review.match.po.heading', { defaultValue: 'Matched purchase order' })}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{po.poNumber}</span>
            {/* Badge renders a bare span, so the test hooks sit on wrappers. */}
            <span data-testid="invoice-po-comparison-status">
              <Badge className={getStatusColor(PO_STATUS_COLORS, po.status)}>
                {t(`purchaseOrders:status.${po.status}` as never, {
                  defaultValue: formatEnum(po.status),
                })}
              </Badge>
            </span>
            <span data-testid="invoice-po-comparison-delivery">
              <Badge className={DELIVERY_BADGE_COLORS[delivery.status]}>
                {deliveryStatusLabel}
              </Badge>
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="shrink-0 self-start whitespace-nowrap"
          rightIcon={
            <ChevronDownIcon
              className={cn('size-4 transition-transform', expanded && 'rotate-180')}
            />
          }
          data-testid="invoice-po-comparison-toggle"
        >
          {expanded
            ? t('invoices:review.match.po.hideLines', { defaultValue: 'Hide PO lines' })
            : t('invoices:review.match.po.showLines', { defaultValue: 'Show PO lines' })}
        </Button>
      </div>

      {/* ── PO facts + delivery progress ───────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
        {headerFields.map((field) => (
          <div key={field.label} className="min-w-0">
            <p className="text-xs text-muted-foreground">{field.label}</p>
            <p className="truncate text-sm text-foreground" title={field.value}>
              {field.value}
            </p>
          </div>
        ))}

        <div className="col-span-2 min-w-0 sm:col-span-3 lg:col-span-1">
          <p className="text-xs text-muted-foreground">
            {t('invoices:review.match.po.deliveryProgress', { defaultValue: 'Delivered' })}
          </p>
          <p className="text-sm text-foreground" data-testid="invoice-po-comparison-progress">
            {t('invoices:review.match.po.deliveredOf', {
              defaultValue: '{{delivered}} of {{ordered}} units ({{percent}}%)',
              delivered: delivery.quantityDelivered,
              ordered: delivery.quantityOrdered,
              percent: delivery.percentDelivered,
            })}
          </p>
          <div
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={delivery.percentDelivered}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={cn(
                'h-full rounded-full',
                delivery.status === 'DELIVERED' ? 'bg-success' : 'bg-primary',
              )}
              style={{ width: `${delivery.percentDelivered}%` }}
            />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border">
          {rows.length === 0 ? (
            <p
              className="p-4 text-sm text-muted-foreground"
              data-testid="invoice-po-comparison-empty"
            >
              {t('invoices:review.match.po.noLines', {
                defaultValue: 'This purchase order has no line items.',
              })}
            </p>
          ) : (
            <>
              {/* ── Desktop: PO columns beside invoice columns ────────────────
                  Held back to `xl`: below it the nine columns don't fit beside
                  the app sidebar, and a table scrolled sideways compares worse
                  than the stacked cards. */}
              <ScrollTable wrapperClassName="hidden xl:block">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-4 pt-3" />
                      <th
                        className="border-l border-border px-3 pt-3 font-semibold"
                        colSpan={4}
                        scope="colgroup"
                      >
                        {t('invoices:review.match.po.columnGroup', {
                          defaultValue: 'Purchase order',
                        })}
                      </th>
                      {hasInvoiceLines && (
                        <th
                          className="border-l border-border px-3 pt-3 font-semibold"
                          colSpan={3}
                          scope="colgroup"
                        >
                          {t('invoices:review.match.po.invoiceGroup', { defaultValue: 'Invoice' })}
                        </th>
                      )}
                      {hasInvoiceLines && <th className="border-l border-border px-3 pt-3" />}
                    </tr>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-4 pb-2 font-medium">
                        {t('invoices:review.line.description', { defaultValue: 'Description' })}
                      </th>
                      <th className="w-20 border-l border-border px-3 pb-2 font-medium">
                        {t('invoices:review.match.po.ordered', { defaultValue: 'Ordered' })}
                      </th>
                      <th className="w-20 px-3 pb-2 font-medium">
                        {t('invoices:review.match.po.delivered', { defaultValue: 'Delivered' })}
                      </th>
                      <th className="w-24 px-3 pb-2 font-medium">
                        {t('invoices:review.line.unitPrice', { defaultValue: 'Unit price' })}
                      </th>
                      <th className="w-24 px-3 pb-2 font-medium">
                        {t('invoices:review.line.lineTotal', { defaultValue: 'Line total' })}
                      </th>
                      {hasInvoiceLines && (
                        <>
                          <th className="w-20 border-l border-border px-3 pb-2 font-medium">
                            {t('invoices:review.line.quantity', { defaultValue: 'Qty' })}
                          </th>
                          <th className="w-24 px-3 pb-2 font-medium">
                            {t('invoices:review.line.unitPrice', { defaultValue: 'Unit price' })}
                          </th>
                          <th className="w-24 px-3 pb-2 font-medium">
                            {t('invoices:review.line.lineTotal', { defaultValue: 'Line total' })}
                          </th>
                        </>
                      )}
                      {hasInvoiceLines && (
                        <th className="w-32 border-l border-border px-3 pb-2 font-medium">
                          {t('invoices:review.line.poMatch', { defaultValue: 'PO match' })}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody data-testid="invoice-po-comparison-rows">
                    {rows.map((row) => {
                      const priceVaries = !!row.invoiceLine?.flags.includes('PRICE_VARIANCE');
                      const qtyVaries = !!row.invoiceLine?.flags.includes('QTY_VARIANCE');
                      return (
                        <tr key={row.key} className="border-b border-border last:border-b-0">
                          <td className="px-4 py-2 align-top">
                            <span className="text-foreground">{describe(row)}</span>
                            {row.poLine?.materialCode && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {row.poLine.materialCode}
                              </span>
                            )}
                          </td>
                          <td className="border-l border-border px-3 py-2 align-top">
                            {row.poLine
                              ? `${row.poLine.quantityOrdered} ${row.poLine.unitOfMeasure}`
                              : '—'}
                          </td>
                          <td className="px-3 py-2 align-top">
                            {row.poLine ? row.poLine.quantityDelivered : '—'}
                          </td>
                          <td className="px-3 py-2 align-top">
                            {row.poLine ? formatCurrency(row.poLine.unitPrice, currency) : '—'}
                          </td>
                          <td className="px-3 py-2 align-top">
                            {row.poLine ? formatCurrency(row.poLine.lineTotal, currency) : '—'}
                          </td>
                          {hasInvoiceLines && (
                            <>
                              <td className="border-l border-border px-3 py-2 align-top">
                                {row.invoiceLine
                                  ? invoiceCell(num(row.invoiceLine.quantity), qtyVaries)
                                  : '—'}
                              </td>
                              <td className="px-3 py-2 align-top">
                                {row.invoiceLine
                                  ? invoiceCell(
                                      formatCurrency(row.invoiceLine.unitPrice, currency),
                                      priceVaries,
                                    )
                                  : '—'}
                              </td>
                              <td className="px-3 py-2 align-top">
                                {row.invoiceLine
                                  ? formatCurrency(row.invoiceLine.lineTotal, currency)
                                  : '—'}
                              </td>
                            </>
                          )}
                          {hasInvoiceLines && (
                            <td className="border-l border-border px-3 py-2 align-top">
                              {rowStatus(row)}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollTable>

              {/* ── Narrow: one card per line, PO beside invoice ────────────── */}
              <ul
                className="divide-y divide-border xl:hidden"
                data-testid="invoice-po-comparison-cards"
              >
                {rows.map((row) => {
                  const priceVaries = !!row.invoiceLine?.flags.includes('PRICE_VARIANCE');
                  const qtyVaries = !!row.invoiceLine?.flags.includes('QTY_VARIANCE');
                  return (
                    <li key={row.key} className="space-y-2 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{describe(row)}</p>
                          {row.poLine?.materialCode && (
                            <p className="text-xs text-muted-foreground">
                              {row.poLine.materialCode}
                            </p>
                          )}
                        </div>
                        {hasInvoiceLines && rowStatus(row)}
                      </div>

                      {/* PO figure and invoice figure share a row, so the two are
                          read side by side on a phone exactly as on the table. */}
                      <div
                        className={cn(
                          'grid items-baseline gap-x-3 gap-y-1 text-xs',
                          hasInvoiceLines ? 'grid-cols-[5.5rem_1fr_1fr]' : 'grid-cols-[5.5rem_1fr]',
                        )}
                      >
                        <span />
                        <span className="font-medium text-muted-foreground">
                          {t('invoices:review.match.po.columnGroup', {
                            defaultValue: 'Purchase order',
                          })}
                        </span>
                        {hasInvoiceLines && (
                          <span className="font-medium text-muted-foreground">
                            {t('invoices:review.match.po.invoiceGroup', {
                              defaultValue: 'Invoice',
                            })}
                          </span>
                        )}

                        <span className="text-muted-foreground">
                          {t('invoices:review.line.quantity', { defaultValue: 'Qty' })}
                        </span>
                        <span className="text-foreground">
                          {row.poLine
                            ? `${row.poLine.quantityOrdered} ${row.poLine.unitOfMeasure}`
                            : '—'}
                        </span>
                        {hasInvoiceLines && (
                          <span className="text-foreground">
                            {row.invoiceLine
                              ? invoiceCell(num(row.invoiceLine.quantity), qtyVaries)
                              : '—'}
                          </span>
                        )}

                        <span className="text-muted-foreground">
                          {t('invoices:review.line.unitPrice', { defaultValue: 'Unit price' })}
                        </span>
                        <span className="text-foreground">
                          {row.poLine ? formatCurrency(row.poLine.unitPrice, currency) : '—'}
                        </span>
                        {hasInvoiceLines && (
                          <span className="text-foreground">
                            {row.invoiceLine
                              ? invoiceCell(
                                  formatCurrency(row.invoiceLine.unitPrice, currency),
                                  priceVaries,
                                )
                              : '—'}
                          </span>
                        )}

                        <span className="text-muted-foreground">
                          {t('invoices:review.line.lineTotal', { defaultValue: 'Line total' })}
                        </span>
                        <span className="text-foreground">
                          {row.poLine ? formatCurrency(row.poLine.lineTotal, currency) : '—'}
                        </span>
                        {hasInvoiceLines && (
                          <span className="text-foreground">
                            {row.invoiceLine
                              ? formatCurrency(row.invoiceLine.lineTotal, currency)
                              : '—'}
                          </span>
                        )}

                        <span className="text-muted-foreground">
                          {t('invoices:review.match.po.delivered', { defaultValue: 'Delivered' })}
                        </span>
                        <span className="text-foreground">
                          {row.poLine ? row.poLine.quantityDelivered : '—'}
                        </span>
                        {hasInvoiceLines && <span />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
