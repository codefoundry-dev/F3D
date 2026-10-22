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

// A contractor holds archive/restore/delete for its OWN materials only, so the
// table must not offer those actions on shared public rows — the API would 403.
describe('MaterialTable canManage ownership gate', () => {
  const allPermissions = {
    canEdit: true,
    canArchive: true,
    canRestore: true,
    canDelete: true,
  };

  it('offers archive + delete on a row the caller owns', () => {
    renderTable({
      items: [material({ status: 'PRIVATE', companyId: 'comp-1' })],
      permissions: allPermissions,
      canManage: (m) => Boolean(m.companyId),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('hides archive + delete on a public row the caller does not own', () => {
    renderTable({
      items: [material({ status: 'PUBLIC', companyId: null })],
      permissions: allPermissions,
      canManage: (m) => Boolean(m.companyId),
      onAddToList: vi.fn(),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    // Non-destructive actions survive; only the lifecycle ones are gated.
    expect(screen.getByText('Add to material list')).toBeInTheDocument();
    expect(screen.queryByText('Archive')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('hides restore on an archived row the caller does not own', () => {
    renderTable({
      tab: 'archived',
      items: [material({ status: 'ARCHIVED', companyId: null })],
      permissions: allPermissions,
      canManage: (m) => Boolean(m.companyId),
    });

    // Every kebab action was gated out, so no kebab renders at all.
    expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument();
  });

  it('keeps every action when no predicate is supplied (Super-Admin view)', () => {
    renderTable({
      items: [material({ status: 'PUBLIC', companyId: null })],
      permissions: allPermissions,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });
});

describe('MaterialTable inline cost / tax codes (FOR-365)', () => {
  it('renders the codes as plain text without onSaveCode', () => {
    renderTable({ items: [material({ costCode: 'CC-1', taxCode: 'TX-1' })] });
    expect(screen.getByTestId('material-costCode-m-1').tagName).toBe('SPAN');
    expect(screen.getByTestId('material-taxCode-m-1')).toHaveTextContent('TX-1');
  });

  it('saves an edited code through onSaveCode', async () => {
    const onSaveCode = vi.fn().mockResolvedValue(undefined);
    renderTable({ items: [material({ costCode: 'CC-1' })], onSaveCode });
    fireEvent.click(screen.getByTestId('material-costCode-m-1'));
    const input = screen.getByTestId('material-costCode-m-1-input');
    fireEvent.change(input, { target: { value: 'CC-2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await vi.waitFor(() =>
      expect(onSaveCode).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'm-1' }),
        'costCode',
        'CC-2',
      ),
    );
  });

  it('keeps rows that canEditCodes rejects read-only', () => {
    renderTable({ onSaveCode: vi.fn(), canEditCodes: () => false });
    expect(screen.getByTestId('material-taxCode-m-1').tagName).toBe('SPAN');
  });
});
