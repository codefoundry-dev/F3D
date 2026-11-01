import type { BomListItemDto } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Button, Input, Spinner, TablePagination, ScrollTable } from '@forethread/ui-components';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';
import SearchIcon from '@forethread/ui-components/assets/icons/search.svg?react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { useBom, useProjectBoms } from '../hooks/useBoms';

import { BomItemsTable } from './BomItemsTable';

type TFn = (key: string, options?: Record<string, unknown>) => string;

const DATE_FORMAT: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', DATE_FORMAT);
}

/**
 * The line items of one BOM, fetched on demand and rendered as a material
 * list. `search` narrows the rows by material name, catalogue match,
 * description or category.
 */
function BomItems({ bomId, search = '', t }: { bomId: string; search?: string; t: TFn }) {
  const { data: bom, isLoading, isError } = useBom(bomId);

  const items = useMemo(() => {
    const all = bom?.items ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter((item) =>
      [item.materialName, item.matchedMaterialName, item.description, item.category].some((value) =>
        value?.toLowerCase().includes(term),
      ),
    );
  }, [bom, search]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (isError || !bom) {
    return <p className="text-sm text-destructive py-6 text-center">{t('tab.itemsLoadFailed')}</p>;
  }

  if (bom.items.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{t('tab.noItems')}</p>;
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">{t('tab.noMatchingItems')}</p>
    );
  }

  return <BomItemsTable items={items} />;
}

function HistoricalBomTable({
  boms,
  emptyText,
  t,
}: {
  boms: BomListItemDto[];
  emptyText: string;
  t: TFn;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());

  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
      <ScrollTable className="border border-border rounded-lg">
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
            {pageItems.map((bom) => {
              const expanded = expandedIds.has(bom.id);
              return [
                <tr
                  key={bom.id}
                  className="border-t border-border"
                  data-testid={`bom-row-${bom.id}`}
                >
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
                      onClick={() => toggleExpanded(bom.id)}
                      aria-label={expanded ? t('tab.hideItems') : t('tab.showItems')}
                      title={expanded ? t('tab.hideItems') : t('tab.showItems')}
                      aria-expanded={expanded}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      data-testid={`bom-toggle-${bom.id}`}
                    >
                      <ChevronDownIcon
                        className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </td>
                </tr>,
                expanded && (
                  <tr key={`${bom.id}-items`} data-testid={`bom-items-row-${bom.id}`}>
                    <td colSpan={7} className="px-3 pb-3 bg-muted/30">
                      <BomItems bomId={bom.id} t={t} />
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </ScrollTable>

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
 * "Bill of Materials" tab of the project details view (US 5.01 / 5.02,
 * FOR-345): the active BOM's materials are embedded directly as a list, with
 * the Create-new entry point into the upload wizard and an Edit action into
 * the editor. Historical versions stay summarised as rows whose materials
 * expand in place.
 */
export function BomTab({ projectId }: { projectId: string }) {
  const { t: tRaw } = useTranslation('boms');
  const t = tRaw as TFn;
  const navigate = useNavigate();
  const { data: boms, isLoading, isError } = useProjectBoms(projectId);
  const [search, setSearch] = useState('');

  const activeBom = useMemo(() => (boms ?? []).find((b) => b.status === 'ACTIVE'), [boms]);
  const historical = useMemo(() => (boms ?? []).filter((b) => b.status !== 'ACTIVE'), [boms]);

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
      {/* Active project BOM — its materials rendered directly */}
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
            {activeBom && (
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    ROUTES.projectBomEdit.replace(':id', projectId).replace(':bomId', activeBom.id),
                  )
                }
                data-testid="bom-edit-active"
              >
                {t('tab.editBom')}
              </Button>
            )}
            <Button onClick={() => navigate(ROUTES.projectBomCreate.replace(':id', projectId))}>
              {t('tab.createNew')}
            </Button>
          </div>

          {activeBom ? (
            <>
              <p className="text-sm" data-testid="active-bom-meta">
                <span className="font-bold text-foreground">{activeBom.bomNumber}</span>
                <span className="text-muted-foreground">
                  {' · '}
                  {t('tab.metaMatched', {
                    matched: activeBom.matchedCount,
                    total: activeBom.itemCount,
                  })}
                  {' · '}
                  {t('tab.metaCreatedBy', { name: activeBom.createdBy.name })}
                  {' · '}
                  {t('tab.metaUpdated', { date: formatDate(activeBom.updatedAt) })}
                </span>
              </p>
              <BomItems bomId={activeBom.id} search={search} t={t} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">{t('tab.emptyActive')}</p>
          )}
        </div>
      </section>

      {/* Historical BOM versions */}
      <section className="bg-card rounded-lg border border-border p-4">
        <h2 className="text-base font-bold text-foreground mb-4">{t('tab.historicalTitle')}</h2>
        <HistoricalBomTable boms={historical} emptyText={t('tab.emptyHistorical')} t={t} />
      </section>
    </div>
  );
}
