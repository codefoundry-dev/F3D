import * as apiClient from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocExtractionReview } from './DocExtractionReview';

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof apiClient>();
  return {
    ...actual,
    getDocExtraction: vi.fn(),
    updateDocExtraction: vi.fn(),
    confirmDocExtraction: vi.fn(),
  };
});

const mockedGetDocExtraction = apiClient.getDocExtraction as unknown as ReturnType<typeof vi.fn>;
const mockedUpdateDocExtraction = apiClient.updateDocExtraction as unknown as ReturnType<
  typeof vi.fn
>;
const mockedConfirmDocExtraction = apiClient.confirmDocExtraction as unknown as ReturnType<
  typeof vi.fn
>;

function buildJob(overrides: Partial<apiClient.DocExtractionResponse> = {}): apiClient.DocExtractionResponse {
  return {
    id: 'job-1',
    type: 'BOM',
    status: 'COMPLETED',
    file: { id: 'file-1', filename: 'bom.pdf', mimeType: 'application/pdf', size: 1234 },
    rawResult: { title: 'BOM', items: [] },
    editedResult: { title: 'BOM', items: [] },
    errorCode: null,
    errorMessage: null,
    model: 'gemini-2.5-flash',
    usage: { promptTokens: 10, completionTokens: 5 },
    createdByUserId: 'u-1',
    companyId: 'c-1',
    createdAt: '2026-05-22T00:00:00.000Z',
    updatedAt: '2026-05-22T00:00:00.000Z',
    completedAt: '2026-05-22T00:00:00.000Z',
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

describe('DocExtractionReview', () => {
  beforeEach(() => {
    mockedGetDocExtraction.mockReset();
    mockedUpdateDocExtraction.mockReset();
    mockedConfirmDocExtraction.mockReset();
  });

  it('shows the COMPLETED status and renders the edited JSON in the editor', async () => {
    mockedGetDocExtraction.mockResolvedValue(buildJob());

    renderWithClient(<DocExtractionReview extractionId="job-1" />);

    const editor = (await screen.findByTestId('extraction-editor')) as HTMLTextAreaElement;
    expect(editor.value).toContain('"title": "BOM"');
    expect(screen.getByTestId('extraction-status').textContent).toMatch(/Ready/i);
  });

  it('allows the user to edit, save, and persists via updateDocExtraction', async () => {
    mockedGetDocExtraction.mockResolvedValue(buildJob());
    mockedUpdateDocExtraction.mockResolvedValue(
      buildJob({ editedResult: { title: 'Edited', items: [] } }),
    );

    renderWithClient(<DocExtractionReview extractionId="job-1" />);

    fireEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const editor = (await screen.findByTestId('extraction-editor')) as HTMLTextAreaElement;
    fireEvent.change(editor, {
      target: { value: JSON.stringify({ title: 'Edited', items: [] }, null, 2) },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockedUpdateDocExtraction).toHaveBeenCalledWith('job-1', {
        title: 'Edited',
        items: [],
      });
    });
  });

  it('surfaces JSON parse errors and disables save while invalid', async () => {
    mockedGetDocExtraction.mockResolvedValue(buildJob());

    renderWithClient(<DocExtractionReview extractionId="job-1" />);

    fireEvent.click(await screen.findByRole('button', { name: /edit/i }));
    const editor = await screen.findByTestId('extraction-editor');
    fireEvent.change(editor, { target: { value: '{ not valid json' } });

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent?.toLowerCase()).toMatch(/(token|json|expected)/),
    );
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('confirms the extraction and notifies the parent via onConfirmed', async () => {
    mockedGetDocExtraction.mockResolvedValue(buildJob());
    mockedConfirmDocExtraction.mockResolvedValue(
      buildJob({ status: 'CONFIRMED', confirmedAt: '2026-05-22T01:00:00.000Z' }),
    );
    const onConfirmed = vi.fn();

    renderWithClient(<DocExtractionReview extractionId="job-1" onConfirmed={onConfirmed} />);

    fireEvent.click(await screen.findByTestId('confirm-extraction'));

    await waitFor(() => expect(mockedConfirmDocExtraction).toHaveBeenCalledWith('job-1', undefined));
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledTimes(1));
  });

  it('renders the FAILED error panel with code and message', async () => {
    mockedGetDocExtraction.mockResolvedValue(
      buildJob({ status: 'FAILED', errorCode: 'MALFORMED_RESPONSE', errorMessage: 'bad JSON' }),
    );

    renderWithClient(<DocExtractionReview extractionId="job-1" />);

    expect((await screen.findByRole('alert')).textContent).toContain('MALFORMED_RESPONSE');
    expect(screen.queryByTestId('extraction-editor')).not.toBeInTheDocument();
  });

  it('hides edit/confirm controls while still PROCESSING', async () => {
    mockedGetDocExtraction.mockResolvedValue(buildJob({ status: 'PROCESSING' }));

    renderWithClient(<DocExtractionReview extractionId="job-1" />);

    await screen.findByTestId('extraction-status');
    expect(screen.queryByTestId('extraction-editor')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('confirm-extraction')).not.toBeInTheDocument();
  });
});
