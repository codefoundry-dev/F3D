import type { DrawdownHistoryItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { DataTable, type ColumnDef, formatDate } from '@forethread/ui-components';
import { useState, useMemo } from 'react';

export interface DrawdownHistoryTabProps {
  drawdowns: DrawdownHistoryItem[];
  isLoading: boolean;
}

type SortDir = 'asc' | 'desc';

export function DrawdownHistoryTab({ drawdowns, isLoading }: DrawdownHistoryTabProps) {
  const { t: _t } = useTranslation('bulkOrders');
  const t = _t as (key: string, opts?: Record<string, unknown>) => string;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const columns: ColumnDef<DrawdownHistoryItem>[] = useMemo(
    () => [
      {
        id: 'date',
        header: t('drawdownHistory.columns.date'),
        accessor: (row) => formatDate(row.date),
        sortable: true,
      },
      {
        id: 'poNumber',
        header: t('drawdownHistory.columns.poNumber'),
        accessor: (row) => row.poNumber ?? '-',
        sortable: true,
      },
      {
        id: 'material',
        header: t('drawdownHistory.columns.material'),
        accessor: (row) => row.material ?? '-',
        sortable: true,
      },
      {
        id: 'qtyBeforeDrawdown',
        header: t('drawdownHistory.columns.qtyBefore'),
        accessor: (row) => (row.qtyBeforeDrawdown != null ? String(row.qtyBeforeDrawdown) : '-'),
        sortable: true,
      },
      {
        id: 'quantity',
        header: t('drawdownHistory.columns.drawnQty'),
        accessor: (row) => String(row.quantity),
        sortable: true,
      },
      {
        id: 'remainingQty',
        header: t('drawdownHistory.columns.remainingQty'),
        accessor: (row) => (row.remainingQty != null ? String(row.remainingQty) : '-'),
        sortable: true,
      },
    ],
    [t],
  );

  const sorted = useMemo(() => {
    const copy = [...drawdowns];
    copy.sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;
      switch (sortBy) {
        case 'date':
          aVal = a.date;
          bVal = b.date;
          break;
        case 'poNumber':
          aVal = a.poNumber ?? '';
          bVal = b.poNumber ?? '';
          break;
        case 'material':
          aVal = a.material ?? '';
          bVal = b.material ?? '';
          break;
        case 'qtyBeforeDrawdown':
          aVal = a.qtyBeforeDrawdown ?? 0;
          bVal = b.qtyBeforeDrawdown ?? 0;
          break;
        case 'quantity':
          aVal = a.quantity;
          bVal = b.quantity;
          break;
        case 'remainingQty':
          aVal = a.remainingQty ?? 0;
          bVal = b.remainingQty ?? 0;
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [drawdowns, sortBy, sortDir]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const handleSort = (columnId: string) => {
    if (sortBy === columnId) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(columnId);
      setSortDir('asc');
    }
    setPage(1);
  };

  return (
    <div>
      <h2 className="text-base font-bold text-foreground mb-4">{t('drawdownHistory.title')}</h2>

      <DataTable<DrawdownHistoryItem>
        columns={columns}
        data={paged}
        page={page}
        pageSize={pageSize}
        totalCount={drawdowns.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        loading={isLoading}
        emptyMessage={t('drawdownHistory.noDrawdowns')}
        getRowId={(row) => row.id}
      />
    </div>
  );
}
