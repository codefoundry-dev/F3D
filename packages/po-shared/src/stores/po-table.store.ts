import type { PoListItem } from '@forethread/api-client';
import { createView, deleteAllViews, deleteView, getViews } from '@forethread/api-client';
import type { SavedView, SortDirection } from '@forethread/ui-components';
import { create } from 'zustand';

export interface PoAdvancedFilters {
  status: string[];
  projectId: string[];
  vendorId: string[];
  poType: string[];
  totalAmountFrom: string;
  totalAmountTo: string;
  issueDateFrom: string;
  issueDateTo: string;
  plannedDeliveryDateFrom: string;
  plannedDeliveryDateTo: string;
  createdByUserId: string[];
  lastModifiedByUserId: string[];
  /* Operational-state checkboxes */
  isBulkDrawdown: boolean;
  isHoldForRelease: boolean;
  needApproval: boolean;
  hasMessages: boolean;
  hasAttachments: boolean;
}

export const EMPTY_PO_FILTERS: PoAdvancedFilters = {
  status: [],
  projectId: [],
  vendorId: [],
  poType: [],
  totalAmountFrom: '',
  totalAmountTo: '',
  issueDateFrom: '',
  issueDateTo: '',
  plannedDeliveryDateFrom: '',
  plannedDeliveryDateTo: '',
  createdByUserId: [],
  lastModifiedByUserId: [],
  isBulkDrawdown: false,
  isHoldForRelease: false,
  needApproval: false,
  hasMessages: false,
  hasAttachments: false,
};

export interface PoTableState {
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
  advancedFilters: PoAdvancedFilters;

  /* ─── View management ─── */
  savedViews: SavedView[];
  activeViewId: string | null;

  /* ─── UI panels ─── */
  filtersOpen: boolean;
  showTableMgmt: boolean;
  showCreateView: boolean;

  /* ─── Preview panel ─── */
  previewPoId: string | null;
  previewOpen: boolean;

  /* ─── Copy PO modal ─── */
  copyPo: PoListItem | null;
  copyState: 'loading' | 'success';
  copiedPoId: string | null;

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
  setAdvancedFilters: (filters: Partial<PoAdvancedFilters>) => void;
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
  setPreviewPoId: (id: string | null) => void;
  setPreviewOpen: (open: boolean) => void;
  openPreview: (id: string) => void;
  closePreview: () => void;
  setCopyPo: (po: PoListItem | null) => void;
  setCopyState: (state: 'loading' | 'success') => void;
  setCopiedPoId: (id: string | null) => void;
}

export const createPoTableStore = (
  defaultColumns: string[],
  tableName = 'purchase-orders',
  defaultSortBy = 'poNumber',
  // Columns shown by default. Defaults to the full catalog, but pages pass a
  // curated subset so the rest stay available (toggleable) via Table settings.
  defaultVisible: string[] = defaultColumns,
) =>
  create<PoTableState>((set, get) => ({
    page: 1,
    pageSize: 25,
    search: '',
    searchOpen: false,
    sortBy: defaultSortBy,
    sortDir: 'asc',
    quickFilter: '',
    groupBy: '',
    columnOrder: [...defaultColumns],
    visibleColumns: [...defaultVisible],
    advancedFilters: { ...EMPTY_PO_FILTERS },
    savedViews: [],
    activeViewId: null,
    filtersOpen: false,
    showTableMgmt: false,
    showCreateView: false,
    previewPoId: null,
    previewOpen: false,
    copyPo: null,
    copyState: 'loading',
    copiedPoId: null,

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
    clearAdvancedFilters: () => set({ advancedFilters: { ...EMPTY_PO_FILTERS }, page: 1 }),
    setFiltersOpen: (filtersOpen) => set({ filtersOpen }),
    setShowTableMgmt: (showTableMgmt) => set({ showTableMgmt }),
    setShowCreateView: (showCreateView) => set({ showCreateView }),
    setActiveViewId: (activeViewId) => set({ activeViewId }),
    applyView: (viewId) => {
      if (!viewId) {
        set({
          activeViewId: null,
          visibleColumns: [...defaultVisible],
          columnOrder: [...defaultColumns],
          sortBy: defaultSortBy,
          sortDir: 'asc',
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
        visibleColumns: view.visibleColumns?.length ? view.visibleColumns : [...defaultVisible],
        columnOrder: view.columnOrder?.length ? view.columnOrder : [...defaultColumns],
        sortBy: view.sortBy ?? defaultSortBy,
        sortDir: (view.sortDir as SortDirection) ?? 'asc',
        quickFilter: view.quickFilter ?? '',
        groupBy: view.groupBy ?? '',
        page: 1,
      });
    },
    loadViews: () => {
      void getViews(tableName).then((views) => {
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
      void createView({ ...viewData, tableName })
        .then((saved) => {
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
          }));
        })
        .catch(() => {
          // Keep optimistic view in local state even if API fails
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
      void deleteAllViews(tableName);
    },
    setPreviewPoId: (previewPoId) => set({ previewPoId }),
    setPreviewOpen: (previewOpen) => set({ previewOpen }),
    openPreview: (id) => set({ previewPoId: id, previewOpen: true }),
    closePreview: () => set({ previewOpen: false, previewPoId: null }),
    setCopyPo: (copyPo) => set({ copyPo }),
    setCopyState: (copyState) => set({ copyState }),
    setCopiedPoId: (copiedPoId) => set({ copiedPoId }),
  }));
