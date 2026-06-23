import type { RfqListItem } from '@forethread/api-client';
import { createView, deleteAllViews, deleteView, getViews } from '@forethread/api-client';
import { type AdvancedFilters, EMPTY_FILTERS } from '@forethread/rfq-shared';
import type { SavedView, SortDirection } from '@forethread/ui-components';
import { create } from 'zustand';

const TABLE_NAME = 'rfqs';

interface RfqTableState {
  /* ─── Table / filter state ─── */
  page: number;
  pageSize: number;
  search: string;
  searchOpen: boolean;
  sortBy: string;
  sortDir: SortDirection;
  quickFilter: string;
  groupBy: string;
  columnOrder: string[];
  visibleColumns: string[];

  /* ─── Advanced filters ─── */
  advancedFilters: AdvancedFilters;

  /* ─── View management ─── */
  savedViews: SavedView[];
  activeViewId: string | null;

  /* ─── UI panels ─── */
  filtersOpen: boolean;
  showTableMgmt: boolean;
  showCreateView: boolean;

  /* ─── Preview panel ─── */
  previewRfqId: string | null;
  previewOpen: boolean;

  /* ─── Copy RFQ modal ─── */
  copyRfq: RfqListItem | null;
  copyState: 'loading' | 'success';
  copiedRfqId: string | null;

  /* ─── Actions ─── */
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSearch: (search: string) => void;
  setSearchOpen: (open: boolean) => void;
  setSortBy: (field: string) => void;
  setSortDir: (dir: SortDirection) => void;
  setQuickFilter: (filter: string) => void;
  setGroupBy: (group: string) => void;
  setColumnOrder: (order: string[] | ((prev: string[]) => string[])) => void;
  setVisibleColumns: (cols: string[]) => void;
  setAdvancedFilters: (filters: Partial<AdvancedFilters>) => void;
  clearAdvancedFilters: () => void;
  setFiltersOpen: (open: boolean) => void;
  setShowTableMgmt: (open: boolean) => void;
  setShowCreateView: (open: boolean) => void;
  setActiveViewId: (id: string | null) => void;
  applyView: (viewId: string | null) => void;
  loadViews: () => void;
  addSavedView: (name: string) => void;
  deleteSavedView: (viewId: string) => void;
  deleteAllSavedViews: () => void;
  setPreviewRfqId: (id: string | null) => void;
  setPreviewOpen: (open: boolean) => void;
  openPreview: (id: string) => void;
  closePreview: () => void;
  setCopyRfq: (rfq: RfqListItem | null) => void;
  setCopyState: (state: 'loading' | 'success') => void;
  setCopiedRfqId: (id: string | null) => void;
}

export const createRfqTableStore = (defaultColumns: string[]) =>
  create<RfqTableState>((set, get) => ({
    page: 1,
    pageSize: 25,
    search: '',
    searchOpen: false,
    // Default to most-recently-created first so new RFQs surface at the top.
    sortBy: 'createdDate',
    sortDir: 'desc',
    quickFilter: '',
    groupBy: '',
    columnOrder: [...defaultColumns],
    visibleColumns: [...defaultColumns],
    advancedFilters: { ...EMPTY_FILTERS },
    savedViews: [],
    activeViewId: null,
    filtersOpen: false,
    showTableMgmt: false,
    showCreateView: false,
    previewRfqId: null,
    previewOpen: false,
    copyRfq: null,
    copyState: 'loading',
    copiedRfqId: null,

    setPage: (page) => set({ page }),
    setPageSize: (pageSize) => set({ pageSize, page: 1 }),
    setSearch: (search) => set({ search, page: 1 }),
    setSearchOpen: (searchOpen) =>
      set((s) => ({
        searchOpen,
        ...(!searchOpen && { search: '', page: 1 }),
        ...(searchOpen && { page: s.page }),
      })),
    setSortBy: (sortBy) => set({ sortBy }),
    setSortDir: (sortDir) => set({ sortDir }),
    setQuickFilter: (quickFilter) => set({ quickFilter, page: 1 }),
    setGroupBy: (groupBy) => set({ groupBy, page: 1 }),
    setColumnOrder: (order) =>
      set((s) => ({
        columnOrder: typeof order === 'function' ? order(s.columnOrder) : order,
      })),
    setVisibleColumns: (visibleColumns) => set({ visibleColumns }),
    setAdvancedFilters: (filters) =>
      set((s) => ({ advancedFilters: { ...s.advancedFilters, ...filters }, page: 1 })),
    clearAdvancedFilters: () => set({ advancedFilters: { ...EMPTY_FILTERS }, page: 1 }),
    setFiltersOpen: (filtersOpen) => set({ filtersOpen }),
    setShowTableMgmt: (showTableMgmt) => set({ showTableMgmt }),
    setShowCreateView: (showCreateView) => set({ showCreateView }),
    setActiveViewId: (activeViewId) => set({ activeViewId }),
    applyView: (viewId) => {
      if (!viewId) {
        set({
          activeViewId: null,
          visibleColumns: [...defaultColumns],
          columnOrder: [...defaultColumns],
          sortBy: 'createdDate',
          sortDir: 'desc',
          quickFilter: '',
          groupBy: '',
          page: 1,
        });
        return;
      }
      const view = get().savedViews.find((v) => v.id === viewId);
      if (!view) return;
      set({
        activeViewId: viewId,
        visibleColumns: view.visibleColumns?.length ? view.visibleColumns : [...defaultColumns],
        columnOrder: view.columnOrder?.length ? view.columnOrder : [...defaultColumns],
        sortBy: view.sortBy ?? 'createdDate',
        sortDir: (view.sortDir as SortDirection) ?? 'desc',
        quickFilter: view.quickFilter ?? '',
        groupBy: view.groupBy ?? '',
        page: 1,
      });
    },
    loadViews: () => {
      void getViews(TABLE_NAME).then((views) => {
        set({
          savedViews: views.map((v) => ({
            id: v.id,
            name: v.name,
            visibleColumns: v.visibleColumns,
            columnOrder: v.columnOrder,
            sortBy: v.sortBy ?? undefined,
            sortDir: v.sortDir ?? undefined,
            quickFilter: v.quickFilter ?? undefined,
            groupBy: v.groupBy ?? undefined,
          })),
        });
      });
    },
    addSavedView: (name) => {
      const s = get();
      const viewData = {
        name,
        visibleColumns: [...s.visibleColumns],
        columnOrder: [...s.columnOrder],
        sortBy: s.sortBy,
        sortDir: s.sortDir ?? undefined,
        quickFilter: s.quickFilter,
        groupBy: s.groupBy,
      };

      const tempId = crypto.randomUUID();
      set({
        savedViews: [...s.savedViews, { id: tempId, ...viewData }],
        showCreateView: false,
      });

      void createView({ ...viewData, tableName: TABLE_NAME }).then((saved) => {
        set((prev) => ({
          savedViews: prev.savedViews.map((v) =>
            v.id === tempId
              ? {
                  id: saved.id,
                  name: saved.name,
                  visibleColumns: saved.visibleColumns,
                  columnOrder: saved.columnOrder,
                  sortBy: saved.sortBy ?? undefined,
                  sortDir: saved.sortDir ?? undefined,
                  quickFilter: saved.quickFilter ?? undefined,
                  groupBy: saved.groupBy ?? undefined,
                }
              : v,
          ),
          activeViewId: prev.activeViewId === tempId ? saved.id : prev.activeViewId,
        }));
      });
    },
    deleteSavedView: (viewId) => {
      set((s) => ({
        savedViews: s.savedViews.filter((v) => v.id !== viewId),
        activeViewId: s.activeViewId === viewId ? null : s.activeViewId,
      }));
      void deleteView(viewId);
    },
    deleteAllSavedViews: () => {
      set({ savedViews: [], activeViewId: null });
      void deleteAllViews(TABLE_NAME);
    },
    setPreviewRfqId: (previewRfqId) => set({ previewRfqId }),
    setPreviewOpen: (previewOpen) => set({ previewOpen }),
    openPreview: (id) => set({ previewRfqId: id, previewOpen: true }),
    closePreview: () => set({ previewOpen: false, previewRfqId: null }),
    setCopyRfq: (copyRfq) => set({ copyRfq, copiedRfqId: null }),
    setCopyState: (copyState) => set({ copyState }),
    setCopiedRfqId: (copiedRfqId) => set({ copiedRfqId }),
  }));
