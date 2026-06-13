import * as apiClient from '@forethread/api-client';
import { toast } from '@forethread/ui-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMaterialFavouriteMutations } from './useMaterialFavouriteMutations';

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof apiClient>();
  return { ...actual, favouriteMaterial: vi.fn(), unfavouriteMaterial: vi.fn() };
});

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedFavourite = apiClient.favouriteMaterial as unknown as ReturnType<typeof vi.fn>;
const mockedUnfavourite = apiClient.unfavouriteMaterial as unknown as ReturnType<typeof vi.fn>;

function listPage(
  items: Partial<apiClient.MaterialListItemDto>[],
): apiClient.PaginatedMaterialsResponse {
  return {
    items: items.map((m) => ({
      id: 'm-1',
      name: 'Cement',
      categoryId: null,
      categoryName: null,
      status: 'PUBLIC',
      createdAt: '',
      updatedAt: '',
      isFavourite: false,
      ...m,
    })) as apiClient.MaterialListItemDto[],
    meta: { page: 1, limit: 25, total: items.length, totalPages: 1 },
  };
}

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const { result } = renderHook(() => useMaterialFavouriteMutations(), { wrapper });
  return { queryClient, result };
}

describe('useMaterialFavouriteMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('favourite() optimistically flips isFavourite to true across cached list pages', async () => {
    mockedFavourite.mockResolvedValue({ success: true });
    const { queryClient, result } = setup();

    const key = apiClient.queryKeys.materials.list({ status: 'PUBLIC' });
    queryClient.setQueryData(key, listPage([{ id: 'm-1', isFavourite: false }]));

    result.current.favourite.mutate('m-1');

    await waitFor(() => {
      const data = queryClient.getQueryData<apiClient.PaginatedMaterialsResponse>(key);
      expect(data?.items[0].isFavourite).toBe(true);
    });
    expect(mockedFavourite).toHaveBeenCalledWith('m-1', { skipErrorHandler: true });
  });

  it('rolls the star back and toasts when favourite() fails', async () => {
    mockedFavourite.mockRejectedValue(new Error('boom'));
    const { queryClient, result } = setup();

    const key = apiClient.queryKeys.materials.list({ status: 'PUBLIC' });
    queryClient.setQueryData(key, listPage([{ id: 'm-1', isFavourite: false }]));

    result.current.favourite.mutate('m-1');

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('favourites.toasts.addFailed'));
    const data = queryClient.getQueryData<apiClient.PaginatedMaterialsResponse>(key);
    expect(data?.items[0].isFavourite).toBe(false);
  });

  it('toggle() calls unfavourite when the material is already favourited', async () => {
    mockedUnfavourite.mockResolvedValue({ success: true });
    const { result } = setup();

    result.current.toggle('m-9', true);

    await waitFor(() =>
      expect(mockedUnfavourite).toHaveBeenCalledWith('m-9', { skipErrorHandler: true }),
    );
    expect(mockedFavourite).not.toHaveBeenCalled();
  });

  it('toggle() calls favourite when the material is not yet favourited', async () => {
    mockedFavourite.mockResolvedValue({ success: true });
    const { result } = setup();

    result.current.toggle('m-9', false);

    await waitFor(() =>
      expect(mockedFavourite).toHaveBeenCalledWith('m-9', { skipErrorHandler: true }),
    );
    expect(mockedUnfavourite).not.toHaveBeenCalled();
  });
});
