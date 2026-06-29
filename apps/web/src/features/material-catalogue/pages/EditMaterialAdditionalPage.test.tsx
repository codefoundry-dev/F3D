import * as apiClient from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EditMaterialAdditionalPage from './EditMaterialAdditionalPage';

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof apiClient>();
  return {
    ...actual,
    getMaterial: vi.fn(),
    updateMaterial: vi.fn(),
    getMaterialCategories: vi.fn(),
  };
});

const permissionSet = { current: new Set<string>() };
vi.mock('@/shared/role', () => ({
  usePermissions: () => ({
    permissions: permissionSet.current,
    has: (k: string) => permissionSet.current.has(k),
    hasAll: (keys: string[]) => keys.every((k) => permissionSet.current.has(k)),
    hasAny: (keys: string[]) => keys.some((k) => permissionSet.current.has(k)),
  }),
}));

const mockedGet = apiClient.getMaterial as unknown as ReturnType<typeof vi.fn>;
const mockedUpdate = apiClient.updateMaterial as unknown as ReturnType<typeof vi.fn>;
const mockedCategories = apiClient.getMaterialCategories as unknown as ReturnType<typeof vi.fn>;

function material(over: Partial<apiClient.MaterialDetailDto> = {}): apiClient.MaterialDetailDto {
  return {
    id: 'mat-1',
    name: 'Colorbond Roofing Sheet',
    categoryId: 'cat-roofing',
    categoryName: 'Roofing',
    uom: 'sheet',
    upc: null,
    manufacturer: null,
    description: null,
    sku: null,
    brand: null,
    manufacturerPartNumber: null,
    subCategory: null,
    imageUrl: null,
    materialType: null,
    itemType: null,
    countryOfOrigin: 'Australia',
    manufacturerSeriesModel: null,
    gradeClass: null,
    standardNorm: null,
    colourFinish: null,
    size: null,
    pricePerUnit: null,
    currency: 'AUD',
    costCode: null,
    taxCode: null,
    dimensions: {
      length: { value: 1200, uom: 'mm' },
      packaging: { packagingUnit: 'box', unitsPerPackage: 10, weightPerPackage: null },
    },
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
      <MemoryRouter initialEntries={['/material-catalogue/mat-1/edit/additional']}>
        <Routes>
          <Route
            path="/material-catalogue/:id/edit/additional"
            element={<EditMaterialAdditionalPage />}
          />
          <Route path="/material-catalogue/:id" element={<div data-testid="detail-page" />} />
          <Route path="/material-catalogue" element={<div data-testid="catalogue-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EditMaterialAdditionalPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: an approver (SA) — a direct edit that navigates to the detail page.
    permissionSet.current = new Set(['material.approve']);
    mockedCategories.mockResolvedValue([]);
  });

  it('prefills the Dimensions / Specific-data fields from the loaded material', async () => {
    mockedGet.mockResolvedValue(material());
    renderPage();

    expect(await screen.findByText('Edit Additional Properties')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('material-form-dim-length')).toHaveValue('1200'));
    expect(screen.getByTestId('material-form-units-per-package')).toHaveValue('10');
    expect(screen.getByTestId('material-form-compressive-strength')).toHaveValue('');
  });

  it('submits ONLY the dimensions + properties sections (no core fields)', async () => {
    mockedGet.mockResolvedValue(material());
    mockedUpdate.mockResolvedValue(material());
    renderPage();

    await waitFor(() => expect(screen.getByTestId('material-form-dim-length')).toHaveValue('1200'));

    fireEvent.change(screen.getByTestId('material-form-dim-length'), {
      target: { value: '1500' },
    });
    fireEvent.change(screen.getByTestId('material-form-compressive-strength'), {
      target: { value: '40MPa' },
    });
    fireEvent.click(screen.getByTestId('edit-material-additional-submit'));

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1));
    const [id, input] = mockedUpdate.mock.calls[0] as [string, apiClient.UpdateMaterialInput];
    expect(id).toBe('mat-1');
    // Only the Additional-properties sections are sent.
    expect(Object.keys(input).sort()).toEqual(['dimensions', 'properties']);
    expect(input.dimensions?.length).toMatchObject({ value: 1500, uom: 'mm' });
    expect(input.dimensions?.packaging).toMatchObject({
      packagingUnit: 'box',
      unitsPerPackage: 10,
    });
    expect(input.properties).toMatchObject({ fireRating: 'A1', compressiveStrength: '40MPa' });
    // No core field leaks into the payload.
    expect(input.name).toBeUndefined();
    expect(input.categoryId).toBeUndefined();

    await screen.findByTestId('detail-page');
  });

  it('shows the "Changes submitted for review" modal when a contributor edits a PUBLIC material', async () => {
    permissionSet.current = new Set(['material.update']);
    mockedGet.mockResolvedValue(material({ status: 'PUBLIC' }));
    mockedUpdate.mockResolvedValue(material({ status: 'PUBLIC' }));
    renderPage();

    await waitFor(() => expect(screen.getByTestId('material-form-dim-length')).toHaveValue('1200'));
    fireEvent.click(screen.getByTestId('edit-material-additional-submit'));

    expect(await screen.findByTestId('catalogue-success-changeSubmitted')).toBeInTheDocument();
    expect(screen.queryByTestId('detail-page')).not.toBeInTheDocument();
  });
});
