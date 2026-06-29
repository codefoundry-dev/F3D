import * as apiClient from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MaterialDetailPage from './MaterialDetailPage';

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof apiClient>();
  return { ...actual, getMaterial: vi.fn() };
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

const mockedGetMaterial = apiClient.getMaterial as unknown as ReturnType<typeof vi.fn>;

function detail(over: Partial<apiClient.MaterialDetailDto> = {}): apiClient.MaterialDetailDto {
  return {
    id: 'mat-1',
    name: 'Colorbond Roofing Sheet 0.42mm',
    categoryId: 'c-1',
    categoryName: 'Roofing',
    uom: 'sheet',
    upc: 'CB-ROOF-0.42-SURF',
    manufacturer: 'Manufacturer / Brand',
    description: 'Colorbond steel roofing sheet, 0.42mm BMT.',
    sku: 'MAT-2025-0007',
    brand: 'Brand',
    manufacturerPartNumber: '1234567',
    subCategory: null,
    imageUrl: null,
    materialType: 'Roofing',
    itemType: 'Item type',
    countryOfOrigin: 'Australia',
    manufacturerSeriesModel: 'CEM-001',
    gradeClass: 'C24',
    standardNorm: null,
    colourFinish: 'Colour name',
    size: '123×456×123',
    pricePerUnit: '42.50',
    currency: 'AUD',
    costCode: null,
    taxCode: null,
    dimensions: {
      length: { value: 123456, uom: null },
      width: { value: 123456, uom: null },
      packaging: {
        unitsPerPackage: 12345678,
        packagingUnit: 'Packaging unit',
        weightPerPackage: 12345678,
      },
    },
    properties: { compressiveStrength: 12345678, fireRating: '1234' },
    status: 'PUBLIC',
    createdAt: '2025-01-20T00:00:00.000Z',
    updatedAt: '2025-01-20T00:00:00.000Z',
    createdBy: { id: 'u-1', name: 'Sarah Chen' },
    ...over,
  };
}

function renderDetail() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/material-catalogue/mat-1']}>
        <Routes>
          <Route path="/material-catalogue/:id" element={<MaterialDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MaterialDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionSet.current = new Set();
  });

  it('renders core identification and additional properties', async () => {
    mockedGetMaterial.mockResolvedValue(detail());

    renderDetail();

    expect(
      await screen.findByRole('heading', { name: 'Colorbond Roofing Sheet 0.42mm', level: 1 }),
    ).toBeInTheDocument();
    // Internal id (sku) shows under the title and as a field.
    expect(screen.getAllByText('MAT-2025-0007').length).toBeGreaterThan(0);
    // Core fields (Roofing appears as both category and material type).
    expect(screen.getAllByText('Roofing').length).toBeGreaterThan(0);
    expect(screen.getByText('Australia')).toBeInTheDocument();
    expect(screen.getByText('CB-ROOF-0.42-SURF')).toBeInTheDocument();
    // Additional properties — humanized property key.
    expect(screen.getByText('Fire rating')).toBeInTheDocument();
    expect(screen.getByText('Compressive strength')).toBeInTheDocument();
  });

  it('hides the Edit buttons without material.update', async () => {
    mockedGetMaterial.mockResolvedValue(detail());

    renderDetail();
    await screen.findByRole('heading', { name: 'Colorbond Roofing Sheet 0.42mm', level: 1 });

    expect(screen.queryByTestId('material-detail-edit')).not.toBeInTheDocument();
  });

  it('shows Edit when material.update is granted', async () => {
    permissionSet.current = new Set(['material.update']);
    mockedGetMaterial.mockResolvedValue(detail());

    renderDetail();
    await screen.findByRole('heading', { name: 'Colorbond Roofing Sheet 0.42mm', level: 1 });

    expect(screen.getAllByTestId('material-detail-edit').length).toBeGreaterThan(0);
  });

  it('renders a not-found state on error', async () => {
    mockedGetMaterial.mockRejectedValue(new Error('boom'));

    renderDetail();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
