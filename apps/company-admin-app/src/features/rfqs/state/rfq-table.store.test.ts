import type { SavedView } from '@forethread/ui-components';

const mockGetViews = vi.hoisted(() => vi.fn());
const mockCreateView = vi.hoisted(() => vi.fn());
const mockDeleteView = vi.hoisted(() => vi.fn());
const mockDeleteAllViews = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', () => ({
  getViews: mockGetViews,
  createView: mockCreateView,
  deleteView: mockDeleteView,
  deleteAllViews: mockDeleteAllViews,
}));

vi.mock('@forethread/rfq-shared', () => ({
  EMPTY_FILTERS: {
    status: [],
    projectId: [],
    deliveryLocation: [],
    createdByUserId: [],
    createdDateFrom: '',
    createdDateTo: '',
    deadlineFrom: '',
    deadlineTo: '',
    minApprovedQuotes: '',
    minApprovedVendors: '',
  },
}));

// Must be imported after mocks
import { createRfqTableStore } from './rfq-table.store';

const DEFAULT_COLUMNS = ['rfqId', 'projectName', 'rfqStatus'];

function createStore() {
  return createRfqTableStore(DEFAULT_COLUMNS);
}

describe('createRfqTableStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initialises with default state', () => {
    const useStore = createStore();
    const s = useStore.getState();
    expect(s.page).toBe(1);
    expect(s.pageSize).toBe(25);
    expect(s.search).toBe('');
    expect(s.searchOpen).toBe(false);
    expect(s.sortBy).toBe('deadlineRange');
    expect(s.sortDir).toBe('asc');
    expect(s.quickFilter).toBe('');
    expect(s.groupBy).toBe('');
    expect(s.columnOrder).toEqual(DEFAULT_COLUMNS);
    expect(s.visibleColumns).toEqual(DEFAULT_COLUMNS);
    expect(s.savedViews).toEqual([]);
    expect(s.activeViewId).toBeNull();
    expect(s.filtersOpen).toBe(false);
    expect(s.showTableMgmt).toBe(false);
    expect(s.showCreateView).toBe(false);
    expect(s.previewRfqId).toBeNull();
    expect(s.previewOpen).toBe(false);
    expect(s.copyRfq).toBeNull();
    expect(s.copyState).toBe('loading');
    expect(s.copiedRfqId).toBeNull();
  });

  describe('setters', () => {
    it('setPage updates page', () => {
      const useStore = createStore();
      useStore.getState().setPage(3);
      expect(useStore.getState().page).toBe(3);
    });

    it('setPageSize updates pageSize and resets page to 1', () => {
      const useStore = createStore();
      useStore.getState().setPage(5);
      useStore.getState().setPageSize(50);
      expect(useStore.getState().pageSize).toBe(50);
      expect(useStore.getState().page).toBe(1);
    });

    it('setSearch updates search and resets page', () => {
      const useStore = createStore();
      useStore.getState().setPage(3);
      useStore.getState().setSearch('test');
      expect(useStore.getState().search).toBe('test');
      expect(useStore.getState().page).toBe(1);
    });

    it('setSearchOpen(true) opens search', () => {
      const useStore = createStore();
      useStore.getState().setSearchOpen(true);
      expect(useStore.getState().searchOpen).toBe(true);
    });

    it('setSearchOpen(false) closes search and clears search text', () => {
      const useStore = createStore();
      useStore.getState().setSearch('hello');
      useStore.getState().setSearchOpen(false);
      expect(useStore.getState().searchOpen).toBe(false);
      expect(useStore.getState().search).toBe('');
      expect(useStore.getState().page).toBe(1);
    });

    it('setSortBy updates sortBy', () => {
      const useStore = createStore();
      useStore.getState().setSortBy('projectName');
      expect(useStore.getState().sortBy).toBe('projectName');
    });

    it('setSortDir updates sortDir', () => {
      const useStore = createStore();
      useStore.getState().setSortDir('desc');
      expect(useStore.getState().sortDir).toBe('desc');
    });

    it('setQuickFilter updates quickFilter and resets page', () => {
      const useStore = createStore();
      useStore.getState().setPage(3);
      useStore.getState().setQuickFilter('openRfqs');
      expect(useStore.getState().quickFilter).toBe('openRfqs');
      expect(useStore.getState().page).toBe(1);
    });

    it('setGroupBy updates groupBy and resets page', () => {
      const useStore = createStore();
      useStore.getState().setPage(3);
      useStore.getState().setGroupBy('groupByProject');
      expect(useStore.getState().groupBy).toBe('groupByProject');
      expect(useStore.getState().page).toBe(1);
    });

    it('setColumnOrder with array sets columnOrder directly', () => {
      const useStore = createStore();
      useStore.getState().setColumnOrder(['a', 'b']);
      expect(useStore.getState().columnOrder).toEqual(['a', 'b']);
    });

    it('setColumnOrder with function applies updater', () => {
      const useStore = createStore();
      useStore.getState().setColumnOrder((prev) => [...prev, 'newCol']);
      expect(useStore.getState().columnOrder).toEqual([...DEFAULT_COLUMNS, 'newCol']);
    });

    it('setVisibleColumns updates visibleColumns', () => {
      const useStore = createStore();
      useStore.getState().setVisibleColumns(['rfqId']);
      expect(useStore.getState().visibleColumns).toEqual(['rfqId']);
    });

    it('setAdvancedFilters merges filters and resets page', () => {
      const useStore = createStore();
      useStore.getState().setPage(3);
      useStore.getState().setAdvancedFilters({ status: ['OPEN'] });
      expect(useStore.getState().advancedFilters.status).toEqual(['OPEN']);
      expect(useStore.getState().page).toBe(1);
    });

    it('clearAdvancedFilters resets to empty and resets page', () => {
      const useStore = createStore();
      useStore.getState().setAdvancedFilters({ status: ['OPEN'] });
      useStore.getState().clearAdvancedFilters();
      expect(useStore.getState().advancedFilters.status).toEqual([]);
      expect(useStore.getState().page).toBe(1);
    });

    it('setFiltersOpen updates filtersOpen', () => {
      const useStore = createStore();
      useStore.getState().setFiltersOpen(true);
      expect(useStore.getState().filtersOpen).toBe(true);
    });

    it('setShowTableMgmt updates showTableMgmt', () => {
      const useStore = createStore();
      useStore.getState().setShowTableMgmt(true);
      expect(useStore.getState().showTableMgmt).toBe(true);
    });

    it('setShowCreateView updates showCreateView', () => {
      const useStore = createStore();
      useStore.getState().setShowCreateView(true);
      expect(useStore.getState().showCreateView).toBe(true);
    });

    it('setActiveViewId updates activeViewId', () => {
      const useStore = createStore();
      useStore.getState().setActiveViewId('view-1');
      expect(useStore.getState().activeViewId).toBe('view-1');
    });

    it('setPreviewRfqId updates previewRfqId', () => {
      const useStore = createStore();
      useStore.getState().setPreviewRfqId('rfq-1');
      expect(useStore.getState().previewRfqId).toBe('rfq-1');
    });

    it('setPreviewOpen updates previewOpen', () => {
      const useStore = createStore();
      useStore.getState().setPreviewOpen(true);
      expect(useStore.getState().previewOpen).toBe(true);
    });

    it('setCopyRfq sets copyRfq and clears copiedRfqId', () => {
      const useStore = createStore();
      useStore.getState().setCopiedRfqId('old-id');
      const rfq = { id: 'rfq-1' } as never;
      useStore.getState().setCopyRfq(rfq);
      expect(useStore.getState().copyRfq).toBe(rfq);
      expect(useStore.getState().copiedRfqId).toBeNull();
    });

    it('setCopyState updates copyState', () => {
      const useStore = createStore();
      useStore.getState().setCopyState('success');
      expect(useStore.getState().copyState).toBe('success');
    });

    it('setCopiedRfqId updates copiedRfqId', () => {
      const useStore = createStore();
      useStore.getState().setCopiedRfqId('new-rfq');
      expect(useStore.getState().copiedRfqId).toBe('new-rfq');
    });
  });

  describe('openPreview / closePreview', () => {
    it('openPreview sets previewRfqId and opens preview', () => {
      const useStore = createStore();
      useStore.getState().openPreview('rfq-123');
      expect(useStore.getState().previewRfqId).toBe('rfq-123');
      expect(useStore.getState().previewOpen).toBe(true);
    });

    it('closePreview clears previewRfqId and closes preview', () => {
      const useStore = createStore();
      useStore.getState().openPreview('rfq-123');
      useStore.getState().closePreview();
      expect(useStore.getState().previewRfqId).toBeNull();
      expect(useStore.getState().previewOpen).toBe(false);
    });
  });

  describe('applyView', () => {
    it('resets to defaults when viewId is null', () => {
      const useStore = createStore();
      useStore.getState().setSortBy('projectName');
      useStore.getState().setQuickFilter('openRfqs');
      useStore.getState().applyView(null);
      expect(useStore.getState().activeViewId).toBeNull();
      expect(useStore.getState().visibleColumns).toEqual(DEFAULT_COLUMNS);
      expect(useStore.getState().columnOrder).toEqual(DEFAULT_COLUMNS);
      expect(useStore.getState().sortBy).toBe('deadlineRange');
      expect(useStore.getState().sortDir).toBe('asc');
      expect(useStore.getState().quickFilter).toBe('');
      expect(useStore.getState().groupBy).toBe('');
      expect(useStore.getState().page).toBe(1);
    });

    it('applies view settings when viewId matches a saved view', () => {
      const useStore = createStore();
      const view: SavedView = {
        id: 'v-1',
        name: 'My View',
        visibleColumns: ['rfqId'],
        columnOrder: ['rfqId'],
        sortBy: 'projectName',
        sortDir: 'desc',
        quickFilter: 'openRfqs',
        groupBy: 'groupByProject',
      };
      useStore.setState({ savedViews: [view] });
      useStore.getState().applyView('v-1');
      expect(useStore.getState().activeViewId).toBe('v-1');
      expect(useStore.getState().visibleColumns).toEqual(['rfqId']);
      expect(useStore.getState().columnOrder).toEqual(['rfqId']);
      expect(useStore.getState().sortBy).toBe('projectName');
      expect(useStore.getState().sortDir).toBe('desc');
      expect(useStore.getState().quickFilter).toBe('openRfqs');
      expect(useStore.getState().groupBy).toBe('groupByProject');
    });

    it('uses defaults when view has empty columns', () => {
      const useStore = createStore();
      const view: SavedView = {
        id: 'v-2',
        name: 'Empty View',
        visibleColumns: [],
        columnOrder: [],
      };
      useStore.setState({ savedViews: [view] });
      useStore.getState().applyView('v-2');
      expect(useStore.getState().visibleColumns).toEqual(DEFAULT_COLUMNS);
      expect(useStore.getState().columnOrder).toEqual(DEFAULT_COLUMNS);
    });

    it('does nothing when view not found', () => {
      const useStore = createStore();
      useStore.getState().setSortBy('projectName');
      useStore.getState().applyView('nonexistent');
      expect(useStore.getState().sortBy).toBe('projectName');
    });
  });

  describe('loadViews', () => {
    it('fetches views from backend and sets savedViews', async () => {
      const backendViews = [
        {
          id: 'v-1',
          name: 'View 1',
          visibleColumns: ['rfqId'],
          columnOrder: ['rfqId'],
          sortBy: 'projectName',
          sortDir: 'desc',
          quickFilter: 'openRfqs',
          groupBy: null,
        },
      ];
      mockGetViews.mockResolvedValue(backendViews);
      const useStore = createStore();
      useStore.getState().loadViews();
      await vi.waitFor(() => {
        expect(useStore.getState().savedViews).toHaveLength(1);
      });
      expect(mockGetViews).toHaveBeenCalledWith('rfqs');
      expect(useStore.getState().savedViews[0]).toEqual({
        id: 'v-1',
        name: 'View 1',
        visibleColumns: ['rfqId'],
        columnOrder: ['rfqId'],
        sortBy: 'projectName',
        sortDir: 'desc',
        quickFilter: 'openRfqs',
        groupBy: undefined,
      });
    });
  });

  describe('addSavedView', () => {
    it('optimistically adds a view then replaces with backend id', async () => {
      mockCreateView.mockResolvedValue({
        id: 'real-id',
        name: 'New View',
        visibleColumns: DEFAULT_COLUMNS,
        columnOrder: DEFAULT_COLUMNS,
        sortBy: 'deadlineRange',
        sortDir: 'asc',
        quickFilter: null,
        groupBy: null,
      });

      const useStore = createStore();
      useStore.getState().addSavedView('New View');

      // Optimistic update should have happened immediately
      expect(useStore.getState().savedViews).toHaveLength(1);
      expect(useStore.getState().savedViews[0].name).toBe('New View');
      expect(useStore.getState().showCreateView).toBe(false);

      // Wait for backend response
      await vi.waitFor(() => {
        expect(useStore.getState().savedViews[0].id).toBe('real-id');
      });
    });
  });

  describe('deleteSavedView', () => {
    it('removes view from savedViews and calls deleteView API', () => {
      const useStore = createStore();
      useStore.setState({
        savedViews: [{ id: 'v-1', name: 'View 1' }],
        activeViewId: 'v-1',
      });
      useStore.getState().deleteSavedView('v-1');
      expect(useStore.getState().savedViews).toHaveLength(0);
      expect(useStore.getState().activeViewId).toBeNull();
      expect(mockDeleteView).toHaveBeenCalledWith('v-1');
    });

    it('does not clear activeViewId when deleting a different view', () => {
      const useStore = createStore();
      useStore.setState({
        savedViews: [
          { id: 'v-1', name: 'View 1' },
          { id: 'v-2', name: 'View 2' },
        ],
        activeViewId: 'v-1',
      });
      useStore.getState().deleteSavedView('v-2');
      expect(useStore.getState().activeViewId).toBe('v-1');
      expect(useStore.getState().savedViews).toHaveLength(1);
    });
  });

  describe('deleteAllSavedViews', () => {
    it('clears all views and activeViewId and calls API', () => {
      const useStore = createStore();
      useStore.setState({
        savedViews: [{ id: 'v-1', name: 'View 1' }],
        activeViewId: 'v-1',
      });
      useStore.getState().deleteAllSavedViews();
      expect(useStore.getState().savedViews).toEqual([]);
      expect(useStore.getState().activeViewId).toBeNull();
      expect(mockDeleteAllViews).toHaveBeenCalledWith('rfqs');
    });
  });
});
