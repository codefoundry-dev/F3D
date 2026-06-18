import { useTranslation } from '@forethread/i18n';
import { SortIcon, Spinner } from '@forethread/ui-components';
import { useCallback, useMemo, useState } from 'react';

import { ActivePosRow } from './ActivePosRow';
import { TH_CLASS, TH_STATIC_CLASS } from './constants';
import type { ActivePosTableProps, SortableField } from './types';
import { useActivePosColumns } from './useActivePosColumns';

export function ActivePosTable({ items, isLoading }: ActivePosTableProps) {
  const { t } = useTranslation(['dashboard', 'purchaseOrders']);
  const columns = useActivePosColumns();
  const [sortBy, setSortBy] = useState<SortableField | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = useCallback(
    (field: SortableField) => {
      if (sortBy === field) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(field);
        setSortDir('asc');
      }
    },
    [sortBy],
  );

  const sortedItems = useMemo(() => {
    if (!sortBy) return items;
    return [...items].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (aVal === null || aVal === undefined || bVal === null || bVal === undefined) return 0;
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [items, sortBy, sortDir]);

  return (
    <div className="rounded-[14px] border border-black/20 bg-white overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-lg font-medium text-foreground">{t('vendor.activePOs.title')}</h2>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          {t('vendor.activePOs.noPOs')}
        </div>
      ) : (
        <div className="px-4 pb-4">
          <div className="rounded-lg border border-border overflow-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border text-left bg-[hsl(var(--table-header))] font-['Inter'] text-[hsl(var(--table-header-foreground))]">
                  {columns.map((col) => (
                    <th key={col.key} className={TH_CLASS} onClick={() => handleSort(col.field)}>
                      <span className="flex items-center justify-between gap-2">
                        {col.label}
                        <SortIcon
                          active={sortBy === col.field}
                          direction={sortBy === col.field ? sortDir : null}
                        />
                      </span>
                    </th>
                  ))}
                  <th
                    className={`${TH_STATIC_CLASS} text-left`}
                    style={{ width: 120, maxWidth: 120 }}
                  >
                    {t('dashboard:vendor.activePOs.actions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((row) => (
                  <ActivePosRow key={row.id} row={row} columns={columns} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
