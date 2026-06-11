import * as apiClient from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EditMaterialCorePage from './EditMaterialCorePage';

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof apiClient>();
  return {
    ...actual,
    getMaterial: vi.fn(),
    updateMaterial: vi.fn(),
    getMaterialCategories: vi.fn(),
  };
});

const mockedGet = apiClient.getMaterial as unknown as ReturnType<typeof vi.fn>;
const mockedUpdate = apiClient.updateMaterial as unknown as ReturnType<typeof vi.fn>;
const mockedCategories = apiClient.getMaterialCategories as unknown as ReturnType<typeof vi.fn>;

const CATEGORIES = [{ id: 'cat-roofing', name: 'Roofing', parentId: null }];

function material(over: Partial<apiClient.MaterialDetailDto> = {}): apiClient.MaterialDetailDto {
  return {
    id: 'mat-1',
    name: 'Colorbond Roofing Sheet',
    categoryId: 'cat-roofing',
    categoryName: 'Roofing',
    uom: 'sheet',
    upc: 'UPC-1',
    manufacturer: 'BuildTech',
    description: 'A roofing sheet.',
    sku: 'ROOF-007',
    brand: null,
    manufacturerPartNumber: 'MPN-1',
    subCategory: null,
    imageUrl: null,
    materialType: 'Roofing',
    itemType: null,
    countryOfOrigin: 'Australia',
    manufacturerSeriesModel: 'CEM-001',
    gradeClass: 'C24',
    standardNorm: 'EN',
    colourFinish: null,
    size: '123×456',
    pricePerUnit: '42.50',
    currency: 'AUD',
    dimensions: { length: { value: 1200, uom: 'mm' } },
    properties: { fireRating: 'A1' },
    status: 'PUBLIC',
    createdAt: '2025-01-20T00:00:00.000Z',
    updatedAt: '2025-01-20T00:00:00.000Z',
    createdBy: null,
    ...over,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/material-catalogue/mat-1/edit']}>
        <Routes>
          <Route path="/material-catalogue/:id/edit" element={<EditMaterialCorePage />} />
          <Route path="/material-catalogue/:id" element={<div data-testid="detail-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EditMaterialCorePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCategories.mockResolvedValue(CATEGORIES);
  });

  it('prefills the Core Identification form from the loaded material', async () => {
    mockedGet.mockResolvedValue(material());
    renderPage();

    expect(await screen.findByText('Edit Core identification')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('material-form-name')).toHaveValue('Colorbond Roofing Sheet'),
    );
    expect(screen.getByTestId('material-form-price')).toHaveValue('42.50');
  });

  it('submits ONLY the Core-identification fields (no dimensions / properties)', async () => {
    mockedGet.mockResolvedValue(material());
    mockedUpdate.mockResolvedValue(material());
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId('material-form-name')).toHaveValue('Colorbond Roofing Sheet'),
    );

    fireEvent.change(screen.getByTestId('material-form-name'), {
      target: { value: 'Renamed Sheet' },
    });
    fireEvent.click(screen.getByTestId('edit-material-core-submit'));

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1));
    const [id, input] = mockedUpdate.mock.calls[0] as [string, apiClient.UpdateMaterialInput];
    expect(id).toBe('mat-1');
    expect(input.name).toBe('Renamed Sheet');
    expect(input.categoryId).toBe('cat-roofing');
    expect(input.pricePerUnit).toBe(42.5);
    // The Edit-Core page does not own these sections.
    expect(input.dimensions).toBeUndefined();
    expect(input.properties).toBeUndefined();

    await screen.findByTestId('detail-page');
  });

  it('renders a not-found state on error', async () => {
    mockedGet.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
