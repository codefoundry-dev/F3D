import * as apiClient from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BomConversionPage from './BomConversionPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof apiClient>();
  return {
    ...actual,
    createDocExtraction: vi.fn(),
    getDocExtraction: vi.fn(),
  };
});

const mockedCreate = apiClient.createDocExtraction as unknown as ReturnType<typeof vi.fn>;
const mockedGet = apiClient.getDocExtraction as unknown as ReturnType<typeof vi.fn>;

function bomJob(
  overrides: Partial<apiClient.DocExtractionResponse> = {},
): apiClient.DocExtractionResponse {
  return {
    id: 'job-1',
    type: 'BOM',
    status: 'COMPLETED',
    file: { id: 'file-1', filename: 'bom.pdf', mimeType: 'application/pdf', size: 1024 },
    rawResult: { items: [] },
    editedResult: {
      title: 'BOM',
      projectName: null,
      currency: 'AUD',
      items: [{ description: 'Cement', quantity: 50, unit: 'bag', targetPrice: 12.5, notes: null }],
      notes: null,
    },
    errorCode: null,
    errorMessage: null,
    model: 'gemini-2.5-flash',
    usage: { promptTokens: 10, completionTokens: 5 },
    createdByUserId: 'u-1',
    lastEditedByUserId: null,
    confirmedByUserId: null,
    companyId: 'c-1',
    createdAt: '2026-05-22T00:00:00.000Z',
    updatedAt: '2026-05-22T00:00:00.000Z',
    completedAt: '2026-05-22T00:00:00.000Z',
    lastEditedAt: null,
    confirmedAt: null,
    ...overrides,
  };
}

function renderPage(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BomConversionPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockedCreate.mockReset();
    mockedGet.mockReset();
  });

  it('disables the extract button until a file is chosen', () => {
    renderPage(<BomConversionPage />);
    expect(screen.getByTestId('bom-extract-submit')).toBeDisabled();
  });

  it('uploads the chosen file as a BOM extraction and renders the review table', async () => {
    mockedCreate.mockResolvedValue(bomJob());
    mockedGet.mockResolvedValue(bomJob());

    renderPage(<BomConversionPage />);

    const file = new File(['%PDF-1.4 bom'], 'tower-5-bom.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('bom-file-input'), { target: { files: [file] } });

    const submit = screen.getByTestId('bom-extract-submit');
    expect(submit).not.toBeDisabled();
    fireEvent.click(submit);

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    // createDocExtraction(type, file, promptHint) — must send type 'BOM'
    expect(mockedCreate.mock.calls[0][0]).toBe('BOM');
    expect((mockedCreate.mock.calls[0][1] as File).name).toBe('tower-5-bom.pdf');

    // The review surface renders the structured line-item table once COMPLETED.
    expect(await screen.findByTestId('bom-review-table')).toBeInTheDocument();
  });
});
