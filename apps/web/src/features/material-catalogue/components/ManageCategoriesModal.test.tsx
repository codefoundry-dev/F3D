import * as apiClient from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ManageCategoriesModal } from './ManageCategoriesModal';

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof apiClient>();
  return { ...actual, createMaterialCategory: vi.fn(), updateMaterialCategory: vi.fn() };
});

vi.mock('@forethread/ui-components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@forethread/ui-components')>();
  return { ...actual, toast: { success: vi.fn(), error: vi.fn() } };
});

const mockedCreate = apiClient.createMaterialCategory as unknown as ReturnType<typeof vi.fn>;
const mockedUpdate = apiClient.updateMaterialCategory as unknown as ReturnType<typeof vi.fn>;

const CATEGORIES: apiClient.MaterialCategoryDto[] = [
  { id: 'c-steel', name: 'Steel', isActive: true, materialCount: 3 },
  { id: 'c-timber', name: 'Timber', isActive: false, materialCount: 1 },
  { id: 'c-uncat', name: 'Uncategorised', isActive: true, materialCount: 0 },
];

function conflict(message: string) {
  const headers = new AxiosHeaders();
  return new AxiosError('Conflict', '409', { headers }, null, {
    status: 409,
    statusText: 'Conflict',
    headers,
    config: { headers },
    data: { message },
  });
}

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ManageCategoriesModal categories={CATEGORIES} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('ManageCategoriesModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists categories with status, counts and no actions on the Uncategorised fallback', () => {
    renderModal();
    expect(screen.getByTestId('category-row-c-steel')).toHaveTextContent('Active');
    expect(screen.getByTestId('category-row-c-steel')).toHaveTextContent('3 materials');
    expect(screen.getByTestId('category-row-c-timber')).toHaveTextContent('Inactive');
    expect(screen.getByTestId('category-row-c-timber')).toHaveTextContent('1 material');
    expect(screen.getByTestId('category-row-c-uncat')).toHaveTextContent('System');
    expect(screen.queryByTestId('category-rename-c-uncat')).not.toBeInTheDocument();
    expect(screen.queryByTestId('category-toggle-c-uncat')).not.toBeInTheDocument();
  });

  it('creates a category and clears the input', async () => {
    mockedCreate.mockResolvedValue({ id: 'c-new', name: 'Pipe', isActive: true, materialCount: 0 });
    renderModal();

    fireEvent.change(screen.getByTestId('new-category-name'), { target: { value: ' Pipe ' } });
    fireEvent.click(screen.getByTestId('add-category'));

    await waitFor(() => expect(screen.getByTestId('new-category-name')).toHaveValue(''));
    expect(mockedCreate).toHaveBeenCalledWith({ name: 'Pipe' }, { skipErrorHandler: true });
  });

  it('blocks an empty name and shows the server error inline on conflict', async () => {
    renderModal();
    fireEvent.click(screen.getByTestId('add-category'));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a category name');
    expect(mockedCreate).not.toHaveBeenCalled();

    mockedCreate.mockRejectedValue(conflict('A category with this name already exists'));
    fireEvent.change(screen.getByTestId('new-category-name'), { target: { value: 'steel' } });
    fireEvent.click(screen.getByTestId('add-category'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A category with this name already exists',
    );
  });

  it('renames in place: Enter saves, Esc cancels', async () => {
    mockedUpdate.mockResolvedValue({ ...CATEGORIES[0], name: 'Structural steel' });
    renderModal();

    fireEvent.click(screen.getByTestId('category-rename-c-steel'));
    const input = screen.getByTestId('category-rename-input-c-steel');
    fireEvent.change(input, { target: { value: 'Draft' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('category-rename-input-c-steel')).not.toBeInTheDocument();
    expect(mockedUpdate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('category-rename-c-steel'));
    const again = screen.getByTestId('category-rename-input-c-steel');
    fireEvent.change(again, { target: { value: 'Structural steel' } });
    fireEvent.keyDown(again, { key: 'Enter' });

    await waitFor(() =>
      expect(mockedUpdate).toHaveBeenCalledWith(
        'c-steel',
        { name: 'Structural steel' },
        { skipErrorHandler: true },
      ),
    );
    await waitFor(() =>
      expect(screen.queryByTestId('category-rename-input-c-steel')).not.toBeInTheDocument(),
    );
  });

  it('deactivates an active category and activates an inactive one', async () => {
    mockedUpdate.mockResolvedValue({ ...CATEGORIES[0], isActive: false });
    renderModal();

    expect(screen.getByTestId('category-toggle-c-steel')).toHaveTextContent('Deactivate');
    expect(screen.getByTestId('category-toggle-c-timber')).toHaveTextContent('Activate');

    fireEvent.click(screen.getByTestId('category-toggle-c-steel'));
    await waitFor(() =>
      expect(mockedUpdate).toHaveBeenCalledWith(
        'c-steel',
        { isActive: false },
        { skipErrorHandler: true },
      ),
    );
  });

  it('filters the list by name', () => {
    renderModal();
    fireEvent.change(screen.getByTestId('category-filter'), { target: { value: 'tim' } });
    expect(screen.getByTestId('category-row-c-timber')).toBeInTheDocument();
    expect(screen.queryByTestId('category-row-c-steel')).not.toBeInTheDocument();
  });
});
