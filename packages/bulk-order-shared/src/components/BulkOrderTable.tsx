import type { BulkOrderListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Badge,
  BULK_ORDER_STATUS_COLORS,
  DotActionsMenu,
  formatCurrency,
  formatDate,
  formatStatus,
  getStatusColor,
  SortIcon,
  Spinner,
} from '@forethread/ui-components';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';

import { COLUMNS } from '../constants';

export interface BulkOrderTableProps {
  items: BulkOrderListItem[];
  isLoading: boolean;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void;
  onRowClick: (id: string) => void;
  onView: (id: string) => void;
  onDrawdown?: (id: string) => void;
  onChange?: (id: string) => void;
  /** Override the i18n key for the counterparty column */
  counterpartyColumnKey?: string;
  emptyMessage?: string;
}

export function BulkOrderTable({
  items,
  isLoading,
  sortBy,
  sortDir,
  onSort,
  onRowClick,
  onView,
  onDrawdown,
  onChange,
  counterpartyColumnKey,
  emptyMessage,
}: BulkOrderTableProps) {
  const { t } = useTranslation('bulkOrders');

  const getColumnLabel = (key: string) => {
    if (key === 'vendorName' && counterpartyColumnKey) {
      return t(`columns.${counterpartyColumnKey}` as never) as string;
    }
    return t(`columns.${key}` as never) as string;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="md" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        {emptyMessage ?? t('list.noBulkOrdersFound')}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <table className="w-full min-w-[800px] text-sm">
        <thead>
          <tr className="border-b border-border text-left bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))]">
            {COLUMNS.map(({ field, key }) => (
              <th
                key={key}
                className="py-3 px-3 text-xs font-bold leading-4 tracking-[0.6px] whitespace-nowrap cursor-pointer select-none"
                onClick={() => onSort(field)}
              >
                <span className="flex items-center justify-between gap-2">
                  {getColumnLabel(key)}
                  <SortIcon
                    active={sortBy === field}
                    direction={sortBy === field ? sortDir : null}
                  />
                </span>
              </th>
            ))}
            <th className="py-3 px-3 text-xs font-bold leading-4 tracking-[0.6px] whitespace-nowrap">
              {t('columns.actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((bo) => (
            <tr
              key={bo.id}
              className="border-b border-border last:border-b-0 hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => onRowClick(bo.id)}
            >
              <td className="py-3 px-3 text-foreground">{bo.bulkOrderNumber ?? bo.id}</td>
              <td className="py-3 px-3 text-foreground truncate max-w-[180px]">{bo.projectName}</td>
              <td className="py-3 px-3 text-foreground">{bo.projectCode}</td>
              <td className="py-3 px-3 text-foreground truncate max-w-[150px]">{bo.vendorName}</td>
              <td className="py-3 px-3">
                <Badge className={getStatusColor(BULK_ORDER_STATUS_COLORS, bo.status)}>
                  {formatStatus(bo.status)}
                </Badge>
              </td>
              <td className="py-3 px-3 text-foreground">{bo.lineItems}</td>
              <td className="py-3 px-3 text-foreground">{bo.consumptionPercent ?? 0}%</td>
              <td className="py-3 px-3 text-foreground">{formatCurrency(bo.totalAmount)}</td>
              <td className="py-3 px-3 text-foreground">{formatDate(bo.validUntil)}</td>
              <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => onView(bo.id)}
                  >
                    <EyeIcon className="w-4 h-4" />
                  </button>
                  <DotActionsMenu
                    bordered={false}
                    actions={[
                      ...(onDrawdown
                        ? [
                            {
                              key: 'drawdown',
                              label: t('actions.drawdown'),
                              onClick: () => onDrawdown(bo.id),
                            },
                          ]
                        : []),
                      ...(onChange
                        ? [
                            {
                              key: 'change',
                              label: t('actions.change'),
                              onClick: () => onChange(bo.id),
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
