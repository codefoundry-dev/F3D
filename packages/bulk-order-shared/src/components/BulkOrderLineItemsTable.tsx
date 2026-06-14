import type { BulkOrderLineItemDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { formatCurrency, MessageBadgeIcon } from '@forethread/ui-components';

export interface BulkOrderLineItemsTableProps {
  lineItems: BulkOrderLineItemDetail[];
  /** Map of lineItemId → whether it has unread messages. TODO: wire when messaging backend is ready */
  notifications?: Record<string, boolean>;
  onMessageClick?: (lineItemId: string) => void;
}

export function BulkOrderLineItemsTable({
  lineItems,
  notifications,
  onMessageClick,
}: BulkOrderLineItemsTableProps) {
  const { t } = useTranslation('bulkOrders');

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-foreground">{t('detail.lineItemsTitle')}</h2>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="bg-foreground/5">
              {LINE_ITEM_COLUMNS.map(({ key }) => (
                <th
                  key={key}
                  className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border last:border-r-0"
                >
                  {t(`detail.${key}` as never) as string}
                </th>
              ))}
              <th className="p-3 text-center text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))]">
                {t('columns.actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item) => (
              <tr key={item.lineItemId} className="border-t border-border">
                <td className="p-3 text-foreground border border-border">{item.lineItemId}</td>
                <td className="p-3 text-foreground border border-border">{item.itemReference}</td>
                <td className="p-3 text-foreground border border-border truncate max-w-[200px]">
                  {item.description}
                </td>
                <td className="p-3 text-foreground border border-border">{item.unit}</td>
                <td className="p-3 text-foreground border border-border">{item.qty}</td>
                <td className="p-3 text-foreground border border-border">{item.qtyRemaining}</td>
                <td className="p-3 text-foreground border border-border">
                  {item.consumptionPercent ?? 0}%
                </td>
                <td className="p-3 text-foreground border border-border">
                  {formatCurrency(item.pricePerUnit)}
                </td>
                <td className="p-3 text-foreground border border-border">
                  {formatCurrency(item.totalLineInc)}
                </td>
                <td className="p-3 border border-border">
                  <div className="flex items-center justify-center">
                    <MessageBadgeIcon
                      hasNotification={notifications?.[item.lineItemId] ?? false}
                      onClick={() => onMessageClick?.(item.lineItemId)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/50">
              <td colSpan={LINE_ITEM_COLUMNS.length + 1} className="px-6 py-3">
                <span className="text-sm text-muted-foreground">
                  {t('detail.totalItems')}:{' '}
                  <span className="text-foreground">{lineItems.length}</span>
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

const LINE_ITEM_COLUMNS = [
  { key: 'lineItemId' },
  { key: 'itemReference' },
  { key: 'description' },
  { key: 'unit' },
  { key: 'qty' },
  { key: 'qtyRemaining' },
  { key: 'deliveriesPercent' },
  { key: 'pricePerUnit' },
  { key: 'totalLineInc' },
] as const;
