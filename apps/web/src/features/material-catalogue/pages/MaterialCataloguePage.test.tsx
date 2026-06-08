import * as apiClient from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MaterialCataloguePage from './MaterialCataloguePage';

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof apiClient>();
  return {
    ...actual,
    getMaterials: vi.fn(),
  };
});

const mockedGetMaterials = apiClient.getMaterials as unknown as ReturnType<typeof vi.fn>;

function materialsPage(
  items: Partial<apiClient.MaterialListItemDto>[],
  total = items.length,
): apiClient.PaginatedMaterialsResponse {
  return {
    items: items.map((m, i) => ({
      id: `m-${i}`,
      name: 'Material',
      code: null,
      description: null,
      categoryId: null,
      categoryName: 'Hardware',
      unitOfMeasure: 'EA',
      status: 'PUBLIC',
      createdAt: '2026-06-08T00:00:00.000Z',
      updatedAt: '2026-06-08T00:00:00.000Z',
      uom: 'EA',
      sku: 'SKU-1',
      brand: 'Acme',
      ...m,
    })),
    meta: { page: 1, limit: 25, total, totalPages: Math.max(1, Math.ceil(total / 25)) },
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MaterialCataloguePage />
    </QueryClientProvider>,
  );
}

describe('MaterialCataloguePage', () => {
  beforeEach(() => {
    mockedGetMaterials.mockReset();
  });

  it('renders the catalogue rows from the materials query', async () => {
    mockedGetMaterials.mockResolvedValue(
      materialsPage([{ name: 'Hammer', sku: 'H-1', brand: 'Acme' }]),
    );

    renderPage();

    expect(await screen.findByText('Hammer')).toBeInTheDocument();
    expect(screen.getByText('H-1')).toBeInTheDocument();
  });

  it('shows the empty state when the catalogue has no materials', async () => {
    mockedGetMaterials.mockResolvedValue(materialsPage([], 0));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/catalogue is empty/i)).toBeInTheDocument(),
    );
  });

  it('opens the import modal from the Import catalogue button', async () => {
    mockedGetMaterials.mockResolvedValue(materialsPage([{ name: 'Hammer' }]));

    renderPage();

    await screen.findByText('Hammer');
    fireEvent.click(screen.getByTestId('open-import'));

    expect(screen.getByTestId('catalogue-file-input')).toBeInTheDocument();
  });
});
