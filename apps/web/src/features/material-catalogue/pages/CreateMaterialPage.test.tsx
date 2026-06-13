import * as apiClient from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CreateMaterialPage from './CreateMaterialPage';

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof apiClient>();
  return {
    ...actual,
    createMaterial: vi.fn(),
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

const mockedCreate = apiClient.createMaterial as unknown as ReturnType<typeof vi.fn>;
const mockedCategories = apiClient.getMaterialCategories as unknown as ReturnType<typeof vi.fn>;

const CATEGORIES = [
  { id: 'cat-roofing', name: 'Roofing', parentId: null },
  { id: 'cat-cement', name: 'Cement', parentId: null },
];

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/material-catalogue/new']}>
        <Routes>
          <Route path="/material-catalogue/new" element={<CreateMaterialPage />} />
          <Route path="/material-catalogue/:id" element={<div data-testid="detail-page" />} />
          <Route path="/material-catalogue" element={<div data-testid="catalogue-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Open a CustomDropdown by its trigger label, then click the option. */
async function selectDropdownOption(triggerLabel: string, optionLabel: string) {
  const trigger = screen.getByRole('button', { name: new RegExp(triggerLabel, 'i') });
  fireEvent.click(trigger);
  const option = await screen.findByRole('option', { name: optionLabel });
  fireEvent.click(option);
}

async function fillStep1() {
  fireEvent.change(screen.getByTestId('material-form-name'), {
    target: { value: 'Colorbond Roofing Sheet' },
  });
  await selectDropdownOption('Select category', 'Roofing');
  await selectDropdownOption('Select UoM', 'sheet');
  await selectDropdownOption('Select country', 'Australia');
}

describe('CreateMaterialPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: an approver (SA) — create navigates straight to the detail page.
    permissionSet.current = new Set(['material.approve']);
    mockedCategories.mockResolvedValue(CATEGORIES);
  });

  it('renders step 1 (Core Identification) first', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Core Identification' })).toBeInTheDocument();
    expect(screen.getByTestId('create-material-continue')).toBeInTheDocument();
  });

  it('blocks advancing past step 1 until the required fields are filled', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Core Identification' });

    // No required fields → still on step 1 (the Dimensions card is not shown).
    fireEvent.click(screen.getByTestId('create-material-continue'));
    await waitFor(() => {
      expect(screen.getByText('Material name is required')).toBeInTheDocument();
    });
    expect(screen.queryByText('Dimensions')).not.toBeInTheDocument();
  });

  it('advances through all three steps and submits a mapped create payload', async () => {
    mockedCreate.mockResolvedValue({ id: 'mat-99' } as apiClient.MaterialDetailDto);
    renderPage();
    await screen.findByRole('heading', { name: 'Core Identification' });

    await fillStep1();
    fireEvent.click(screen.getByTestId('create-material-continue'));

    // Step 2 — Details. Fill one dimension value + uom and a specific-data field.
    await screen.findByText('Dimensions');
    fireEvent.change(screen.getByTestId('material-form-dim-length'), {
      target: { value: '1200' },
    });
    fireEvent.change(screen.getByTestId('material-form-compressive-strength'), {
      target: { value: '40MPa' },
    });
    fireEvent.click(screen.getByTestId('create-material-continue'));

    // Step 3 — Review. The entered values surface read-only.
    await screen.findByTestId('material-review-core');
    const coreCard = screen.getByTestId('material-review-core');
    expect(within(coreCard).getByText('Colorbond Roofing Sheet')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('create-material-submit'));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    const payload = mockedCreate.mock.calls[0][0] as apiClient.CreateMaterialInput;
    expect(payload).toMatchObject({
      name: 'Colorbond Roofing Sheet',
      categoryId: 'cat-roofing',
      uom: 'sheet',
      countryOfOrigin: 'Australia',
    });
    // Numeric strings parsed to numbers; dimension projected to { value, uom }.
    expect(payload.dimensions?.length?.value).toBe(1200);
    expect(payload.properties).toMatchObject({ compressiveStrength: '40MPa' });
    // Empty optional dimension axes are pruned.
    expect(payload.dimensions?.width).toBeUndefined();

    // Navigates to the new material's detail page on success.
    await screen.findByTestId('detail-page');
  });

  it('shows the "added to private catalogue" success modal for a contributor (CA / PO)', async () => {
    permissionSet.current = new Set(['material.create']);
    mockedCreate.mockResolvedValue({ id: 'mat-99' } as apiClient.MaterialDetailDto);
    renderPage();
    await screen.findByRole('heading', { name: 'Core Identification' });

    await fillStep1();
    fireEvent.click(screen.getByTestId('create-material-continue'));
    await screen.findByText('Dimensions');
    fireEvent.click(screen.getByTestId('create-material-continue'));

    await screen.findByTestId('material-review-core');
    fireEvent.click(screen.getByTestId('create-material-submit'));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('catalogue-success-contribute')).toBeInTheDocument();
    expect(screen.getByText('Material added to private catalogue')).toBeInTheDocument();
    // The detail page is NOT shown; the modal owns the redirect to the catalogue.
    expect(screen.queryByTestId('detail-page')).not.toBeInTheDocument();
  });

  it('lets the review "Edit" link jump back to step 1', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Core Identification' });
    await fillStep1();
    fireEvent.click(screen.getByTestId('create-material-continue'));
    await screen.findByText('Dimensions');
    fireEvent.click(screen.getByTestId('create-material-continue'));

    await screen.findByTestId('material-review-edit-core');
    fireEvent.click(screen.getByTestId('material-review-edit-core'));

    // Back on step 1 — the Core Identification card heading is shown again.
    expect(await screen.findByRole('heading', { name: 'Core Identification' })).toBeInTheDocument();
    expect(screen.queryByTestId('material-review-core')).not.toBeInTheDocument();
  });
});
