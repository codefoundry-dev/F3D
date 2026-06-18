import type { RfqListItem } from '@forethread/api-client';
import { exportRfqs } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  useRfqs,
  useRfqSort,
  useRfqGrouping,
  useRfqExport,
  usePageTitleStore,
  VENDOR_QUICK_FILTERS,
  VENDOR_GROUP_OPTIONS,
  VENDOR_GROUP_FIELD_MAP,
  PAGE_SIZE_OPTIONS,
  VENDOR_RFQ_STATUS_KEYS,
  createRfqTableStore,
  RfqAdvancedFilters,
} from '@forethread/rfq-shared';
import {
  Badge,
  cn,
  CreateViewModal,
  DotActionsMenu,
  ExportDropdownButton,
  FilterChip,
  FilterPanel,
  getStatusColor,
  GroupByButton,
  MessageBadgeIcon,
  VENDOR_RFQ_STATUS_COLORS,
  SortIcon,
  Spinner,
  TableManagementModal,
  TablePagination,
  ToolbarIconButton,
  ToolbarSearchToggle,
  useColumnDragDrop,
  useDropdown,
  ViewSelectorDropdown,
} from '@forethread/ui-components';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';
import DragHandleIcon from '@forethread/ui-components/assets/icons/drag-and-drop.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import FloppyDiskIcon from '@forethread/ui-components/assets/icons/floppy-disk.svg?react';
import SettingsIcon from '@forethread/ui-components/assets/icons/settings.svg?react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { RfqDetailPanel } from '../components/RfqDetailPanel';
import { ALL_COLUMNS, DEFAULT_VISIBLE, TRUNCATE_COLUMNS, type SortableField } from '../constants';

/* ─── Store ───────────────────────────────────────────────────────────────── */

const useRfqTableStore = createRfqTableStore(DEFAULT_VISIBLE);

/* ─── Page component ──────────────────────────────────────────────────────── */

export default function RfqListPage() {
  const { t } = useTranslation(['rfqs', 'common']);
  const s = useRfqTableStore();
  const navigate = useNavigate();

  const activeView = s.savedViews.find((v) => v.id === s.activeViewId);

  /* Page header is owned by the app-shell header via the page-title store. */
  const setPageTitle = usePageTitleStore((st) => st.setTitle);
  useEffect(() => {
    setPageTitle(t('list.title'), t('list.subtitle'));
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  useEffect(() => {
    s.loadViews();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* refs */
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  /* preview panel anchor (Y offset of the clicked row, relative to container) */
  const [previewY, setPreviewY] = useState(0);

  /* dropdowns */
  const viewDD = useDropdown();
  const groupDD = useDropdown();
  const exportDD = useDropdown();

  /* ─── Custom hooks ──────────────────────────────────────────── */

  const { handleSort } = useRfqSort({
    sortBy: s.sortBy,
    sortDir: s.sortDir,
    setSortBy: s.setSortBy,
    setSortDir: s.setSortDir,
    setPage: s.setPage,
  });

  const { handleExport } = useRfqExport({
    search: s.search,
    quickFilter: s.quickFilter,
    sortBy: s.sortBy,
    sortDir: s.sortDir,
    visibleColumns: s.visibleColumns,
    columnOrder: s.columnOrder,
  });

  const { dragColKey, dragOverColKey, handleDragStart, handleDragOver, handleDrop, handleDragEnd } =
    useColumnDragDrop({ tableRef, setColumnOrder: s.setColumnOrder });

  /* ─── Data ──────────────────────────────────────────────────── */

  const af = s.advancedFilters;
  const { data, isLoading } = useRfqs({
    page: s.page,
    limit: s.pageSize,
    search: s.search || undefined,
    quickFilter: s.quickFilter || undefined,
    sortBy: s.sortBy || undefined,
    sortDir: s.sortBy && s.sortDir ? s.sortDir : undefined,
    groupBy: s.groupBy || undefined,
    projectId: af.projectId[0] || undefined,
    status: af.status.length === 1 ? af.status[0] : undefined,
    deliveryLocation: af.deliveryLocation[0] || undefined,
    createdByUserId: af.createdByUserId[0] || undefined,
    createdDateFrom: af.createdDateFrom || undefined,
    createdDateTo: af.createdDateTo || undefined,
    deadlineFrom: af.deadlineFrom || undefined,
    deadlineTo: af.deadlineTo || undefined,
    minApprovedQuotes: af.minApprovedQuotes ? Number(af.minApprovedQuotes) : undefined,
    minApprovedVendors: af.minApprovedVendors ? Number(af.minApprovedVendors) : undefined,
  });

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const totalCount = data?.meta.total ?? 0;

  /* Unfiltered query to populate filter dropdown options (stable regardless of active filters).
     limit is capped at 100 by the API (BasePaginationQueryDto). */
  const { data: allData } = useRfqs({ page: 1, limit: 100 });
  const allItems = useMemo(() => allData?.items ?? [], [allData?.items]);

  /* ─── Grouping ──────────────────────────────────────────────── */

  const { groupedItems, expandedGroups, toggleGroup } = useRfqGrouping(
    items,
    s.groupBy,
    VENDOR_GROUP_FIELD_MAP,
  );

  /* ─── Visible columns ──────────────────────────────────────── */

  const colByKey = new Map(ALL_COLUMNS.map((c) => [c.key, c]));
  const visibleCols = s.columnOrder
    .filter((key) => s.visibleColumns.includes(key))
    .map((key) => colByKey.get(key))
    .filter((c): c is (typeof ALL_COLUMNS)[number] => Boolean(c));

  /* ─── Cell renderer ─────────────────────────────────────────── */

  const renderCell = (rfq: RfqListItem, field: SortableField, key: string) => {
    if (key === 'rfqStatus') {
      return (
        <Badge className={getStatusColor(VENDOR_RFQ_STATUS_COLORS, rfq.status)}>
          {t(`status.${rfq.status}` as never)}
        </Badge>
      );
    }
    if (key === 'pickUp') {
      return (
        <Badge className="bg-muted text-muted-foreground">
          {rfq.pickUp ? t('common:yes') : t('common:no')}
        </Badge>
      );
    }
    if (key === 'createdDate') {
      return new Date(rfq.createdDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    // Res. Deadline — backend sends either null or a "YYYY-MM-DD - YYYY-MM-DD"
    // range. Design shows a friendly "MMM d, yyyy"; render each end formatted.
    if (key === 'resDeadline') {
      if (!rfq.deadlineRange) return '-';
      return rfq.deadlineRange
        .split(' - ')
        .map((d) => {
          const parsed = new Date(d);
          return isNaN(parsed.getTime())
            ? d
            : parsed.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
        })
        .filter((v, i, arr) => arr.indexOf(v) === i) // collapse identical start/end
        .join(' - ');
    }
    const val = rfq[field];
    // Count columns (lineItems / totalRequestedQty / recQuotes) — 0 is a real
    // value, so only treat null/undefined as missing.
    if (val === null || val === undefined) return '-';
    return String(val);
  };

  /* ─── Row renderer ──────────────────────────────────────────── */

  const renderRfqRow = (rfq: RfqListItem) => (
    <tr
      key={rfq.id}
      className="border-b border-border last:border-b-0 hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => navigate(`${ROUTES.rfqDetail.replace(':id', rfq.id)}?tab=details`)}
    >
      {visibleCols.map(({ field, key }) => (
        <td
          key={key}
          className={cn(
            'py-3 px-3 text-foreground',
            TRUNCATE_COLUMNS.includes(key) ? 'truncate max-w-[180px]' : 'whitespace-nowrap',
          )}
          style={
            dragColKey === key
              ? {
                  background: 'hsl(var(--accent))',
                  border: '0 solid hsl(var(--border))',
                }
              : undefined
          }
        >
          {renderCell(rfq, field, key)}
        </td>
      ))}
      <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <MessageBadgeIcon
            hasNotification
            className="w-8 h-8 flex items-center justify-center"
            onClick={() => navigate(`${ROUTES.rfqDetail.replace(':id', rfq.id)}?tab=responses`)}
          />
          <button
            type="button"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title={t('actions.view')}
            onClick={(e: React.MouseEvent) => {
              const containerRect = containerRef.current?.getBoundingClientRect();
              const btnRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const y = btnRect.top - (containerRect?.top ?? 0);
              setPreviewY(y);
              s.openPreview(rfq.id);
            }}
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <DotActionsMenu
            bordered={false}
            actions={[
              {
                key: 'downloadPdf',
                label: t('actions.downloadPdf'),
                onClick: () => {
                  void exportRfqs('pdf', {
                    search: rfq.id,
                  }).then(({ url }) => window.open(url, '_blank'));
                },
              },
            ]}
          />
        </div>
      </td>
    </tr>
  );

  /* ─── JSX ───────────────────────────────────────────────────────────────── */
  return (
    <div ref={containerRef} className="px-4 sm:px-8 pt-4 sm:pt-6 pb-6 sm:pb-8 relative">
      <div className="flex flex-col rounded-lg border border-border bg-background pb-4">
        {/* ═══ Toolbar Row 1 ═══ */}
        <div className="px-4 sm:px-8 pt-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
            {/* Right – View / Save / Export / Settings (vendors cannot create RFQs) */}
            <div className="flex items-center gap-3">
              <ViewSelectorDropdown
                activeView={activeView}
                savedViews={s.savedViews}
                onApplyView={s.applyView}
                defaultViewLabel={t('list.viewDefault')}
                defaultViewItemLabel={t('views.defaultView')}
                noSavedViewsHint={t('views.noSavedViews')}
                isOpen={viewDD.isOpen}
                onOpenChange={viewDD.setIsOpen}
                dropdownRef={viewDD.ref}
              />

              <ToolbarIconButton title={t('list.save')} onClick={() => s.setShowCreateView(true)}>
                <FloppyDiskIcon className="w-6 h-6" />
              </ToolbarIconButton>

              <ExportDropdownButton
                title="Export"
                formats={[
                  { key: 'csv', label: t('list.exportCsv') },
                  { key: 'xlsx', label: t('list.exportXlsx') },
                ]}
                onExport={(fmt) => handleExport(fmt as 'csv' | 'xlsx')}
                isOpen={exportDD.isOpen}
                onOpenChange={exportDD.setIsOpen}
                dropdownRef={exportDD.ref}
              />

              <ToolbarIconButton
                title={t('list.settings')}
                onClick={() => s.setShowTableMgmt(true)}
              >
                <SettingsIcon className="w-6 h-6" />
              </ToolbarIconButton>
            </div>
          </div>
        </div>

        {/* divider */}
        <div className="mt-4 px-8">
          <div className="border-b border-border" />
        </div>

        {/* ═══ Toolbar Row 2 ═══ */}
        <div className="px-8 pt-2 pb-4">
          <div className="flex items-center justify-between gap-4 max-[899px]:flex-col max-[899px]:items-start max-[899px]:gap-3 py-1">
            {/* Left – Quick Filters */}
            <div className="flex items-center gap-3 min-w-0 flex-wrap">
              <span className="text-sm text-foreground whitespace-nowrap">
                {t('list.quickFiltersLabel')}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {VENDOR_QUICK_FILTERS.map((key) => (
                  <FilterChip
                    key={key}
                    label={t(`quickFilters.${key}`)}
                    active={s.quickFilter === key}
                    onClick={() => s.setQuickFilter(s.quickFilter === key ? '' : key)}
                  />
                ))}
              </div>
            </div>

            {/* Right – Group / Filters / Search */}
            <div className="flex items-center gap-2 shrink-0">
              <GroupByButton
                groupBy={s.groupBy}
                onGroupByChange={s.setGroupBy}
                options={VENDOR_GROUP_OPTIONS}
                getOptionLabel={(opt) => t(`list.${opt}` as never)}
                label={t('list.group')}
                isOpen={groupDD.isOpen}
                onOpenChange={groupDD.setIsOpen}
                dropdownRef={groupDD.ref}
              />

              <FilterPanel
                label={t('list.filters')}
                title={t('advancedFilters.title')}
                open={s.filtersOpen}
                onOpenChange={s.setFiltersOpen}
                onClearAll={() => s.clearAdvancedFilters()}
                clearAllLabel={t('advancedFilters.clearAll')}
                fullWidth
              >
                <RfqAdvancedFilters
                  advancedFilters={s.advancedFilters}
                  setAdvancedFilters={s.setAdvancedFilters}
                  items={allItems}
                  statusKeys={VENDOR_RFQ_STATUS_KEYS}
                />
              </FilterPanel>

              <ToolbarSearchToggle
                search={s.search}
                onSearchChange={s.setSearch}
                searchOpen={s.searchOpen}
                onSearchOpenChange={s.setSearchOpen}
                placeholder={t('list.searchPlaceholder')}
              />
            </div>
          </div>
        </div>

        {/* ═══ Table ═══ */}
        <div className="px-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="md" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">{t('list.noRfqsFound')}</div>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <table ref={tableRef} className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left bg-[hsl(var(--table-header))] font-['Inter'] text-[hsl(var(--table-header-foreground))]">
                    {visibleCols.map(({ field, key }) => {
                      const isDropTarget = dragOverColKey === key && dragColKey !== key;
                      return (
                        <th
                          key={key}
                          draggable
                          onDragStart={(e) => handleDragStart(e, key)}
                          onDragOver={(e) => handleDragOver(e, key)}
                          onDrop={(e) => handleDrop(e, key)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            'py-3 px-3 text-xs font-bold leading-4 tracking-[0.6px] whitespace-nowrap cursor-pointer select-none',
                            isDropTarget && 'border-l-2 border-l-primary',
                          )}
                          style={
                            dragColKey === key
                              ? {
                                  background: 'hsl(var(--accent))',
                                }
                              : undefined
                          }
                          onClick={() => handleSort(field)}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5">
                              <DragHandleIcon className="w-[6px] h-[10px] shrink-0 text-[hsl(var(--sort-icon))] cursor-grab" />
                              {t(`columns.${key}` as never)}
                            </span>
                            <SortIcon
                              active={s.sortBy === field}
                              direction={s.sortBy === field ? s.sortDir : null}
                            />
                          </span>
                        </th>
                      );
                    })}
                    <th className="py-3 px-3 text-xs font-bold leading-4 tracking-[0.6px] whitespace-nowrap">
                      {t('columns.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groupedItems
                    ? Array.from(groupedItems.entries()).map(([groupKey, groupItems]) => {
                        const isExpanded = expandedGroups.has(groupKey);
                        return (
                          <GroupSection
                            key={groupKey}
                            groupKey={groupKey}
                            isExpanded={isExpanded}
                            onToggle={toggleGroup}
                            colSpan={visibleCols.length + 1}
                          >
                            {groupItems.map((rfq) => renderRfqRow(rfq))}
                          </GroupSection>
                        );
                      })
                    : items.map((rfq) => renderRfqRow(rfq))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {totalCount >= 25 && (
          <div className="px-8">
            <TablePagination
              page={s.page}
              totalItems={totalCount}
              pageSize={s.pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageChange={s.setPage}
              onPageSizeChange={s.setPageSize}
              rowsPerPageLabel={t('list.rowsPerPage')}
              showingLabel={({ from, to, total }) => t('list.showing', { from, to, total })}
              backLabel={t('pagination.back')}
              nextLabel={t('pagination.next')}
            />
          </div>
        )}

        {/* ═══ Modals ═══ */}
        {s.showTableMgmt && (
          <TableManagementModal
            columns={ALL_COLUMNS.map((c) => ({
              id: c.key,
              // Modal uses the descriptive long-form labels from the design
              // (columnLabels.*), not the short table headers (columns.*).
              label: t(`columnLabels.${c.key}` as never),
            }))}
            visibleColumns={s.visibleColumns}
            onSave={(cols) => {
              s.setVisibleColumns(cols);
              s.setShowTableMgmt(false);
            }}
            onClose={() => s.setShowTableMgmt(false)}
            savedViews={s.savedViews}
            onDeleteView={s.deleteSavedView}
            onDeleteAllViews={s.deleteAllSavedViews}
            title={t('tableManagement.title')}
            subtitle={t('tableManagement.subtitle')}
            configureLabel={t('tableManagement.configureColumns')}
            deselectAllLabel={t('tableManagement.deselectAll')}
            selectAllLabel={t('tableManagement.selectAll')}
            savedViewsLabel={t('tableManagement.savedViews')}
            deleteAllLabel={t('tableManagement.deleteAll')}
            saveLabel={t('tableManagement.save')}
            cancelLabel={t('tableManagement.cancel')}
          />
        )}

        {s.showCreateView && (
          <CreateViewModal
            onClose={() => s.setShowCreateView(false)}
            onCreate={s.addSavedView}
            title={t('createView.title')}
            subtitle={t('createView.subtitle')}
            viewNameLabel={t('createView.viewNameLabel')}
            viewNamePlaceholder={t('createView.viewNamePlaceholder')}
            createLabel={t('createView.create')}
            cancelLabel={t('createView.cancel')}
          />
        )}
      </div>

      {/* ═══ Preview Panel (absolute, anchored to the clicked row) ═══ */}
      {s.previewOpen && s.previewRfqId && (
        <div className="absolute right-8 z-30" style={{ top: previewY }}>
          <RfqDetailPanel rfqId={s.previewRfqId} onClose={s.closePreview} />
        </div>
      )}
    </div>
  );
}

/* ─── Group Section ──────────────────────────────────────────────────────── */

function GroupSection({
  groupKey,
  isExpanded,
  onToggle,
  colSpan,
  children,
}: {
  groupKey: string;
  isExpanded: boolean;
  onToggle: (key: string) => void;
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr
        className="border-b border-border last:border-b-0 bg-muted/50 cursor-pointer hover:bg-muted transition-colors select-none"
        onClick={() => onToggle(groupKey)}
      >
        <td colSpan={colSpan} className="py-3 px-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ChevronDownIcon
              className={cn('w-4 h-4 transition-transform', !isExpanded && '-rotate-90')}
            />
            {groupKey}
          </div>
        </td>
      </tr>
      {isExpanded && children}
    </>
  );
}
