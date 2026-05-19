vi.mock('@forethread/api-client', () => ({
  createView: vi
    .fn()
    .mockResolvedValue({ id: 'new-view', name: 'Test View', visibleColumns: [], columnOrder: [] }),
  deleteView: vi.fn().mockResolvedValue(undefined),
  deleteAllViews: vi.fn().mockResolvedValue(undefined),
  getViews: vi.fn().mockResolvedValue([]),
}));

import { act } from '@testing-library/react';

import { createRfqTableStore } from './rfq-table.store';

describe('rfq-table.store', () => {
  const defaultColumns = ['col1', 'col2', 'col3'];

  it('creates store with defaults', () => {
    const useStore = createRfqTableStore(defaultColumns);
    const state = useStore.getState();
    expect(state.page).toBe(1);
    expect(state.pageSize).toBe(25);
    expect(state.search).toBe('');
    expect(state.columnOrder).toEqual(defaultColumns);
    expect(state.visibleColumns).toEqual(defaultColumns);
  });

  it('setPage updates page', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().setPage(3));
    expect(useStore.getState().page).toBe(3);
  });

  it('setPageSize resets page to 1', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().setPage(5));
    act(() => useStore.getState().setPageSize(50));
    expect(useStore.getState().pageSize).toBe(50);
    expect(useStore.getState().page).toBe(1);
  });

  it('setSearch updates search and resets page', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().setPage(3));
    act(() => useStore.getState().setSearch('test'));
    expect(useStore.getState().search).toBe('test');
    expect(useStore.getState().page).toBe(1);
  });

  it('setSearchOpen clears search when closing', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().setSearch('test'));
    act(() => useStore.getState().setSearchOpen(false));
    expect(useStore.getState().search).toBe('');
    expect(useStore.getState().searchOpen).toBe(false);
  });

  it('setSearchOpen keeps search when opening', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().setSearch('test'));
    act(() => useStore.getState().setSearchOpen(true));
    expect(useStore.getState().searchOpen).toBe(true);
  });

  it('setSortBy and setSortDir', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().setSortBy('col1'));
    act(() => useStore.getState().setSortDir('desc'));
    expect(useStore.getState().sortBy).toBe('col1');
    expect(useStore.getState().sortDir).toBe('desc');
  });

  it('setQuickFilter resets page', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().setPage(3));
    act(() => useStore.getState().setQuickFilter('allOpen'));
    expect(useStore.getState().quickFilter).toBe('allOpen');
    expect(useStore.getState().page).toBe(1);
  });

  it('setGroupBy resets page', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().setPage(3));
    act(() => useStore.getState().setGroupBy('groupByProject'));
    expect(useStore.getState().groupBy).toBe('groupByProject');
    expect(useStore.getState().page).toBe(1);
  });

  it('setColumnOrder with function', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().setColumnOrder((prev) => [...prev].reverse()));
    expect(useStore.getState().columnOrder).toEqual(['col3', 'col2', 'col1']);
  });

  it('setColumnOrder with array', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().setColumnOrder(['col2', 'col1']));
    expect(useStore.getState().columnOrder).toEqual(['col2', 'col1']);
  });

  it('setVisibleColumns', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().setVisibleColumns(['col1']));
    expect(useStore.getState().visibleColumns).toEqual(['col1']);
  });

  it('applyView with null resets to defaults', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().setSortBy('col1'));
    act(() => useStore.getState().applyView(null));
    expect(useStore.getState().sortBy).toBe('deadlineRange');
    expect(useStore.getState().visibleColumns).toEqual(defaultColumns);
  });

  it('applyView with saved view', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => {
      const s = useStore.getState();
      s.savedViews.push({
        id: 'v1',
        name: 'View 1',
        visibleColumns: ['col1'],
        columnOrder: ['col1'],
        sortBy: 'col1',
        sortDir: 'desc',
        quickFilter: 'allOpen',
        groupBy: 'groupByProject',
      });
    });
    act(() => useStore.getState().applyView('v1'));
    expect(useStore.getState().activeViewId).toBe('v1');
    expect(useStore.getState().visibleColumns).toEqual(['col1']);
    expect(useStore.getState().sortBy).toBe('col1');
  });

  it('openPreview and closePreview', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().openPreview('rfq-1'));
    expect(useStore.getState().previewRfqId).toBe('rfq-1');
    expect(useStore.getState().previewOpen).toBe(true);

    act(() => useStore.getState().closePreview());
    expect(useStore.getState().previewOpen).toBe(false);
    expect(useStore.getState().previewRfqId).toBeNull();
  });

  it('setCopyRfq / setCopyState / setCopiedRfqId', () => {
    const useStore = createRfqTableStore(defaultColumns);
    const rfq = { id: 'rfq-1', projectName: 'P1' } as never;
    act(() => useStore.getState().setCopyRfq(rfq));
    expect(useStore.getState().copyRfq).toBe(rfq);

    act(() => useStore.getState().setCopyState('success'));
    expect(useStore.getState().copyState).toBe('success');

    act(() => useStore.getState().setCopiedRfqId('rfq-2'));
    expect(useStore.getState().copiedRfqId).toBe('rfq-2');
  });

  it('deleteSavedView removes view', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => {
      useStore.setState({
        savedViews: [
          { id: 'v1', name: 'V1' },
          { id: 'v2', name: 'V2' },
        ] as never[],
        activeViewId: 'v1',
      });
    });
    act(() => useStore.getState().deleteSavedView('v1'));
    expect(useStore.getState().savedViews).toHaveLength(1);
    expect(useStore.getState().activeViewId).toBeNull();
  });

  it('deleteAllSavedViews clears all', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => {
      useStore.setState({
        savedViews: [{ id: 'v1', name: 'V1' }] as never[],
        activeViewId: 'v1',
      });
    });
    act(() => useStore.getState().deleteAllSavedViews());
    expect(useStore.getState().savedViews).toHaveLength(0);
    expect(useStore.getState().activeViewId).toBeNull();
  });

  it('UI panel toggles', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().setFiltersOpen(true));
    expect(useStore.getState().filtersOpen).toBe(true);
    act(() => useStore.getState().setShowTableMgmt(true));
    expect(useStore.getState().showTableMgmt).toBe(true);
    act(() => useStore.getState().setShowCreateView(true));
    expect(useStore.getState().showCreateView).toBe(true);
    act(() => useStore.getState().setActiveViewId('v1'));
    expect(useStore.getState().activeViewId).toBe('v1');
    act(() => useStore.getState().setPreviewRfqId('rfq-x'));
    expect(useStore.getState().previewRfqId).toBe('rfq-x');
    act(() => useStore.getState().setPreviewOpen(true));
    expect(useStore.getState().previewOpen).toBe(true);
  });

  it('setAdvancedFilters merges filters and resets page', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().setPage(3));
    act(() => useStore.getState().setAdvancedFilters({ status: ['Open'] }));
    expect(useStore.getState().advancedFilters).toEqual(
      expect.objectContaining({ status: ['Open'] }),
    );
    expect(useStore.getState().page).toBe(1);
  });

  it('clearAdvancedFilters resets to empty and resets page', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().setAdvancedFilters({ status: ['Open'] }));
    act(() => useStore.getState().setPage(3));
    act(() => useStore.getState().clearAdvancedFilters());
    expect(useStore.getState().advancedFilters.status).toEqual([]);
    expect(useStore.getState().page).toBe(1);
  });

  it('loadViews fetches and sets saved views', async () => {
    const { getViews } = await import('@forethread/api-client');
    vi.mocked(getViews).mockResolvedValue([
      {
        id: 'v1',
        name: 'View 1',
        visibleColumns: ['col1'],
        columnOrder: ['col1'],
        sortBy: 'col1',
        sortDir: 'asc',
        quickFilter: null,
        groupBy: null,
      },
    ] as never);
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().loadViews());
    await vi.waitFor(() => {
      expect(useStore.getState().savedViews).toHaveLength(1);
    });
    expect(useStore.getState().savedViews[0].name).toBe('View 1');
  });

  it('addSavedView creates optimistic view then updates with server response', async () => {
    const { createView } = await import('@forethread/api-client');
    vi.mocked(createView).mockResolvedValue({
      id: 'server-id',
      name: 'My View',
      visibleColumns: ['col1', 'col2', 'col3'],
      columnOrder: ['col1', 'col2', 'col3'],
      sortBy: 'deadlineRange',
      sortDir: 'asc',
      quickFilter: null,
      groupBy: null,
    } as never);
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().addSavedView('My View'));
    // Optimistic view added
    expect(useStore.getState().savedViews).toHaveLength(1);
    expect(useStore.getState().showCreateView).toBe(false);
    // Wait for server response
    await vi.waitFor(() => {
      expect(useStore.getState().savedViews[0].id).toBe('server-id');
    });
  });

  it('addSavedView updates activeViewId when it matches tempId', async () => {
    const { createView } = await import('@forethread/api-client');
    vi.mocked(createView).mockResolvedValue({
      id: 'server-id-2',
      name: 'Active View',
      visibleColumns: ['col1'],
      columnOrder: ['col1'],
      sortBy: null,
      sortDir: null,
      quickFilter: null,
      groupBy: null,
    } as never);
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().addSavedView('Active View'));
    // Set activeViewId to the temp id
    const tempId = useStore.getState().savedViews[0].id;
    act(() => useStore.setState({ activeViewId: tempId }));
    // Wait for server response to replace tempId
    await vi.waitFor(() => {
      expect(useStore.getState().savedViews[0].id).toBe('server-id-2');
    });
    expect(useStore.getState().activeViewId).toBe('server-id-2');
  });

  it('applyView with non-existent viewId does nothing', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => useStore.getState().applyView('non-existent'));
    expect(useStore.getState().activeViewId).toBeNull();
  });

  it('applyView with view that has empty visibleColumns/columnOrder falls back to defaults', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => {
      useStore.setState({
        savedViews: [
          {
            id: 'v-empty',
            name: 'Empty View',
            visibleColumns: [],
            columnOrder: [],
            sortBy: undefined,
            sortDir: undefined,
            quickFilter: undefined,
            groupBy: undefined,
          },
        ] as never[],
      });
    });
    act(() => useStore.getState().applyView('v-empty'));
    expect(useStore.getState().visibleColumns).toEqual(defaultColumns);
    expect(useStore.getState().columnOrder).toEqual(defaultColumns);
    expect(useStore.getState().sortBy).toBe('deadlineRange');
    expect(useStore.getState().sortDir).toBe('asc');
  });

  it('deleteSavedView keeps activeViewId when deleting a different view', () => {
    const useStore = createRfqTableStore(defaultColumns);
    act(() => {
      useStore.setState({
        savedViews: [
          { id: 'v1', name: 'V1' },
          { id: 'v2', name: 'V2' },
        ] as never[],
        activeViewId: 'v2',
      });
    });
    act(() => useStore.getState().deleteSavedView('v1'));
    expect(useStore.getState().savedViews).toHaveLength(1);
    expect(useStore.getState().activeViewId).toBe('v2');
  });
});
