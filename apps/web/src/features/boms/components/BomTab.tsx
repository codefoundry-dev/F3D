import type { BomListItemDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Button, Input, Spinner, TablePagination } from '@forethread/ui-components';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import SearchIcon from '@forethread/ui-components/assets/icons/search.svg?react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { useProjectBoms } from '../hooks/useBoms';

import { BomItemsModal } from './BomItemsModal';

type TFn = (key: string, options?: Record<string, unknown>) => string;

const DATE_FORMAT: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', DATE_FORMAT);
}

function BomTable({
  boms,
  emptyText,
  onView,
  t,
}: {
  boms: BomListItemDto[];
  emptyText: string;
  onView: (id: string) => void;
  t: TFn;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const pageItems = useMemo(
    () => boms.slice((page - 1) * pageSize, page * pageSize),
    [boms, page, pageSize],
  );

  if (boms.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{emptyText}</p>;
  }

  const th = 'px-3 py-3 text-left text-xs font-bold leading-4 tracking-[0.6px] whitespace-nowrap';
  const td = 'px-3 py-3 text-sm text-foreground';

  return (
    <div>
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full min-w-[760px] text-sm" data-testid="bom-table">
          <thead>
            <tr className="bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))]">
              <th className={th}>{t('tab.columns.bomId')}</th>
              <th className={th}>{t('tab.columns.items')}</th>
              <th className={th}>{t('tab.columns.matched')}</th>
              <th className={th}>{t('tab.columns.createdBy')}</th>
              <th className={th}>{t('tab.columns.createdDate')}</th>
              <th className={th}>{t('tab.columns.updatedDate')}</th>
              <th className={th}>{t('tab.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((bom) => (
              <tr key={bom.id} className="border-t border-border" data-testid={`bom-row-${bom.id}`}>
                <td className={td}>{bom.bomNumber}</td>
                <td className={td}>{bom.itemCount}</td>
                <td className={td}>
                  {bom.matchedCount}/{bom.itemCount}
                </td>
                <td className={td}>{bom.createdBy.name}</td>
                <td className={td}>{formatDate(bom.createdAt)}</td>
                <td className={td}>{formatDate(bom.updatedAt)}</td>
                <td className={td}>
                  <button
                    type="button"
                    onClick={() => onView(bom.id)}
                    aria-label={t('tab.viewBom')}
                    title={t('tab.viewBom')}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <EyeIcon className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        totalItems={boms.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        rowsPerPageLabel={t('tab.rowsPerPage')}
        showingLabel={({ from, to, total }) => t('tab.showing', { from, to, total })}
        backLabel={t('tab.back')}
        nextLabel={t('tab.next')}
        className="mt-2"
      />
    </div>
  );
}

/**
 * "Bill of Materials" tab of the project details view (US 5.01): the active
 * project BOM plus superseded versions, with the Create-new entry point into
 * the BOM upload wizard.
 */
export function BomTab({ projectId }: { projectId: string }) {
  const { t: tRaw } = useTranslation('boms');
  const t = tRaw as TFn;
  const navigate = useNavigate();
  const { data: boms, isLoading, isError } = useProjectBoms(projectId);
  const [search, setSearch] = useState('');
  const [viewBomId, setViewBomId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const all = boms ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (bom) =>
        bom.bomNumber.toLowerCase().includes(term) ||
        bom.createdBy.name.toLowerCase().includes(term),
    );
  }, [boms, search]);

  const active = useMemo(() => filtered.filter((b) => b.status === 'ACTIVE'), [filtered]);
  const historical = useMemo(() => filtered.filter((b) => b.status !== 'ACTIVE'), [filtered]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-destructive py-6 text-center">{t('tab.loadFailed')}</p>;
  }

  return (
    <div className="space-y-6" data-testid="bom-tab">
      {/* Active project BOM */}
      <section className="bg-card rounded-lg border border-border p-4">
        <h2 className="text-base font-bold text-foreground mb-4">{t('tab.activeTitle')}</h2>
        <div className="rounded-lg border border-border p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('tab.searchPlaceholder')}
                className="pl-9"
                data-testid="bom-search"
              />
            </div>
            <Button onClick={() => navigate(ROUTES.projectBomCreate.replace(':id', projectId))}>
              {t('tab.createNew')}
            </Button>
          </div>

          <BomTable boms={active} emptyText={t('tab.emptyActive')} onView={setViewBomId} t={t} />
        </div>
      </section>

      {/* Historical BOM versions */}
      <section className="bg-card rounded-lg border border-border p-4">
        <h2 className="text-base font-bold text-foreground mb-4">{t('tab.historicalTitle')}</h2>
        <BomTable
          boms={historical}
          emptyText={t('tab.emptyHistorical')}
          onView={setViewBomId}
          t={t}
        />
      </section>

      {viewBomId && <BomItemsModal bomId={viewBomId} onClose={() => setViewBomId(null)} />}
    </div>
  );
}
