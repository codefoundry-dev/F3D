import * as apiClient from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddToMaterialListModal } from './AddToMaterialListModal';

vi.mock('@forethread/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof apiClient>();
  return { ...actual, getMaterialLists: vi.fn(), addMaterialListItems: vi.fn() };
});

const mockedGetLists = apiClient.getMaterialLists as unknown as ReturnType<typeof vi.fn>;
const mockedAddItems = apiClient.addMaterialListItems as unknown as ReturnType<typeof vi.fn>;

function renderModal(onClose = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AddToMaterialListModal material={{ id: 'm-1', name: 'Cement' }} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

describe('AddToMaterialListModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the user material-list cards', async () => {
    mockedGetLists.mockResolvedValue([
      { id: 'l-1', name: 'Steel', description: 'Beams', itemCount: 1, updatedAt: '' },
      { id: 'l-2', name: 'Concrete', description: null, itemCount: 0, updatedAt: '' },
    ]);
    renderModal();

    expect(await screen.findByTestId('add-to-list-card-l-1')).toBeInTheDocument();
    expect(screen.getByTestId('add-to-list-card-l-2')).toBeInTheDocument();
    expect(screen.getByText('Add from Material list')).toBeInTheDocument();
  });

  it('adds the material to the clicked list, then closes', async () => {
    mockedGetLists.mockResolvedValue([
      { id: 'l-1', name: 'Steel', description: 'Beams', itemCount: 1, updatedAt: '' },
    ]);
    mockedAddItems.mockResolvedValue({ id: 'l-1', name: 'Steel', description: null, items: [] });
    const { onClose } = renderModal();

    fireEvent.click(await screen.findByTestId('add-to-list-card-l-1'));

    await waitFor(() =>
      expect(mockedAddItems).toHaveBeenCalledWith('l-1', ['m-1'], { skipErrorHandler: true }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('shows the empty state when the user has no lists', async () => {
    mockedGetLists.mockResolvedValue([]);
    renderModal();
    expect(await screen.findByText('You have no material lists yet.')).toBeInTheDocument();
  });
});
