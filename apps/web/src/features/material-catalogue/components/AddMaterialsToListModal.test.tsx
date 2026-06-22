import * as apiClient from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddMaterialsToListModal } from './AddMaterialsToListModal';

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof apiClient>();
  return {
    ...actual,
    getMaterials: vi.fn(),
    getMaterialFacets: vi.fn(),
    addMaterialListItems: vi.fn(),
  };
});

const mockedGetMaterials = apiClient.getMaterials as unknown as ReturnType<typeof vi.fn>;
const mockedGetFacets = apiClient.getMaterialFacets as unknown as ReturnType<typeof vi.fn>;
const mockedAddItems = apiClient.addMaterialListItems as unknown as ReturnType<typeof vi.fn>;

function materialsPage(
  items: Partial<apiClient.MaterialListItemDto>[],
): apiClient.PaginatedMaterialsResponse {
  return {
    items: items.map((over, i) => ({
      id: `m-${i + 1}`,
      name: `Material ${i + 1}`,
      categoryId: null,
      categoryName: 'Cement',
      status: 'PUBLIC',
      createdAt: '',
      updatedAt: '',
      manufacturer: 'BuildTech',
      uom: 'bag',
      ...over,
    })) as apiClient.MaterialListItemDto[],
    meta: { page: 1, limit: 25, total: items.length, totalPages: 1 },
  };
}

function renderModal(over: { existing?: string[]; onClose?: () => void } = {}) {
  const onClose = over.onClose ?? vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AddMaterialsToListModal
        listId="l-1"
        existingMaterialIds={over.existing ?? []}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return { onClose };
}

describe('AddMaterialsToListModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetFacets.mockResolvedValue({
      manufacturers: [],
      uoms: [],
      materialTypes: [],
      countriesOfOrigin: [],
    });
  });

  it('lists catalogue rows to browse, excluding materials already in the list', async () => {
    mockedGetMaterials.mockResolvedValue(materialsPage([{}, {}, {}]));
    renderModal({ existing: ['m-2'] });

    expect(await screen.findByTestId('add-materials-row-m-1')).toBeInTheDocument();
    expect(screen.getByTestId('add-materials-row-m-3')).toBeInTheDocument();
    // m-2 is already in the list, so it is filtered out of the browse view.
    expect(screen.queryByTestId('add-materials-row-m-2')).not.toBeInTheDocument();
  });

  it('Submit is disabled until something is selected, then submits selected ids', async () => {
    mockedGetMaterials.mockResolvedValue(materialsPage([{}, {}]));
    mockedAddItems.mockResolvedValue({ id: 'l-1', name: 'L', description: null, items: [] });
    const { onClose } = renderModal();

    await screen.findByTestId('add-materials-row-m-1');
    expect(screen.getByTestId('add-materials-submit')).toBeDisabled();

    fireEvent.click(screen.getByTestId('add-materials-select-m-1'));
    fireEvent.click(screen.getByTestId('add-materials-select-m-2'));

    // Selected count reflects the picks.
    expect(screen.getByText('Selected items (2)')).toBeInTheDocument();
    expect(screen.getByTestId('add-materials-submit')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('add-materials-submit'));
    await waitFor(() =>
      expect(mockedAddItems).toHaveBeenCalledWith('l-1', expect.arrayContaining(['m-1', 'm-2']), {
        skipErrorHandler: true,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('the View toggle switches to the selected list where items can be deselected', async () => {
    mockedGetMaterials.mockResolvedValue(materialsPage([{}, {}]));
    renderModal();

    await screen.findByTestId('add-materials-row-m-1');
    fireEvent.click(screen.getByTestId('add-materials-select-m-1'));

    fireEvent.click(screen.getByTestId('add-materials-toggle-view'));
    expect(screen.getByTestId('add-materials-selected')).toBeInTheDocument();

    // Deselect from the selected view → count returns to 0.
    fireEvent.click(screen.getByTestId('add-materials-deselect-m-1'));
    expect(screen.getByText('Selected items (0)')).toBeInTheDocument();
  });
});
