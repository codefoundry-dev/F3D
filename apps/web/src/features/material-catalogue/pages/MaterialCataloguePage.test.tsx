import * as apiClient from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MaterialCataloguePage from './MaterialCataloguePage';

// ── Mocks ──────────────────────────────────────────────────────────────
vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof apiClient>();
  return {
    ...actual,
    getMaterials: vi.fn(),
    getMaterialCategories: vi.fn(),
    getMaterialSuggestions: vi.fn(),
    approveMaterial: vi.fn(),
    rejectMaterial: vi.fn(),
    archiveMaterial: vi.fn(),
    restoreMaterial: vi.fn(),
    deleteMaterial: vi.fn(),
  };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
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

const mockedGetMaterials = apiClient.getMaterials as unknown as ReturnType<typeof vi.fn>;
const mockedGetCategories = apiClient.getMaterialCategories as unknown as ReturnType<typeof vi.fn>;
const mockedGetSuggestions = apiClient.getMaterialSuggestions as unknown as ReturnType<
  typeof vi.fn
>;
const mockedArchive = apiClient.archiveMaterial as unknown as ReturnType<typeof vi.fn>;

function suggestion(
  over: Partial<apiClient.MaterialSuggestionDto> = {},
): apiClient.MaterialSuggestionDto {
  return {
    id: 's-1',
    name: 'Paint Primer White 5-Gal',
    categoryName: 'Paint & coatings',
    uom: 'gal',
    description: 'Interior/exterior primer',
    imageUrl: null,
    ...over,
  };
}

function listItem(over: Partial<apiClient.MaterialListItemDto>): apiClient.MaterialListItemDto {
  return {
    id: 'm-1',
    name: 'Portland Cement',
    categoryId: 'c-1',
    categoryName: 'Concrete & cement',
    status: 'PUBLIC',
    createdAt: '2026-03-28T00:00:00.000Z',
    updatedAt: '2026-03-28T00:00:00.000Z',
    uom: 'bag',
    upc: 'CEM-001',
    manufacturer: 'LafargeHolcim',
    materialType: 'Cement',
    countryOfOrigin: 'Australia',
    pricePerUnit: '12.50',
    currency: 'USD',
    imageUrl: null,
    ...over,
  };
}

function page(
  items: Partial<apiClient.MaterialListItemDto>[],
  total = items.length,
): apiClient.PaginatedMaterialsResponse {
  return {
    items: items.map((m) => listItem(m)),
    meta: { page: 1, limit: 25, total, totalPages: Math.max(1, Math.ceil(total / 25)) },
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MaterialCataloguePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MaterialCataloguePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionSet.current = new Set();
    window.localStorage.clear();
    mockedGetCategories.mockResolvedValue([
      { id: 'c-1', name: 'Concrete & cement', parentId: null },
    ]);
    mockedGetSuggestions.mockResolvedValue({
      results: [],
      frequentlyUsed: [],
      recentlyUsed: [],
    });
  });

  it('renders the table rows from the materials query', async () => {
    mockedGetMaterials.mockResolvedValue(page([{ name: 'Portland Cement', upc: 'CEM-001' }]));

    renderPage();

    expect(await screen.findByText('Portland Cement')).toBeInTheDocument();
    expect(screen.getByText('CEM-001')).toBeInTheDocument();
    // Price formatted with currency symbol.
    expect(screen.getByText('$12.50')).toBeInTheDocument();
  });

  it('hides the Pending and Archived tabs without material.approve', async () => {
    mockedGetMaterials.mockResolvedValue(page([{ name: 'Portland Cement' }]));

    renderPage();
    await screen.findByText('Portland Cement');

    expect(screen.getByTestId('material-tab-public')).toBeInTheDocument();
    expect(screen.queryByTestId('material-tab-pending')).not.toBeInTheDocument();
    expect(screen.queryByTestId('material-tab-archived')).not.toBeInTheDocument();
  });

  it('shows the approval tabs and pending cards with material.approve', async () => {
    permissionSet.current = new Set(['material.approve']);
    mockedGetMaterials.mockImplementation((params?: apiClient.MaterialListQueryParams) => {
      if (params?.status === 'PENDING_APPROVAL') {
        return Promise.resolve(
          page([{ id: 'p-1', name: 'Fibre Cement Cladding', status: 'PENDING_APPROVAL' }]),
        );
      }
      return Promise.resolve(page([{ name: 'Portland Cement' }]));
    });

    renderPage();
    await screen.findByText('Portland Cement');

    expect(screen.getByTestId('material-tab-pending')).toBeInTheDocument();
    expect(screen.getByTestId('material-tab-archived')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('material-tab-pending'));

    expect(await screen.findByTestId('pending-list')).toBeInTheDocument();
    expect(screen.getByText('Fibre Cement Cladding')).toBeInTheDocument();
  });

  it('hides the row kebab actions when archive/delete permissions are absent', async () => {
    mockedGetMaterials.mockResolvedValue(page([{ id: 'm-1', name: 'Portland Cement' }]));

    renderPage();
    await screen.findByText('Portland Cement');

    // No kebab (Actions menu) without archive/delete, but View is always present.
    expect(screen.getByTestId('material-view-m-1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Actions')).not.toBeInTheDocument();
    expect(screen.queryByTestId('material-edit-m-1')).not.toBeInTheDocument();
  });

  it('opens the archive confirm modal and calls the mutation on confirm', async () => {
    permissionSet.current = new Set(['material.archive']);
    mockedGetMaterials.mockResolvedValue(page([{ id: 'm-1', name: 'Portland Cement' }]));
    mockedArchive.mockResolvedValue(listItem({ id: 'm-1', status: 'ARCHIVED' }));

    renderPage();
    await screen.findByText('Portland Cement');

    fireEvent.click(screen.getByLabelText('Actions'));
    fireEvent.click(await screen.findByText('Archive'));

    const modal = await screen.findByTestId('confirm-material-modal');
    expect(within(modal).getByText('Archive Material')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-material-action'));

    await waitFor(() => expect(mockedArchive).toHaveBeenCalledWith('m-1', expect.anything()));
  });

  it('shows the create + upload buttons gated by permissions', async () => {
    permissionSet.current = new Set(['material.create', 'material.import']);
    mockedGetMaterials.mockResolvedValue(page([{ name: 'Portland Cement' }]));

    renderPage();
    await screen.findByText('Portland Cement');

    expect(screen.getByTestId('material-create')).toBeInTheDocument();
    expect(screen.getByTestId('material-upload')).toBeInTheDocument();
  });

  it('renders the facet filters as dropdowns sourced from the catalogue (US 4.04)', async () => {
    mockedGetMaterials.mockResolvedValue(
      page([
        { id: 'm-1', name: 'Portland Cement', manufacturer: 'LafargeHolcim', uom: 'bag' },
        { id: 'm-2', name: 'Rebar', manufacturer: 'Nucor Steel', uom: 'ton' },
      ]),
    );

    renderPage();
    await screen.findByText('Portland Cement');

    // All five facets are <select> dropdowns, not free-text inputs.
    const manufacturer = screen.getByTestId('filter-manufacturer');
    expect(manufacturer.tagName).toBe('SELECT');
    // Options are the sorted-unique manufacturers derived from the facets fetch.
    expect(within(manufacturer).getByRole('option', { name: 'LafargeHolcim' })).toBeInTheDocument();
    expect(within(manufacturer).getByRole('option', { name: 'Nucor Steel' })).toBeInTheDocument();

    const uom = screen.getByTestId('filter-uom');
    expect(uom.tagName).toBe('SELECT');
    expect(within(uom).getByRole('option', { name: 'bag' })).toBeInTheDocument();
    expect(within(uom).getByRole('option', { name: 'ton' })).toBeInTheDocument();
  });

  it('opens the search dropdown with grouped suggestions when the input is focused', async () => {
    mockedGetMaterials.mockResolvedValue(page([{ name: 'Portland Cement' }]));
    mockedGetSuggestions.mockResolvedValue({
      results: [suggestion({ id: 's-1', name: 'Paint Primer White 5-Gal' })],
      frequentlyUsed: [],
      recentlyUsed: [],
    });

    renderPage();
    await screen.findByText('Portland Cement');

    const input = screen.getByTestId('material-search');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'paint' } });

    expect(await screen.findByTestId('material-search-dropdown')).toBeInTheDocument();
    expect(await screen.findByText('Paint Primer White 5-Gal')).toBeInTheDocument();
    await waitFor(() => expect(mockedGetSuggestions).toHaveBeenCalledWith({ q: 'paint' }));
  });

  it('navigates to the material detail when a search result is selected', async () => {
    mockedGetMaterials.mockResolvedValue(page([{ name: 'Portland Cement' }]));
    mockedGetSuggestions.mockResolvedValue({
      results: [suggestion({ id: 's-9', name: 'Paint Primer White 5-Gal' })],
      frequentlyUsed: [],
      recentlyUsed: [],
    });

    renderPage();
    await screen.findByText('Portland Cement');

    const input = screen.getByTestId('material-search');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'paint' } });

    const result = await screen.findByTestId('material-search-result-s-9');
    fireEvent.mouseDown(result);

    expect(mockNavigate).toHaveBeenCalledWith('/material-catalogue/s-9');
  });

  it('shows the no-results empty state when a committed search returns zero rows (US 4.04)', async () => {
    // Default (empty) page for the search query; a row for the initial load.
    mockedGetMaterials.mockImplementation((params?: apiClient.MaterialListQueryParams) => {
      if (params?.search === 'zzz') return Promise.resolve(page([]));
      return Promise.resolve(page([{ name: 'Portland Cement' }]));
    });

    renderPage();
    await screen.findByText('Portland Cement');

    fireEvent.change(screen.getByTestId('material-search'), { target: { value: 'zzz' } });

    const empty = await screen.findByTestId('material-no-results');
    expect(empty).toHaveTextContent('No results found');
    expect(empty).toHaveTextContent('matching "zzz"');
    // Table + pagination are replaced by the empty state.
    expect(screen.queryByTestId('material-table')).not.toBeInTheDocument();
  });
});
