import { type MaterialListItemDto } from '@forethread/api-client';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MaterialTable, type MaterialTableProps } from './MaterialTable';

function material(over: Partial<MaterialListItemDto> = {}): MaterialListItemDto {
  return {
    id: 'm-1',
    name: 'Portland Cement',
    categoryId: 'c-1',
    categoryName: 'Cement',
    status: 'PUBLIC',
    createdAt: '',
    updatedAt: '2026-03-28T00:00:00.000Z',
    uom: 'bag',
    manufacturer: 'LafargeHolcim',
    isFavourite: false,
    ...over,
  };
}

function renderTable(over: Partial<MaterialTableProps> = {}) {
  const props: MaterialTableProps = {
    tab: 'public',
    items: [material()],
    isLoading: false,
    isError: false,
    searchActive: false,
    permissions: { canEdit: true, canArchive: false, canRestore: false, canDelete: false },
    onView: vi.fn(),
    onEdit: vi.fn(),
    onArchive: vi.fn(),
    onRestore: vi.fn(),
    onDelete: vi.fn(),
    ...over,
  };
  render(<MaterialTable {...props} />);
  return props;
}

describe('MaterialTable star column', () => {
  it('does not render the star column without onToggleFavourite', () => {
    renderTable();
    expect(screen.queryByTestId('material-favourite-m-1')).not.toBeInTheDocument();
  });

  it('renders an unpressed star for a non-favourited material', () => {
    renderTable({ onToggleFavourite: vi.fn() });
    const star = screen.getByTestId('material-favourite-m-1');
    expect(star).toBeInTheDocument();
    expect(star).toHaveAttribute('aria-pressed', 'false');
    expect(star).toHaveAttribute('aria-label', 'Add to favourites');
  });

  it('renders a pressed star for a favourited material', () => {
    renderTable({
      items: [material({ isFavourite: true })],
      onToggleFavourite: vi.fn(),
    });
    const star = screen.getByTestId('material-favourite-m-1');
    expect(star).toHaveAttribute('aria-pressed', 'true');
    expect(star).toHaveAttribute('aria-label', 'Remove from favourites');
  });

  it('fires onToggleFavourite with the material when the star is clicked', () => {
    const onToggleFavourite = vi.fn();
    renderTable({ onToggleFavourite });
    fireEvent.click(screen.getByTestId('material-favourite-m-1'));
    expect(onToggleFavourite).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-1' }));
  });

  it('adds the "Add to material list" kebab action when onAddToList is supplied', () => {
    const onAddToList = vi.fn();
    renderTable({ onAddToList });
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    const item = screen.getByText('Add to material list');
    fireEvent.click(item);
    expect(onAddToList).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-1' }));
  });

  it('renders a remove (X) action and fires onRemoveFromList', () => {
    const onRemoveFromList = vi.fn();
    renderTable({ onRemoveFromList });
    const removeBtn = screen.getByTestId('material-remove-m-1');
    expect(removeBtn).toBeInTheDocument();
    fireEvent.click(removeBtn);
    expect(onRemoveFromList).toHaveBeenCalledWith(expect.objectContaining({ id: 'm-1' }));
  });

  it('shows the custom empty text when provided and there are no items', () => {
    renderTable({ items: [], emptyText: 'No favourites yet' });
    expect(screen.getByText('No favourites yet')).toBeInTheDocument();
  });
});
