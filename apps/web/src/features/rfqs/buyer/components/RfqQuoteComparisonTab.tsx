import type { QuoteComparisonCell } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { useRfqQuoteComparison } from '@forethread/rfq-shared';
import { Spinner, cn, formatCurrency, formatDate } from '@forethread/ui-components';

interface RfqQuoteComparisonTabProps {
  rfqId: string;
}

/**
 * Contractor-facing quote comparison (FOR-208): every received quote laid out
 * side-by-side. Rows are RFQ line items, columns are vendors; each cell shows the
 * vendor's unit price and extended cost (qty × unit), the lowest extended cost
 * per row is highlighted, and the footer carries each vendor's column total
 * alongside their lead time and payment terms.
 */
export function RfqQuoteComparisonTab({ rfqId }: RfqQuoteComparisonTabProps) {
  const { t } = useTranslation('rfqs');
  const { data, isLoading, isError } = useRfqQuoteComparison(rfqId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return <p className="py-8 text-sm text-muted-foreground">{t('comparisonTab.loadError')}</p>;
  }

  if (!data || data.vendors.length === 0 || data.rows.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">{t('comparisonTab.noQuotes')}</p>;
  }

  const { currency, vendors, rows } = data;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-background border-b border-foreground/10 px-4 py-3 text-left align-bottom font-medium text-muted-foreground min-w-[200px]">
              {t('comparisonTab.lineItem')}
            </th>
            {vendors.map((v) => (
              <th
                key={v.quoteResponseId}
                className="border-b border-foreground/10 px-4 py-3 text-left align-bottom min-w-[160px]"
              >
                <div className="font-semibold text-foreground">{v.vendorName}</div>
                <div className="mt-1 text-xs font-normal text-muted-foreground">
                  {t('comparisonTab.coverage', {
                    covered: v.itemsCovered,
                    total: v.totalItems,
                  })}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.rfqLineItemId} className="group">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-background border-b border-foreground/10 px-4 py-3 text-left font-normal align-top min-w-[200px]"
              >
                <div className="font-medium text-foreground">
                  {row.materialName ?? t('comparisonTab.unnamedItem')}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t('comparisonTab.qtyUnit', { qty: row.quantity, unit: row.unit })}
                </div>
              </th>
              {row.cells.map((cell) => (
                <ComparisonCell
                  key={`${row.rfqLineItemId}-${cell.quoteResponseId}`}
                  cell={cell}
                  currency={currency}
                  noQuoteLabel={t('comparisonTab.noQuote')}
                  lowestLabel={t('comparisonTab.lowest')}
                />
              ))}
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr>
            <th
              scope="row"
              className="sticky left-0 z-10 bg-muted/40 px-4 py-3 text-left font-semibold text-foreground"
            >
              {t('comparisonTab.vendorTotal')}
            </th>
            {vendors.map((v) => (
              <td key={v.quoteResponseId} className="bg-muted/40 px-4 py-3 align-top">
                <div className="font-semibold text-foreground">
                  {formatCurrency(v.total, currency)}
                </div>
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  <div>
                    {t('comparisonTab.leadTime')}: {v.leadTimeDate ? formatDate(v.leadTimeDate) : '—'}
                  </div>
                  <div>
                    {t('comparisonTab.paymentTerms')}: {v.paymentTerms ?? '—'}
                  </div>
                </div>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ComparisonCell({
  cell,
  currency,
  noQuoteLabel,
  lowestLabel,
}: {
  cell: QuoteComparisonCell;
  currency: string;
  noQuoteLabel: string;
  lowestLabel: string;
}) {
  if (!cell.hasQuote) {
    return (
      <td className="border-b border-foreground/10 px-4 py-3 align-top text-muted-foreground">
        {noQuoteLabel}
      </td>
    );
  }

  return (
    <td
      className={cn(
        'border-b border-foreground/10 px-4 py-3 align-top',
        cell.isLowest && 'bg-success/10',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-semibold text-foreground">
          {formatCurrency(cell.extendedCost, currency)}
        </span>
        {cell.isLowest && (
          <span className="rounded-full bg-success/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
            {lowestLabel}
          </span>
        )}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {formatCurrency(cell.unitPrice, currency)} × {cell.quotedQuantity}
      </div>
    </td>
  );
}
