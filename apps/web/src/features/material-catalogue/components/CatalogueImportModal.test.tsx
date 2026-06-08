import * as apiClient from '@forethread/api-client';
import { notificationService } from '@forethread/ui-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CatalogueImportModal } from './CatalogueImportModal';

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof apiClient>();
  return {
    ...actual,
    createDocExtraction: vi.fn(),
    getDocExtraction: vi.fn(),
    updateDocExtraction: vi.fn(),
    importCatalogue: vi.fn(),
  };
});

const mockedCreate = apiClient.createDocExtraction as unknown as ReturnType<typeof vi.fn>;
const mockedGet = apiClient.getDocExtraction as unknown as ReturnType<typeof vi.fn>;
const mockedUpdate = apiClient.updateDocExtraction as unknown as ReturnType<typeof vi.fn>;
const mockedImport = apiClient.importCatalogue as unknown as ReturnType<typeof vi.fn>;

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
        {
          name: 'Hammer',
          sku: 'H-1',
          brand: 'Acme',
          manufacturerPartNumber: null,
          upc: null,
          uom: 'EA',
          description: null,
          mainCategory: 'Tools',
          subCategory: null,
          imageUrl: null,
          confidence: 1,
        },
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
  };
}

function renderWithClient(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

function selectFile(filename: string, sizeBytes = 100) {
  const file = new File(['x'], filename, { type: 'application/octet-stream' });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  fireEvent.change(screen.getByTestId('catalogue-file-input'), { target: { files: [file] } });
}

describe('CatalogueImportModal', () => {
  beforeEach(() => {
    mockedCreate.mockReset();
    mockedGet.mockReset();
    mockedUpdate.mockReset();
    mockedImport.mockReset();
    vi.spyOn(notificationService, 'success').mockImplementation(() => 'id');
    vi.spyOn(notificationService, 'error').mockImplementation(() => 'id');
  });

  it('rejects an unsupported file type client-side without uploading', () => {
    renderWithClient(<CatalogueImportModal onClose={vi.fn()} />);
    selectFile('catalogue.csv');

    expect(screen.getByTestId('catalogue-file-error')).toBeInTheDocument();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('runs upload → review → import without re-uploading the result when unedited', async () => {
    mockedCreate.mockResolvedValue(buildJob({ status: 'PROCESSING', editedResult: null }));
    mockedGet.mockResolvedValue(buildJob());
    mockedImport.mockResolvedValue({
      total: 1,
      created: 1,
      updated: 0,
      skipped: 0,
      categoriesCreated: 1,
    });
    const onImported = vi.fn();
    const onClose = vi.fn();

    renderWithClient(<CatalogueImportModal onClose={onClose} onImported={onImported} />);
    selectFile('catalogue.xlsx');

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(mockedCreate.mock.calls[0][0]).toBe('CATALOGUE');

    // Review table appears once the poll returns COMPLETED.
    await screen.findByTestId('catalogue-review-table');
    expect(screen.getByText('Hammer')).toBeInTheDocument();

    // The poll fetches with a long timeout so the completing poll — which
    // returns the full multi-MB catalogue result — isn't canceled at the
    // api-client's default 30s timeout.
    expect(mockedGet).toHaveBeenCalledWith('job-1', expect.objectContaining({ timeout: 120000 }));

    fireEvent.click(await screen.findByTestId('catalogue-import-confirm'));

    await waitFor(() =>
      expect(mockedImport).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({ timeout: 300000 }),
      ),
    );
    await waitFor(() => expect(notificationService.success).toHaveBeenCalledTimes(1));
    // No edits → the server already has the parsed result, so we never PATCH it back.
    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('persists the edited result before importing when a row was changed', async () => {
    mockedCreate.mockResolvedValue(buildJob({ status: 'PROCESSING', editedResult: null }));
    mockedGet.mockResolvedValue(buildJob());
    mockedUpdate.mockResolvedValue(buildJob());
    mockedImport.mockResolvedValue({
      total: 1,
      created: 1,
      updated: 0,
      skipped: 0,
      categoriesCreated: 1,
    });

    renderWithClient(<CatalogueImportModal onClose={vi.fn()} />);
    selectFile('catalogue.xlsx');

    await screen.findByTestId('catalogue-review-table');
    // Edit the row's category → marks the draft dirty.
    fireEvent.change(screen.getByDisplayValue('Tools'), { target: { value: 'Hand Tools' } });

    fireEvent.click(await screen.findByTestId('catalogue-import-confirm'));

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledTimes(1));
    expect(mockedUpdate.mock.calls[0][0]).toBe('job-1');
    await waitFor(() =>
      expect(mockedImport).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({ timeout: 300000 }),
      ),
    );
    await waitFor(() => expect(notificationService.success).toHaveBeenCalledTimes(1));
  });

  it('shows the empty state when no items are extracted', async () => {
    mockedCreate.mockResolvedValue(buildJob({ status: 'PROCESSING', editedResult: null }));
    mockedGet.mockResolvedValue(
      buildJob({ editedResult: { sourceName: 'catalogue.xlsx', items: [], notes: null } }),
    );

    renderWithClient(<CatalogueImportModal onClose={vi.fn()} />);
    selectFile('catalogue.xlsx');

    expect(await screen.findByTestId('catalogue-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('catalogue-import-confirm')).not.toBeInTheDocument();
  });

  it('shows a retry action when the extraction fails', async () => {
    mockedCreate.mockResolvedValue(buildJob({ status: 'PROCESSING', editedResult: null }));
    mockedGet.mockResolvedValue(
      buildJob({
        status: 'FAILED',
        errorCode: 'BAD_FILE',
        errorMessage: 'corrupt',
        editedResult: null,
      }),
    );

    renderWithClient(<CatalogueImportModal onClose={vi.fn()} />);
    selectFile('catalogue.xlsx');

    expect(await screen.findByTestId('catalogue-retry')).toBeInTheDocument();
  });
});
