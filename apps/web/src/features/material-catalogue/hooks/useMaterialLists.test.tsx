import * as apiClient from '@forethread/api-client';
import { toast } from '@forethread/ui-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMaterialList, useMaterialListMutations, useMaterialLists } from './useMaterialLists';

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof apiClient>();
  return {
    ...actual,
    getMaterialLists: vi.fn(),
    getMaterialList: vi.fn(),
    createMaterialList: vi.fn(),
    updateMaterialList: vi.fn(),
    deleteMaterialList: vi.fn(),
    addMaterialListItems: vi.fn(),
    removeMaterialListItem: vi.fn(),
  };
});

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const m = {
  getLists: apiClient.getMaterialLists as unknown as ReturnType<typeof vi.fn>,
  getList: apiClient.getMaterialList as unknown as ReturnType<typeof vi.fn>,
  create: apiClient.createMaterialList as unknown as ReturnType<typeof vi.fn>,
  update: apiClient.updateMaterialList as unknown as ReturnType<typeof vi.fn>,
  remove: apiClient.deleteMaterialList as unknown as ReturnType<typeof vi.fn>,
  addItems: apiClient.addMaterialListItems as unknown as ReturnType<typeof vi.fn>,
  removeItem: apiClient.removeMaterialListItem as unknown as ReturnType<typeof vi.fn>,
};

function wrapperFactory() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

describe('useMaterialLists hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useMaterialLists fetches summaries with the search param', async () => {
    m.getLists.mockResolvedValue([
      { id: 'l-1', name: 'Steel', description: null, itemCount: 2, updatedAt: '' },
    ]);
    const { wrapper } = wrapperFactory();

    const { result } = renderHook(() => useMaterialLists({ search: 'steel' }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.getLists).toHaveBeenCalledWith({ search: 'steel' });
    expect(result.current.data).toHaveLength(1);
  });

  it('useMaterialLists is disabled when enabled=false', () => {
    const { wrapper } = wrapperFactory();
    const { result } = renderHook(() => useMaterialLists({}, { enabled: false }), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(m.getLists).not.toHaveBeenCalled();
  });

  it('useMaterialList is disabled until an id is present', () => {
    const { wrapper } = wrapperFactory();
    const { result } = renderHook(() => useMaterialList(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(m.getList).not.toHaveBeenCalled();
  });

  it('create mutation invalidates the lists cache and toasts on success', async () => {
    m.create.mockResolvedValue({
      id: 'l-2',
      name: 'New',
      description: null,
      itemCount: 0,
      updatedAt: '',
    });
    const { wrapper, queryClient } = wrapperFactory();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useMaterialListMutations(), { wrapper });
    result.current.create.mutate({ name: 'New' });

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('materialLists.toasts.created'));
    expect(m.create).toHaveBeenCalledWith({ name: 'New' }, { skipErrorHandler: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: apiClient.queryKeys.materialLists.all() });
  });

  it('addItems mutation posts the material ids and toasts on success', async () => {
    m.addItems.mockResolvedValue({ id: 'l-1', name: 'Steel', description: null, items: [] });
    const { wrapper } = wrapperFactory();

    const { result } = renderHook(() => useMaterialListMutations(), { wrapper });
    result.current.addItems.mutate({ id: 'l-1', materialIds: ['m-1', 'm-2'] });

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('materialLists.toasts.itemsAdded'),
    );
    expect(m.addItems).toHaveBeenCalledWith('l-1', ['m-1', 'm-2'], { skipErrorHandler: true });
  });

  it('removeItem mutation deletes the item and toasts on success', async () => {
    m.removeItem.mockResolvedValue({ id: 'l-1', name: 'Steel', description: null, items: [] });
    const { wrapper } = wrapperFactory();

    const { result } = renderHook(() => useMaterialListMutations(), { wrapper });
    result.current.removeItem.mutate({ id: 'l-1', itemId: 'i-9' });

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('materialLists.toasts.itemRemoved'),
    );
    expect(m.removeItem).toHaveBeenCalledWith('l-1', 'i-9', { skipErrorHandler: true });
  });

  it('delete mutation surfaces an error toast on failure', async () => {
    m.remove.mockRejectedValue(new Error('boom'));
    const { wrapper } = wrapperFactory();

    const { result } = renderHook(() => useMaterialListMutations(), { wrapper });
    result.current.remove.mutate('l-1');

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('materialLists.toasts.deleteFailed'),
    );
  });
});
