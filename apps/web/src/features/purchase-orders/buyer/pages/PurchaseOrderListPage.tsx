import type { PoListItem, RfqListItem, BulkOrderListItem } from '@forethread/api-client';
import {
  archivePurchaseOrder,
  copyPurchaseOrder,
  exportPurchaseOrders,
  getRfq,
  getBulkOrder,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  PO_CA_COLUMNS,
  PO_CA_QUICK_FILTERS,
  PO_STATUS_KEYS,
  PO_TYPE_KEYS,
  GROUP_OPTIONS,
  GROUP_FIELD_MAP,
  PAGE_SIZE_OPTIONS,
  TRUNCATE_COLUMNS,
  usePurchaseOrders,
  usePoExport,
  usePoGrouping,
  createPoTableStore,
  PoAdvancedFilters,
  CopyPoModal,
  SelectRfqModal,
  SelectBulkOrderModal,
  rfqToFormDefaults,
  bulkOrderToFormDefaults,
  filterPoItems,
} from '@forethread/po-shared';
import type { ColumnDef } from '@forethread/po-shared';
import {
  Badge,
  Button,
  cn,
  CreateViewModal,
  DotActionsMenu,
  ExportDropdownButton,
  MessageBadgeIcon,
  FilterChip,
  FilterPanel,
  getStatusColor,
  GroupByButton,
  PO_STATUS_COLORS,
  SortIcon,
  Spinner,
  TableManagementModal,
  TablePagination,
  ToolbarIconButton,
  ToolbarSearchToggle,
  useColumnDragDrop,
  useColumnResize,
  useDropdown,
  ViewSelectorDropdown,
} from '@forethread/ui-components';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';
import DragHandleIcon from '@forethread/ui-components/assets/icons/drag-and-drop.svg?react';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import FloppyDiskIcon from '@forethread/ui-components/assets/icons/floppy-disk.svg?react';
import PaperclipIcon from '@forethread/ui-components/assets/icons/paperclip.svg?react';
import SettingsIcon from '@forethread/ui-components/assets/icons/settings.svg?react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { PoDetailPanel } from '../components/PoDetailPanel';
import { buyerPoStatusKey } from '../status-label';

/* ─── Constants ────────────────────────────────────────────────────────────── */

type SortableField = keyof PoListItem;

const ALL_COLUMNS = PO_CA_COLUMNS;
const DEFAULT_VISIBLE = ALL_COLUMNS.map((c) => c.key);

/* ─── Store ────────────────────────────────────────────────────────────────── */

const usePoTableStore = createPoTableStore(DEFAULT_VISIBLE);

/* ─── Page component ──────────────────────────────────────────────────────── */

export default function PurchaseOrderListPage() {
  const { t } = useTranslation(['purchaseOrders', 'common']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const s = usePoTableStore();

  const activeView = s.savedViews.find((v) => v.id === s.activeViewId);

  const [showSelectRfq, setShowSelectRfq] = useState(false);
  const [showSelectBo, setShowSelectBo] = useState(false);

  useEffect(() => {
    s.loadViews();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tableRef = useRef<HTMLTableElement>(null);
  const [previewY, setPreviewY] = useState(0);

  /* Export */
  const { handleExport } = usePoExport({
    search: s.search,
    quickFilter: s.quickFilter,
    sortBy: s.sortBy,
    sortDir: s.sortDir,
    visibleColumns: s.visibleColumns,
    columnOrder: s.columnOrder,
  });

  /* Dropdowns */
  const createDD = useDropdown();
  const viewDD = useDropdown();
  const groupDD = useDropdown();
  const exportDD = useDropdown();

  /* Column drag-drop */
  const { dragColKey, dragOverColKey, handleDragStart, handleDragOver, handleDrop, handleDragEnd } =
    useColumnDragDrop({ tableRef, setColumnOrder: s.setColumnOrder });

  /* Column resize */
  const { columnWidths, handleResizeStart } = useColumnResize();

  /* Sort handler */
  const handleSort = useCallback(
    (field: string) => {
      if (s.sortBy !== field) {
        s.setSortBy(field);
        s.setSortDir('asc');
      } else if (s.sortDir === 'asc') {
        s.setSortDir('desc');
      } else {
        s.setSortBy('');
        s.setSortDir(null);
      }
      s.setPage(1);
    },
    [s],
  );

  /* Data */
  const { data, isLoading } = usePurchaseOrders({
    page: s.page,
    limit: s.pageSize,
    search: s.search || undefined,
    quickFilter: s.quickFilter || undefined,
    sortBy: s.sortBy || undefined,
    sortDir: s.sortBy && s.sortDir ? s.sortDir : undefined,
  });

  const rawItems = useMemo(() => data?.items ?? [], [data?.items]);
  const items = useMemo(
    () => filterPoItems(rawItems, s.advancedFilters),
    [rawItems, s.advancedFilters],
  );
  const totalCount = data?.meta.total ?? 0;

  /* Grouping */
  const { groupedItems, expandedGroups, toggleGroup } = usePoGrouping(
    items,
    s.groupBy,
    GROUP_FIELD_MAP,
  );

  /* Visible columns */
  const colByKey = new Map(ALL_COLUMNS.map((c) => [c.key, c]));
  const visibleCols = s.columnOrder
    .filter((key) => s.visibleColumns.includes(key))
    .map((key) => colByKey.get(key))
    .filter((c): c is ColumnDef => Boolean(c));

  /* Cell renderer */
  const renderCell = (po: PoListItem, field: SortableField, key: string) => {
    if (key === 'poStatus') {
      return (
        <Badge className={getStatusColor(PO_STATUS_COLORS, po.status)}>
          {t(buyerPoStatusKey(po.status) as never)}
        </Badge>
      );
    }
    if (key === 'revision') {
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
          {po.revision !== null && po.revision !== undefined ? 'Active' : '-'}
        </Badge>
      );
    }
    if (key === 'pickUp') return po.pickUp ? t('common:yes') : t('common:no');
    if (key === 'totalAmount') {
      return po.totalAmount !== null && po.totalAmount !== undefined
        ? `$ ${po.totalAmount.toLocaleString()}`
        : '-';
    }
    if (
      key === 'needBy' ||
      key === 'earliestDate' ||
      key === 'createdDate' ||
      key === 'lastUpdated'
    ) {
      const val = po[field];
      if (!val) return '-';
      return new Date(val as string).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    if (key === 'paymentTermsDays')
      return po.paymentTermsDays !== null && po.paymentTermsDays !== undefined
        ? `${po.paymentTermsDays} days`
        : '-';
    if (key === 'holdForRelease') return po.holdForRelease ? t('common:yes') : t('common:no');
    if (key === 'plannedDeliveryDate') {
      return po.plannedDeliveryDate
        ? new Date(po.plannedDeliveryDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : '-';
    }
    if (key === 'aging') {
      const ref = po.issuedAt ?? po.updatedAt;
      if (!ref) return '-';
      return `${Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000)}d`;
    }
    if (key === 'isBulkOrder') return po.poType === 'BULK' ? t('common:yes') : t('common:no');
    if (key === 'approvalStatus') {
      if (!po.approvalStatus) return '-';
      return (
        <Badge className={getStatusColor(PO_STATUS_COLORS, po.approvalStatus)}>
          {t(`approvalStatus.${po.approvalStatus}` as never)}
        </Badge>
      );
    }
    if (key === 'linkedRfqAvgPrice')
      return po.linkedRfqAvgPrice !== null && po.linkedRfqAvgPrice !== undefined
        ? `$ ${po.linkedRfqAvgPrice.toLocaleString()}`
        : '-';
    if (key === 'lineItemsDelivered') return String(po.lineItemsDelivered);
    if (key === 'quantityDelivered') return String(po.quantityDelivered);
    if (key === 'poType') return po.poType ? t(`poTypes.${po.poType}` as never) : '-';

    const val = po[field];
    if (val === null || val === undefined) return '-';
    return String(val);
  };

  /* Row renderer */
  const renderPoRow = (po: PoListItem) => (
    <tr
      key={po.id}
      className="border-b border-border last:border-b-0 hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => navigate(ROUTES.purchaseOrderDetail.replace(':id', po.id))}
    >
      {visibleCols.map(({ field, key }) => (
        <td
          key={key}
          className={cn(
            'py-3 px-3 text-foreground',
            TRUNCATE_COLUMNS.includes(key) && 'truncate max-w-[180px]',
          )}
          style={
            dragColKey === key
              ? { background: 'hsl(var(--accent))', border: '0 solid hsl(var(--border))' }
              : undefined
          }
        >
          {renderCell(po, field, key)}
        </td>
      ))}
      <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-0.5">
          <MessageBadgeIcon
            hasNotification={po.hasMessages}
            className="w-8 h-8 flex items-center justify-center"
            onClick={() =>
              navigate(`${ROUTES.purchaseOrderDetail.replace(':id', po.id)}?tab=messages`)
            }
          />
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={t('actions.attachments')}
            onClick={() =>
              navigate(`${ROUTES.purchaseOrderDetail.replace(':id', po.id)}?tab=documents`)
            }
          >
            <PaperclipIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={t('actions.view')}
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const container = (e.currentTarget as HTMLElement).closest('.relative');
              const containerTop = container?.getBoundingClientRect().top ?? 0;
              setPreviewY(rect.top - containerTop);
              s.openPreview(po.id);
            }}
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <DotActionsMenu
            bordered={false}
            actions={[
              {
                key: 'copyPo',
                label: t('actions.copyPo'),
                onClick: () => {
                  s.setCopyPo(po);
                  s.setCopyState('loading');
                  void copyPurchaseOrder(po.id).then(({ id: newId }) => {
                    s.setCopiedPoId(newId);
                    s.setCopyState('success');
                    void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
                  });
                },
              },
              {
                key: 'moveToArchive',
                label: t('actions.moveToArchive'),
                onClick: () => {
                  void archivePurchaseOrder(po.id).then(() => {
                    void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
                  });
                },
              },
              {
                key: 'downloadPdf',
                label: t('actions.downloadPdf'),
                onClick: () => {
                  void exportPurchaseOrders('pdf', { search: po.id }).then(({ url }) =>
                    window.open(url, '_blank'),
                  );
                },
              },
            ]}
          />
        </div>
      </td>
    </tr>
  );

  return (
    <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-6 sm:pb-8 relative">
      <div className="flex flex-col rounded-lg border border-border bg-background pb-4">
        {/* ═══ Toolbar Row 1 ═══ */}
        <div className="px-4 sm:px-8 pt-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div ref={createDD.ref} className="relative">
              <Button
                variant="primary"
                size="lg"
                leftIcon={<span className="text-lg leading-none">+</span>}
                onClick={() => createDD.setIsOpen((p) => !p)}
              >
                {t('list.createNew')}
              </Button>

              {createDD.isOpen && (
                <div className="absolute left-0 mt-1 w-[301px] border-2 border-foreground/20 bg-background rounded-lg p-2 z-50 flex flex-col items-start gap-1">
                  <button
                    type="button"
                    className="flex items-center gap-2.5 h-10 px-2 rounded-xl text-foreground text-[18px] leading-6 font-medium font-[Inter] hover:bg-muted transition-colors w-full text-left"
                    onClick={() => {
                      createDD.setIsOpen(false);
                      navigate(ROUTES.purchaseOrderNew);
                    }}
                  >
                    Create manually
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-2.5 h-10 px-2 rounded-xl text-foreground text-[18px] leading-6 font-medium font-[Inter] hover:bg-muted transition-colors w-full text-left"
                    onClick={() => {
                      createDD.setIsOpen(false);
                      setShowSelectRfq(true);
                    }}
                  >
                    Converting Approved RFQ
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-2.5 h-10 px-2 rounded-xl text-foreground text-[18px] leading-6 font-medium font-[Inter] hover:bg-muted transition-colors w-full text-left"
                    onClick={() => {
                      createDD.setIsOpen(false);
                      setShowSelectBo(true);
                    }}
                  >
                    From Bulk order
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <ViewSelectorDropdown
                activeView={activeView}
                savedViews={s.savedViews}
                onApplyView={s.applyView}
                defaultViewLabel={t('list.viewDefault')}
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
        <div className="mt-4 px-4 sm:px-8">
          <div className="border-b border-border" />
        </div>

        {/* ═══ Toolbar Row 2 ═══ */}
        <div className="px-4 sm:px-8 pt-2 pb-4">
          <div className="flex items-start justify-between gap-6 max-[899px]:flex-col max-[899px]:items-start max-[899px]:gap-3 py-1">
            <div className="flex items-center gap-2 flex-wrap min-w-0 max-w-[66%] max-[899px]:max-w-full">
              <span className="text-sm text-foreground whitespace-nowrap">
                {t('list.quickFiltersLabel')}
              </span>
              {PO_CA_QUICK_FILTERS.map((key) => (
                <FilterChip
                  key={key}
                  label={t(`quickFilters.${key}`)}
                  active={s.quickFilter === key}
                  onClick={() => s.setQuickFilter(s.quickFilter === key ? '' : key)}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <GroupByButton
                groupBy={s.groupBy}
                onGroupByChange={s.setGroupBy}
                options={GROUP_OPTIONS}
                getOptionLabel={(opt) => t(`list.${opt}` as never)}
                label={t('list.group')}
                isOpen={groupDD.isOpen}
                onOpenChange={groupDD.setIsOpen}
                dropdownRef={groupDD.ref}
              />

              <FilterPanel
                label={t('list.filters')}
                open={s.filtersOpen}
                onOpenChange={s.setFiltersOpen}
                onClearAll={s.clearAdvancedFilters}
                clearAllLabel={t('advancedFilters.clearAll')}
              >
                <PoAdvancedFilters
                  advancedFilters={s.advancedFilters}
                  setAdvancedFilters={s.setAdvancedFilters}
                  items={rawItems}
                  statusKeys={PO_STATUS_KEYS}
                  statusLabel={(key) => t(buyerPoStatusKey(key) as never)}
                  typeKeys={PO_TYPE_KEYS}
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
        <div className="px-4 sm:px-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="md" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">{t('list.noPosFound')}</div>
          ) : (
            <div className="rounded-lg border border-border overflow-x-auto">
              <table
                ref={tableRef}
                className="w-full text-sm"
                style={{ tableLayout: Object.keys(columnWidths).length > 0 ? 'fixed' : undefined }}
              >
                <thead>
                  <tr className="border-b border-border text-left bg-[hsl(var(--table-header))] font-['Inter'] text-[hsl(var(--table-header-foreground))]">
                    {visibleCols.map(({ field, key }) => {
                      const isDropTarget = dragOverColKey === key && dragColKey !== key;
                      const width = columnWidths[key];
                      return (
                        <th
                          key={key}
                          draggable
                          onDragStart={(e) => handleDragStart(e, key)}
                          onDragOver={(e) => handleDragOver(e, key)}
                          onDrop={(e) => handleDrop(e, key)}
                          onDragEnd={handleDragEnd}
                          className={cn(
                            'relative py-3 px-3 text-xs font-bold leading-4 tracking-[0.6px] whitespace-nowrap cursor-pointer select-none',
                            isDropTarget && 'border-l-2 border-l-primary',
                          )}
                          style={{
                            ...(dragColKey === key ? { background: 'hsl(var(--accent))' } : {}),
                            ...(width ? { width: `${width}px` } : {}),
                          }}
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
                          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
                          <span
                            role="separator"
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40"
                            onMouseDown={(e) => handleResizeStart(e, key)}
                            onClick={(e) => e.stopPropagation()}
                          />
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
                        const groupLabel =
                          s.groupBy === 'groupByStatus' && groupKey !== '-'
                            ? t(buyerPoStatusKey(groupKey) as never)
                            : groupKey;
                        return (
                          <GroupSection
                            key={groupKey}
                            groupKey={groupKey}
                            label={groupLabel}
                            isExpanded={isExpanded}
                            onToggle={toggleGroup}
                            colSpan={visibleCols.length + 1}
                          >
                            {groupItems.map((po) => renderPoRow(po))}
                          </GroupSection>
                        );
                      })
                    : items.map((po) => renderPoRow(po))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalCount > 0 && (
          <div className="px-4 sm:px-8">
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
              label: t(`columns.${c.key}` as never),
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

      {/* Copy PO modal */}
      {s.copyPo && (
        <CopyPoModal
          projectName={s.copyPo.projectName}
          copyState={s.copyState}
          onClose={() => s.setCopyPo(null)}
          onOpenCopy={() => {
            const newId = s.copiedPoId;
            s.setCopyPo(null);
            if (newId) navigate(ROUTES.purchaseOrderDetail.replace(':id', newId));
          }}
        />
      )}

      {/* Preview panel */}
      {s.previewOpen && s.previewPoId && (
        <div className="absolute right-8 z-30" style={{ top: previewY }}>
          <PoDetailPanel poId={s.previewPoId} onClose={s.closePreview} />
        </div>
      )}

      {/* Pre-selection modals */}
      <SelectRfqModal
        open={showSelectRfq}
        onClose={() => setShowSelectRfq(false)}
        onSelect={(rfq: RfqListItem, selectedItemIds?: Set<string>) => {
          setShowSelectRfq(false);
          void getRfq(rfq.id).then((detail) => {
            const filtered = selectedItemIds
              ? {
                  ...detail,
                  lineItems: detail.lineItems.filter((li) => selectedItemIds.has(li.id)),
                }
              : detail;
            const { defaultValues, lockedFields } = rfqToFormDefaults(filtered);
            navigate(ROUTES.purchaseOrderNew, {
              state: { mode: 'from-rfq', defaultValues, lockedFields: [...lockedFields] },
            });
          });
        }}
      />
      <SelectBulkOrderModal
        open={showSelectBo}
        onClose={() => setShowSelectBo(false)}
        onSelect={(bo: BulkOrderListItem, selectedItemIds?: Set<string>) => {
          setShowSelectBo(false);
          void getBulkOrder(bo.id).then((detail) => {
            const filtered = selectedItemIds
              ? {
                  ...detail,
                  lineItems: detail.lineItems.filter((li) => selectedItemIds.has(li.lineItemId)),
                }
              : detail;
            const { defaultValues, lockedFields } = bulkOrderToFormDefaults(filtered);
            // Resolve vendorId from the list item since BulkOrderDetail doesn't have vendorId
            if (defaultValues) {
              defaultValues.vendorId = bo.vendorId;
            }
            navigate(ROUTES.purchaseOrderNew, {
              state: { mode: 'from-bulk-order', defaultValues, lockedFields: [...lockedFields] },
            });
          });
        }}
      />
    </div>
  );
}

/* ── Collapsible group section ───────────────────────────────────── */

function GroupSection({
  groupKey,
  label,
  isExpanded,
  onToggle,
  colSpan,
  children,
}: {
  groupKey: string;
  label: string;
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
            {label}
          </div>
        </td>
      </tr>
      {isExpanded && children}
    </>
  );
}
