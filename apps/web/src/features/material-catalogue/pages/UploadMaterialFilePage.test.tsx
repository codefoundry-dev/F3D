import * as apiClient from '@forethread/api-client';
import { notificationService } from '@forethread/ui-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import UploadMaterialFilePage from './UploadMaterialFilePage';

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof apiClient>();
  return {
    ...actual,
    createDocExtraction: vi.fn(),
    getDocExtractionSummary: vi.fn(),
    getDocExtractionItems: vi.fn(),
    applyDocExtractionItemOps: vi.fn(),
    updateDocExtraction: vi.fn(),
    importCatalogue: vi.fn(),
    detectMaterialDuplicates: vi.fn(),
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

const mockedCreate = apiClient.createDocExtraction as unknown as ReturnType<typeof vi.fn>;
const mockedSummary = apiClient.getDocExtractionSummary as unknown as ReturnType<typeof vi.fn>;
const mockedItems = apiClient.getDocExtractionItems as unknown as Mock<
  (...args: never[]) => unknown
>;
const mockedOps = apiClient.applyDocExtractionItemOps as unknown as ReturnType<typeof vi.fn>;
const mockedUpdate = apiClient.updateDocExtraction as unknown as ReturnType<typeof vi.fn>;
const mockedImport = apiClient.importCatalogue as unknown as ReturnType<typeof vi.fn>;
const mockedDetect = apiClient.detectMaterialDuplicates as unknown as ReturnType<typeof vi.fn>;

function lineItem(over: Partial<apiClient.MaterialDetailDto> & { name: string }) {
  return {
    name: over.name,
    sku: null,
    materialCode: null,
    brand: 'LafargeHolcim',
    manufacturer: 'Eaton',
    manufacturerPartNumber: null,
    upc: '123456789',
    uom: 'units',
    description: 'Lorem',
    mainCategory: 'Concrete & cement',
    subCategory: null,
    materialType: 'Industrial',
    countryOfOrigin: 'Australia',
    pricePerUnit: 12.5,
    costCode: 'CC-400',
    taxCode: 'GST',
    imageUrl: null,
    confidence: 1,
  };
}

/** Summary-view poll response — the result payload never reaches the client. */
function summaryJob(
  itemCount: number,
  overrides: Partial<apiClient.DocExtractionResponse> = {},
): apiClient.DocExtractionResponse {
  return {
    id: 'job-1',
    type: 'CATALOGUE',
    status: 'COMPLETED',
    file: { id: 'f-1', filename: 'catalogue.xlsx', mimeType: 'application/octet-stream', size: 99 },
    rawResult: null,
    editedResult: null,
    resultSummary: { itemCount, sourceName: 'catalogue.xlsx', notes: null },
    errorCode: null,
    errorMessage: null,
    model: null,
    usage: null,
    createdByUserId: 'u-1',
    lastEditedByUserId: null,
    confirmedByUserId: null,
    companyId: 'c-1',
    createdAt: '2026-07-27T00:00:00.000Z',
    updatedAt: '2026-07-27T00:00:00.000Z',
    completedAt: '2026-07-27T00:00:00.000Z',
    lastEditedAt: null,
    confirmedAt: null,
    ...overrides,
  } as apiClient.DocExtractionResponse;
}

/** Serve windows of `fixture` the way the backend does (page mode + indexes mode). */
function serveItemsFrom(fixture: ReturnType<typeof lineItem>[]) {
  mockedItems.mockImplementation(
    (_id: string, params: { page?: number; limit?: number; indexes?: number[] }) => {
      if (params.indexes && params.indexes.length > 0) {
        const wanted = [...new Set(params.indexes)]
          .sort((a, b) => a - b)
          .filter((i) => i < fixture.length);
        return Promise.resolve({
          items: wanted.map((i) => fixture[i]),
          indexes: wanted,
          meta: { page: 1, limit: wanted.length, total: wanted.length, totalPages: 1 },
        });
      }
      const page = params.page ?? 1;
      const limit = params.limit ?? 50;
      const start = (page - 1) * limit;
      const slice = fixture.slice(start, start + limit);
      return Promise.resolve({
        items: slice,
        indexes: slice.map((_, i) => start + i),
        meta: {
          page,
          limit,
          total: fixture.length,
          totalPages: Math.max(1, Math.ceil(fixture.length / limit)),
        },
      });
    },
  );
}

function renderPage(node: ReactNode = <UploadMaterialFilePage />) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function selectFile(filename: string, sizeBytes = 100) {
  const file = new File(['x'], filename, { type: 'application/octet-stream' });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  fireEvent.change(screen.getByTestId('upload-file-input'), { target: { files: [file] } });
}

/** Upload a valid file and wait for Step 2's first row window to render. */
async function reachStep2() {
  renderPage();
  selectFile('catalogue.xlsx');
  fireEvent.click(screen.getByTestId('upload-proceed'));
  await screen.findByTestId('map-table');
  // The row window arrives async from the items endpoint.
  await screen.findByTestId('map-row-0');
}

const TWO_ITEMS = [
  lineItem({ name: 'Portland Cement Type I' }),
  lineItem({ name: 'Type I Masonry Cement' }),
];

describe('UploadMaterialFilePage', () => {
  beforeEach(() => {
    mockedCreate.mockReset();
    mockedSummary.mockReset();
    mockedItems.mockReset();
    mockedOps.mockReset();
    mockedUpdate.mockReset();
    mockedImport.mockReset();
    mockedDetect.mockReset();
    mockNavigate.mockReset();
    permissionSet.current = new Set();
    mockedCreate.mockResolvedValue(summaryJob(0, { status: 'PROCESSING', resultSummary: null }));
    mockedSummary.mockResolvedValue(summaryJob(TWO_ITEMS.length));
    mockedDetect.mockResolvedValue({ results: [] });
    mockedOps.mockResolvedValue({ itemCount: TWO_ITEMS.length });
    serveItemsFrom(TWO_ITEMS);
    vi.spyOn(notificationService, 'success').mockImplementation(() => 'id');
    vi.spyOn(notificationService, 'error').mockImplementation(() => 'id');
  });

  it('tells a company user their import lands in the private company catalogue', () => {
    renderPage();

    expect(screen.getByTestId('upload-destination')).toHaveTextContent(
      "your company's private catalogue",
    );
    expect(screen.getByTestId('upload-destination')).not.toHaveTextContent(
      'shared global catalogue',
    );
  });

  it('tells the catalogue approver their import publishes to the global catalogue', () => {
    permissionSet.current = new Set(['material.approve']);
    renderPage();

    expect(screen.getByTestId('upload-destination')).toHaveTextContent('shared global catalogue');
  });

  it('rejects an unsupported file type client-side without uploading', () => {
    renderPage();
    selectFile('catalogue.csv');

    expect(screen.getByTestId('upload-file-error')).toBeInTheDocument();
    expect(mockedCreate).not.toHaveBeenCalled();
    // Proceed stays disabled with no valid file.
    expect(screen.getByTestId('upload-proceed')).toBeDisabled();
  });

  it('advances upload → map → review, detecting duplicates by extractionId', async () => {
    // Row index 1 collides with an existing material.
    mockedDetect.mockResolvedValue({
      results: [
        { index: 0, matches: [] },
        {
          index: 1,
          matches: [
            {
              id: 'm-41',
              name: 'Concrete Block 390x190',
              code: 'MAT-00041',
              status: 'PUBLIC',
              matchedOn: ['name'],
            },
          ],
        },
      ],
    });

    await reachStep2();

    expect(mockedCreate.mock.calls[0][0]).toBe('CATALOGUE');
    // The poll never downloads the result — detection runs server-side.
    expect(mockedDetect).toHaveBeenCalledWith({ extractionId: 'job-1' }, expect.anything());

    await screen.findByTestId('map-duplicate-banner');
    expect(screen.getByTestId('map-row-1')).toHaveAttribute('data-duplicate', 'true');
    expect(screen.getByTestId('map-row-0')).not.toHaveAttribute('data-duplicate');
    // The duplicate row exposes a clone action; non-duplicate rows do not.
    expect(screen.getByTestId('map-duplicate-row-1')).toBeInTheDocument();
    expect(screen.queryByTestId('map-duplicate-row-0')).not.toBeInTheDocument();

    // Step 2 → Step 3.
    fireEvent.click(screen.getByTestId('upload-continue'));
    await screen.findByTestId('review-list');
    expect(screen.getByTestId('review-duplicate-banner')).toBeInTheDocument();
    await screen.findByTestId('review-duplicate-strip-1');
    expect(screen.queryByTestId('review-duplicate-strip-0')).not.toBeInTheDocument();
  });

  it('imports without any writeback when no rows were edited', async () => {
    mockedImport.mockResolvedValue({
      total: 2,
      created: 2,
      updated: 0,
      skipped: 0,
      categoriesCreated: 1,
      // Super-Admin import: published to the shared catalogue, no list.
      materialList: null,
    });

    await reachStep2();
    fireEvent.click(screen.getByTestId('upload-continue'));
    await screen.findByTestId('review-list');
    fireEvent.click(screen.getByTestId('upload-add'));

    await waitFor(() =>
      expect(mockedImport).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({ timeout: 300000 }),
      ),
    );
    // No edits → nothing flushed, and the legacy whole-draft PATCH is gone.
    expect(mockedOps).not.toHaveBeenCalled();
    expect(mockedUpdate).not.toHaveBeenCalled();
    await waitFor(() => expect(notificationService.success).toHaveBeenCalledTimes(1));
    expect(mockNavigate).toHaveBeenCalledWith('/material-catalogue');
  });

  it('flushes a cell edit as a sparse row op, without re-running detection for non-identity fields', async () => {
    await reachStep2();

    const uomInputs = screen.getAllByLabelText('UoM');
    fireEvent.change(uomInputs[0], { target: { value: 'pallet' } });

    // The debounced flush sends ONE update op with the absolute index.
    await waitFor(() => expect(mockedOps).toHaveBeenCalledTimes(1), { timeout: 3000 });
    const ops = mockedOps.mock.calls[0][1];
    expect(ops).toEqual([
      { op: 'update', index: 0, item: expect.objectContaining({ uom: 'pallet' }) },
    ]);
    // UoM is not an identity field — the entry detection stays the only call.
    expect(mockedDetect).toHaveBeenCalledTimes(1);
  });

  it('re-runs duplicate detection after an identity-field edit is flushed', async () => {
    await reachStep2();

    fireEvent.change(screen.getAllByLabelText('Material name')[0], {
      target: { value: 'Renamed Cement' },
    });

    await waitFor(() => expect(mockedOps).toHaveBeenCalledTimes(1), { timeout: 3000 });
    // Entry detection + the post-flush re-check.
    await waitFor(() => expect(mockedDetect).toHaveBeenCalledTimes(2));
    expect(mockedDetect).toHaveBeenLastCalledWith({ extractionId: 'job-1' }, expect.anything());
  });

  it('imports after flushing pending edits (edited value reaches the server first)', async () => {
    mockedImport.mockResolvedValue({
      total: 2,
      created: 2,
      updated: 0,
      skipped: 0,
      categoriesCreated: 1,
      materialList: null,
    });

    await reachStep2();
    fireEvent.change(screen.getAllByLabelText('UoM')[0], { target: { value: 'pallet' } });
    fireEvent.click(screen.getByTestId('upload-continue'));
    await screen.findByTestId('review-list');
    // Import immediately — the pending edit must flush before the import call.
    fireEvent.click(screen.getByTestId('upload-add'));

    await waitFor(() => expect(mockedImport).toHaveBeenCalled(), { timeout: 3000 });
    expect(mockedOps).toHaveBeenCalled();
    const opsOrder = mockedOps.mock.invocationCallOrder[0];
    const importOrder = mockedImport.mock.invocationCallOrder[0];
    expect(opsOrder).toBeLessThan(importOrder);
  });

  it('removes a row server-side and refreshes both the window and detection', async () => {
    await reachStep2();
    mockedOps.mockResolvedValue({ itemCount: 1 });

    fireEvent.click(screen.getByTestId('map-delete-row-0'));

    await waitFor(() =>
      expect(mockedOps).toHaveBeenCalledWith(
        'job-1',
        [{ op: 'remove', index: 0 }],
        expect.anything(),
      ),
    );
    // The structural op invalidates the window (a second items fetch) and
    // re-runs detection so the shifted indexes stay aligned.
    await waitFor(() => expect(mockedItems.mock.calls.length).toBeGreaterThanOrEqual(2));
    await waitFor(() => expect(mockedDetect).toHaveBeenCalledTimes(2));
  });

  it('lands on the created material list when the import returned one', async () => {
    mockedImport.mockResolvedValue({
      total: 2,
      created: 2,
      updated: 0,
      skipped: 0,
      categoriesCreated: 1,
      materialList: { id: 'list-9', name: 'ACME Price List 2026' },
    });

    await reachStep2();
    fireEvent.click(screen.getByTestId('upload-continue'));
    await screen.findByTestId('review-list');
    fireEvent.click(screen.getByTestId('upload-add'));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/material-catalogue/lists/list-9'),
    );
    // The toast names the list so the destination is not a surprise.
    expect(notificationService.success).toHaveBeenCalledWith(
      expect.stringContaining('ACME Price List 2026'),
    );
  });

  it('cancel navigates back to the catalogue', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('upload-cancel'));
    expect(mockNavigate).toHaveBeenCalledWith('/material-catalogue');
  });

  // A 60k-row catalogue used to arrive as one ~50MB payload and render every
  // row at once — locking the tab for minutes with no error. Now the poll
  // carries only a count and each step fetches one server-sliced window.
  describe('server-windowed rows on large drafts', () => {
    const MANY = 120; // > one 50-row page
    const BIG = Array.from({ length: MANY }, (_, i) => lineItem({ name: `Item ${i}` }));

    beforeEach(() => {
      mockedSummary.mockResolvedValue(summaryJob(MANY));
      mockedOps.mockResolvedValue({ itemCount: MANY });
      serveItemsFrom(BIG);
    });

    it('renders only the requested window and pages with absolute indexes', async () => {
      await reachStep2();

      // Page 1: rows 0..49 only.
      expect(screen.getByTestId('map-row-0')).toBeInTheDocument();
      expect(screen.getByTestId('map-row-49')).toBeInTheDocument();
      expect(screen.queryByTestId('map-row-50')).not.toBeInTheDocument();

      // Page 2 is a fresh server slice; testids/indexes stay ABSOLUTE.
      fireEvent.click(within(screen.getByTestId('upload-pagination')).getByText('Next'));
      await screen.findByTestId('map-row-50');
      expect(screen.queryByTestId('map-row-0')).not.toBeInTheDocument();
      expect(screen.getAllByLabelText('Material name')[0]).toHaveValue('Item 50');
      expect(mockedItems).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({ page: 2, limit: 50 }),
      );
    });

    it('routes an edit made on page 2 to the right absolute row', async () => {
      await reachStep2();
      fireEvent.click(within(screen.getByTestId('upload-pagination')).getByText('Next'));
      await screen.findByTestId('map-row-50');

      fireEvent.change(screen.getAllByLabelText('Material name')[0], {
        target: { value: 'Renamed on page two' },
      });

      await waitFor(() => expect(mockedOps).toHaveBeenCalledTimes(1), { timeout: 3000 });
      expect(mockedOps.mock.calls[0][1]).toEqual([
        { op: 'update', index: 50, item: expect.objectContaining({ name: 'Renamed on page two' }) },
      ]);

      // The shared page state carries into Step 3: the review window opens on
      // the same slice, with the local edit rendered.
      fireEvent.click(screen.getByTestId('upload-continue'));
      await screen.findByTestId('review-list');
      await screen.findByTestId('review-card-50');
      expect(screen.getByTestId('review-card-50')).toHaveTextContent('Renamed on page two');
      expect(screen.queryByTestId('review-card-0')).not.toBeInTheDocument();
    });

    it('narrows the window to duplicate rows only and back', async () => {
      // Duplicates on two different pages: indexes 1 and 70.
      mockedDetect.mockResolvedValue({
        results: [1, 70].map((index) => ({
          index,
          matches: [
            {
              id: `m-${index}`,
              name: `Match ${index}`,
              code: `MAT-${index}`,
              status: 'PUBLIC',
              matchedOn: ['name'],
            },
          ],
        })),
      });

      await reachStep2();
      await screen.findByTestId('map-duplicate-banner');

      fireEvent.click(screen.getByTestId('upload-dup-filter'));

      // Only the two flagged rows render — fetched by absolute index.
      await screen.findByTestId('map-row-70');
      expect(screen.getByTestId('map-row-1')).toBeInTheDocument();
      expect(screen.queryByTestId('map-row-0')).not.toBeInTheDocument();
      expect(mockedItems).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({ indexes: [1, 70] }),
      );

      // Toggle back to the full window.
      fireEvent.click(screen.getByTestId('upload-dup-filter'));
      await screen.findByTestId('map-row-0');
    });
  });
});
