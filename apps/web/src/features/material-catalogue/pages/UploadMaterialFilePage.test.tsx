import * as apiClient from '@forethread/api-client';
import { notificationService } from '@forethread/ui-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UploadMaterialFilePage from './UploadMaterialFilePage';

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof apiClient>();
  return {
    ...actual,
    createDocExtraction: vi.fn(),
    getDocExtraction: vi.fn(),
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

const mockedCreate = apiClient.createDocExtraction as unknown as ReturnType<typeof vi.fn>;
const mockedGet = apiClient.getDocExtraction as unknown as ReturnType<typeof vi.fn>;
const mockedUpdate = apiClient.updateDocExtraction as unknown as ReturnType<typeof vi.fn>;
const mockedImport = apiClient.importCatalogue as unknown as ReturnType<typeof vi.fn>;
const mockedDetect = apiClient.detectMaterialDuplicates as unknown as ReturnType<typeof vi.fn>;

function lineItem(over: Partial<apiClient.MaterialDetailDto> & { name: string }) {
  return {
    name: over.name,
    sku: null,
    materialCode: null,
    brand: 'LafargeHolcim',
    manufacturerPartNumber: null,
    upc: '123456789',
    uom: 'units',
    description: 'Lorem',
    mainCategory: 'Concrete & cement',
    subCategory: null,
    countryOfOrigin: null,
    pricePerUnit: null,
    imageUrl: null,
    confidence: 1,
  };
}

function buildJob(
  overrides: Partial<apiClient.DocExtractionResponse> = {},
): apiClient.DocExtractionResponse {
  return {
    id: 'job-1',
    type: 'CATALOGUE',
    status: 'COMPLETED',
    file: { id: 'f-1', filename: 'catalogue.xlsx', mimeType: 'application/octet-stream', size: 99 },
    rawResult: null,
    editedResult: {
      sourceName: 'catalogue.xlsx',
      notes: null,
      items: [
        lineItem({ name: 'Portland Cement Type I' }),
        lineItem({ name: 'Type I Masonry Cement' }),
      ],
    },
    errorCode: null,
    errorMessage: null,
    model: null,
    usage: null,
    createdByUserId: 'u-1',
    lastEditedByUserId: null,
    confirmedByUserId: null,
    companyId: 'c-1',
    createdAt: '2026-06-08T00:00:00.000Z',
    updatedAt: '2026-06-08T00:00:00.000Z',
    completedAt: '2026-06-08T00:00:00.000Z',
    lastEditedAt: null,
    confirmedAt: null,
    ...overrides,
  } as apiClient.DocExtractionResponse;
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

describe('UploadMaterialFilePage', () => {
  beforeEach(() => {
    mockedCreate.mockReset();
    mockedGet.mockReset();
    mockedUpdate.mockReset();
    mockedImport.mockReset();
    mockedDetect.mockReset();
    mockNavigate.mockReset();
    mockedDetect.mockResolvedValue({ results: [] });
    vi.spyOn(notificationService, 'success').mockImplementation(() => 'id');
    vi.spyOn(notificationService, 'error').mockImplementation(() => 'id');
  });

  it('rejects an unsupported file type client-side without uploading', () => {
    renderPage();
    selectFile('catalogue.csv');

    expect(screen.getByTestId('upload-file-error')).toBeInTheDocument();
    expect(mockedCreate).not.toHaveBeenCalled();
    // Proceed stays disabled with no valid file.
    expect(screen.getByTestId('upload-proceed')).toBeDisabled();
  });

  it('advances upload → map → review and highlights duplicate rows', async () => {
    mockedCreate.mockResolvedValue(buildJob({ status: 'PROCESSING', editedResult: null }));
    mockedGet.mockResolvedValue(buildJob());
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

    renderPage();
    selectFile('catalogue.xlsx');

    expect(screen.getByTestId('upload-proceed')).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('upload-proceed'));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(mockedCreate.mock.calls[0][0]).toBe('CATALOGUE');

    // Seeds the draft + advances to Step 2 once the poll returns COMPLETED.
    await screen.findByTestId('map-table');

    // Duplicate detection fires on the step→2 transition and highlights the
    // colliding row.
    await screen.findByTestId('map-duplicate-banner');
    expect(mockedDetect).toHaveBeenCalled();
    expect(screen.getByTestId('map-row-1')).toHaveAttribute('data-duplicate', 'true');
    expect(screen.getByTestId('map-row-0')).not.toHaveAttribute('data-duplicate');
    // The duplicate row exposes a clone action; non-duplicate rows do not.
    expect(screen.getByTestId('map-duplicate-row-1')).toBeInTheDocument();
    expect(screen.queryByTestId('map-duplicate-row-0')).not.toBeInTheDocument();

    // Step 2 → Step 3.
    fireEvent.click(screen.getByTestId('upload-continue'));
    await screen.findByTestId('review-list');
    expect(screen.getByTestId('review-duplicate-banner')).toBeInTheDocument();
    expect(screen.getByTestId('review-duplicate-strip-1')).toBeInTheDocument();
    expect(screen.queryByTestId('review-duplicate-strip-0')).not.toBeInTheDocument();
  });

  it('imports without re-uploading when no rows were edited, then navigates back', async () => {
    mockedCreate.mockResolvedValue(buildJob({ status: 'PROCESSING', editedResult: null }));
    mockedGet.mockResolvedValue(buildJob());
    mockedImport.mockResolvedValue({
      total: 2,
      created: 2,
      updated: 0,
      skipped: 0,
      categoriesCreated: 1,
    });

    renderPage();
    selectFile('catalogue.xlsx');
    fireEvent.click(screen.getByTestId('upload-proceed'));

    await screen.findByTestId('map-table');
    fireEvent.click(screen.getByTestId('upload-continue'));
    await screen.findByTestId('review-list');

    fireEvent.click(screen.getByTestId('upload-add'));

    await waitFor(() =>
      expect(mockedImport).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({ timeout: 300000 }),
      ),
    );
    // No edits → never PATCH the result back.
    expect(mockedUpdate).not.toHaveBeenCalled();
    await waitFor(() => expect(notificationService.success).toHaveBeenCalledTimes(1));
    expect(mockNavigate).toHaveBeenCalledWith('/material-catalogue');
  });

  it('persists the edited draft before importing when a cell was changed', async () => {
    mockedCreate.mockResolvedValue(buildJob({ status: 'PROCESSING', editedResult: null }));
    mockedGet.mockResolvedValue(buildJob());
    mockedUpdate.mockResolvedValue(buildJob());
    mockedImport.mockResolvedValue({
      total: 2,
      created: 2,
      updated: 0,
      skipped: 0,
      categoriesCreated: 1,
    });

    renderPage();
    selectFile('catalogue.xlsx');
    fireEvent.click(screen.getByTestId('upload-proceed'));

    await screen.findByTestId('map-table');
    // Edit the first row's UoM → marks the draft dirty.
    const uomInputs = screen.getAllByLabelText('UoM');
    fireEvent.change(uomInputs[0], { target: { value: 'pallet' } });

    fireEvent.click(screen.getByTestId('upload-continue'));
    await screen.findByTestId('review-list');
    fireEvent.click(screen.getByTestId('upload-add'));

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1));
    expect(mockedUpdate.mock.calls[0][0]).toBe('job-1');
    await waitFor(() => expect(mockedImport).toHaveBeenCalled());
  });

  it('cancel navigates back to the catalogue', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('upload-cancel'));
    expect(mockNavigate).toHaveBeenCalledWith('/material-catalogue');
  });
});
