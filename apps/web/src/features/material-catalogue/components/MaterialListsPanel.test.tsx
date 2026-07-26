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
    sourceExtractionId: null,
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
    onViewAllCompanyMaterials: vi.fn(),
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
        onViewAllCompanyMaterials={vi.fn()}
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
        onViewAllCompanyMaterials={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  // A company's uploaded catalogues land here as lists; hand-curated lists sit
  // alongside them, so the badge is the only thing telling them apart.
  it('badges an upload-derived list and falls back to the item count as the subtitle', () => {
    renderPanel({
      lists: [
        list({
          id: 'l-2',
          name: 'ACME Price List 2026',
          description: null,
          itemCount: 142,
          sourceExtractionId: 'ext-1',
        }),
      ],
    });
    expect(screen.getByTestId('material-list-uploaded-l-2')).toBeInTheDocument();
    expect(screen.getByText('Uploaded catalogue')).toBeInTheDocument();
    expect(screen.getByText('142 materials')).toBeInTheDocument();
  });

  it('does not badge a hand-curated list', () => {
    renderPanel();
    expect(screen.queryByTestId('material-list-uploaded-l-1')).not.toBeInTheDocument();
  });

  // Private materials added outside an upload (create wizard, BOM/RFQ quick-add)
  // are only reachable through this pinned card.
  it('always offers the all-company-materials entry point, even with no lists', () => {
    const props = renderPanel({ lists: [] });
    fireEvent.click(screen.getByTestId('material-lists-all-company'));
    expect(props.onViewAllCompanyMaterials).toHaveBeenCalledTimes(1);
  });
});
