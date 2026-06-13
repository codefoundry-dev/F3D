import { type MaterialListSummaryDto } from '@forethread/api-client';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MaterialListsPanel, type MaterialListsPanelProps } from './MaterialListsPanel';

function list(over: Partial<MaterialListSummaryDto> = {}): MaterialListSummaryDto {
  return {
    id: 'l-1',
    name: 'Steel beams',
    description: 'Structural steel',
    itemCount: 3,
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...over,
  };
}

function renderPanel(over: Partial<MaterialListsPanelProps> = {}) {
  const props: MaterialListsPanelProps = {
    lists: [list()],
    isLoading: false,
    isError: false,
    search: '',
    permissions: { canCreate: true, canEdit: true, canDelete: true },
    onSearchChange: vi.fn(),
    onCreate: vi.fn(),
    onView: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...over,
  };
  render(<MaterialListsPanel {...props} />);
  return props;
}

describe('MaterialListsPanel', () => {
  it('renders list cards with name and description', () => {
    renderPanel();
    expect(screen.getByTestId('material-list-card-l-1')).toBeInTheDocument();
    expect(screen.getByText('Steel beams')).toBeInTheDocument();
    expect(screen.getByText('Structural steel')).toBeInTheDocument();
  });

  it('fires onCreate when the create button is clicked', () => {
    const props = renderPanel();
    fireEvent.click(screen.getByTestId('material-lists-create'));
    expect(props.onCreate).toHaveBeenCalledTimes(1);
  });

  it('fires onView and onEdit from the card icons', () => {
    const props = renderPanel();
    fireEvent.click(screen.getByTestId('material-list-view-l-1'));
    expect(props.onView).toHaveBeenCalledWith(expect.objectContaining({ id: 'l-1' }));
    fireEvent.click(screen.getByTestId('material-list-edit-l-1'));
    expect(props.onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'l-1' }));
  });

  it('hides the create button and edit icon without permission', () => {
    renderPanel({ permissions: { canCreate: false, canEdit: false, canDelete: false } });
    expect(screen.queryByTestId('material-lists-create')).not.toBeInTheDocument();
    expect(screen.queryByTestId('material-list-edit-l-1')).not.toBeInTheDocument();
  });

  it('renders the empty state when there are no lists', () => {
    renderPanel({ lists: [] });
    expect(screen.getByTestId('material-lists-empty')).toBeInTheDocument();
    expect(screen.getByText('No material lists yet.')).toBeInTheDocument();
  });

  it('shows the no-results message when searching with no matches', () => {
    renderPanel({ lists: [], search: 'zzz' });
    expect(screen.getByText('No material lists match your search.')).toBeInTheDocument();
  });

  it('renders the loading and error states', () => {
    const { rerender } = render(
      <MaterialListsPanel
        lists={[]}
        isLoading
        isError={false}
        search=""
        permissions={{ canCreate: true, canEdit: true, canDelete: true }}
        onSearchChange={vi.fn()}
        onCreate={vi.fn()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();

    rerender(
      <MaterialListsPanel
        lists={[]}
        isLoading={false}
        isError
        search=""
        permissions={{ canCreate: true, canEdit: true, canDelete: true }}
        onSearchChange={vi.fn()}
        onCreate={vi.fn()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
