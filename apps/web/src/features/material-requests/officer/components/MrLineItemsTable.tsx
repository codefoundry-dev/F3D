import type { MrLineItemDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { formatDate } from '@forethread/ui-components';

interface MrLineItemsTableProps {
  lineItems: MrLineItemDetail[];
}

const DASH = '—';

/**
 * Detail line-items table (US 2.08), columns sourced from Figma node 5914:85044:
 * Line Item ID / Material name / Description / Qty ordered / UoM /
 * Exp. delivery date / Delivery location / Notes.
 */
export function MrLineItemsTable({ lineItems }: MrLineItemsTableProps) {
  const { t } = useTranslation('materialRequests');

  if (lineItems.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{t('detail.noLineItems')}</p>
    );
  }

  const columnKeys = {
    lineId: 'detail.columns.lineId',
    materialName: 'detail.columns.materialName',
    description: 'detail.columns.description',
    quantity: 'detail.columns.quantity',
    unit: 'detail.columns.unit',
    expectedDelivery: 'detail.columns.expectedDelivery',
    deliveryLocation: 'detail.columns.deliveryLocation',
    notes: 'detail.columns.notes',
  } as const;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm" data-testid="mr-line-items">
        <thead>
          <tr className="border-b border-border bg-[hsl(var(--table-header))] text-left text-[hsl(var(--table-header-foreground))]">
            {Object.values(columnKeys).map((key) => (
              <th
                key={key}
                className="whitespace-nowrap px-3 py-3 text-xs font-bold leading-4 tracking-[0.6px]"
              >
                {t(key as never)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lineItems.map((li) => (
            <tr key={li.id} className="border-b border-border last:border-b-0 text-foreground">
              <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                {li.id.slice(0, 8)}
              </td>
              <td className="px-3 py-3">{li.materialName ?? DASH}</td>
              <td className="max-w-[220px] truncate px-3 py-3 text-muted-foreground">
                {li.description ?? DASH}
              </td>
              <td className="px-3 py-3">{li.quantity}</td>
              <td className="px-3 py-3">{li.unit}</td>
              <td className="whitespace-nowrap px-3 py-3">
                {li.expectedDeliveryDate ? formatDate(li.expectedDeliveryDate) : DASH}
              </td>
              <td className="px-3 py-3">{li.deliveryLocation ?? DASH}</td>
              <td className="max-w-[220px] truncate px-3 py-3 text-muted-foreground">
                {li.notes ?? DASH}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
