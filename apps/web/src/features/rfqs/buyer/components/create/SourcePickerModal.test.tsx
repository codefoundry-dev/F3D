import { fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (k: string, o?: { count?: number }) => (o?.count !== undefined ? `${k}:${o.count}` : k),
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  Button: (p: any) => (
    <button
      type="button"
      onClick={p.onClick}
      disabled={p.disabled ?? p.isLoading}
      data-testid={p['data-testid']}
    >
      {p.leftIcon}
      {p.children}
      {p.rightIcon}
    </button>
  ),
  Modal: (p: any) => <div data-testid="modal">{p.children}</div>,
  ModalIconHeader: (p: any) => (
    <div>
      <span>{p.title}</span>
      <span>{p.subtitle}</span>
      <button type="button" aria-label="close" onClick={p.onClose} />
    </div>
  ),
  Spinner: () => <div data-testid="spinner" />,
  cn: (...a: any[]) => a.filter(Boolean).join(' '),
}));

import {
  SourcePickerModal,
  type SourceEntity,
  type SourceItem,
  type SourcePickerModalProps,
} from './SourcePickerModal';

const entities: SourceEntity[] = [
  { id: 'b1', name: 'Alpha BOM', description: 'BOM-1' },
  { id: 'b2', name: 'Beta BOM', description: 'BOM-2' },
];

const items: SourceItem[] = [
  {
    id: 'i1',
    name: 'Steel Beam',
    materialId: 'm1',
    uom: 'unit',
    manufacturer: 'Acme',
    description: 'A beam',
    category: 'Steel',
    sourceQuantity: 5,
    projectId: 'p1',
  },
  {
    id: 'i2',
    name: 'Copper Pipe',
    materialId: 'm2',
    uom: 'm',
    category: 'Copper',
    sourceQuantity: 3,
  },
  {
    id: 'i3',
    name: 'Loose Bolt',
    sourceQuantity: 7,
  },
];

const texts = {
  title: 'My Title',
  subtitle: 'My Subtitle',
  defaultQuantity: (item: SourceItem) => item.sourceQuantity ?? 1,
};

function renderModal(overrides: Partial<SourcePickerModalProps> = {}) {
  const props: SourcePickerModalProps = {
    texts,
    entities,
    entitiesLoading: false,
    openEntity: null,
    onOpenEntityChange: vi.fn(),
    items: [],
    itemsLoading: false,
    onClose: vi.fn(),
    onCommit: vi.fn(),
    ...overrides,
  };
  const result = render(<SourcePickerModal {...props} />);
  return { ...result, props };
}

describe('SourcePickerModal — header & shell', () => {
  it('renders the title and subtitle from texts', () => {
    renderModal();
    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('My Subtitle')).toBeInTheDocument();
  });

  it('calls onClose from the header close button', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByLabelText('close'));
    expect(props.onClose).toHaveBeenCalled();
  });
});

describe('SourcePickerModal — entity list phase (in-wizard / non-convert)', () => {
  it('renders all entities with name and description', () => {
    renderModal();
    expect(screen.getByText('Alpha BOM')).toBeInTheDocument();
    expect(screen.getByText('Beta BOM')).toBeInTheDocument();
    expect(screen.getByText('BOM-1')).toBeInTheDocument();
  });

  it('shows a spinner while entities are loading', () => {
    renderModal({ entitiesLoading: true });
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows the empty label when there are no entities', () => {
    renderModal({ entities: [] });
    expect(screen.getByText('create.picker.noEntities')).toBeInTheDocument();
  });

  it('filters entities by the search box (case-insensitive)', () => {
    renderModal();
    const search = screen.getByPlaceholderText('create.picker.search');
    fireEvent.change(search, { target: { value: 'alpha' } });
    expect(screen.getByText('Alpha BOM')).toBeInTheDocument();
    expect(screen.queryByText('Beta BOM')).not.toBeInTheDocument();
  });

  it('clears the filter when the search is emptied', () => {
    renderModal();
    const search = screen.getByPlaceholderText('create.picker.search');
    fireEvent.change(search, { target: { value: 'alpha' } });
    fireEvent.change(search, { target: { value: '   ' } });
    expect(screen.getByText('Alpha BOM')).toBeInTheDocument();
    expect(screen.getByText('Beta BOM')).toBeInTheDocument();
  });

  it('drills in via the eye/view button', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByTestId('picker-view-b1'));
    expect(props.onOpenEntityChange).toHaveBeenCalledWith(entities[0]);
  });

  it('drills in via the + button in non-convert mode', () => {
    const { props } = renderModal();
    const row = screen.getByTestId('picker-entity-b2');
    // The non-convert row has a "+" open button labelled create.picker.open.
    fireEvent.click(within(row).getByLabelText('create.picker.open'));
    expect(props.onOpenEntityChange).toHaveBeenCalledWith(entities[1]);
  });

  it('does not render the select-all button outside convert mode', () => {
    renderModal();
    expect(screen.queryByTestId('picker-select-all')).not.toBeInTheDocument();
  });

  it('does not render the convert footer outside convert mode', () => {
    renderModal();
    expect(screen.queryByTestId('picker-continue')).not.toBeInTheDocument();
  });
});

describe('SourcePickerModal — entity list phase (convert mode)', () => {
  it('renders the select-all button and the continue footer', () => {
    renderModal({ convertMode: true });
    expect(screen.getByTestId('picker-select-all')).toBeInTheDocument();
    expect(screen.getByTestId('picker-continue')).toBeInTheDocument();
  });

  it('disables continue when nothing is selected and enables it after selecting', () => {
    renderModal({ convertMode: true });
    expect(screen.getByTestId('picker-continue')).toBeDisabled();
    fireEvent.click(screen.getByTestId('picker-toggle-b1'));
    expect(screen.getByTestId('picker-continue')).not.toBeDisabled();
  });

  it('toggles a single entity on and off via the per-row toggle', () => {
    renderModal({ convertMode: true });
    const toggle = screen.getByTestId('picker-toggle-b1');
    fireEvent.click(toggle);
    // Selection bar appears with count 1.
    expect(screen.getByText('create.picker.itemsSelected:1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('picker-toggle-b1'));
    expect(screen.queryByText('create.picker.itemsSelected:1')).not.toBeInTheDocument();
  });

  it('selects all filtered entities via the select-all button', () => {
    renderModal({ convertMode: true });
    fireEvent.click(screen.getByTestId('picker-select-all'));
    expect(screen.getByText('create.picker.itemsSelected:2')).toBeInTheDocument();
  });

  it('select-all only selects the currently filtered entities', () => {
    renderModal({ convertMode: true });
    fireEvent.change(screen.getByPlaceholderText('create.picker.search'), {
      target: { value: 'alpha' },
    });
    fireEvent.click(screen.getByTestId('picker-select-all'));
    expect(screen.getByText('create.picker.itemsSelected:1')).toBeInTheDocument();
  });

  it('clears the selection via the clear-selection button', () => {
    renderModal({ convertMode: true });
    fireEvent.click(screen.getByTestId('picker-select-all'));
    expect(screen.getByText('create.picker.itemsSelected:2')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('picker-clear-selection'));
    expect(screen.queryByText('create.picker.itemsSelected:2')).not.toBeInTheDocument();
  });

  it('commits the selected entity ids when continue is clicked', () => {
    const { props } = renderModal({ convertMode: true });
    fireEvent.click(screen.getByTestId('picker-toggle-b1'));
    fireEvent.click(screen.getByTestId('picker-toggle-b2'));
    fireEvent.click(screen.getByTestId('picker-continue'));
    expect(props.onCommit).toHaveBeenCalledWith([], ['b1', 'b2']);
  });

  it('drills in via the eye button even in convert mode', () => {
    const { props } = renderModal({ convertMode: true });
    fireEvent.click(screen.getByTestId('picker-view-b2'));
    expect(props.onOpenEntityChange).toHaveBeenCalledWith(entities[1]);
  });
});

describe('SourcePickerModal — item list phase (non-convert)', () => {
  function renderItems(overrides: Partial<SourcePickerModalProps> = {}) {
    return renderModal({ openEntity: entities[0], items, ...overrides });
  }

  it('renders the entity name and its items', () => {
    renderItems();
    expect(screen.getByText('Alpha BOM')).toBeInTheDocument();
    expect(screen.getByText('Steel Beam')).toBeInTheDocument();
    expect(screen.getByText('Copper Pipe')).toBeInTheDocument();
  });

  it('renders item metadata (category, manufacturer, uom, description)', () => {
    renderItems();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('A beam')).toBeInTheDocument();
    // "Steel" appears as a category chip.
    expect(screen.getAllByText('Steel').length).toBeGreaterThan(0);
  });

  it('shows a spinner while items load', () => {
    renderItems({ itemsLoading: true });
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows the no-items label when the open entity has no items', () => {
    renderItems({ items: [] });
    expect(screen.getByText('create.picker.noItems')).toBeInTheDocument();
  });

  it('goes back via the back button', () => {
    const { props } = renderItems();
    fireEvent.click(screen.getByTestId('picker-back'));
    expect(props.onOpenEntityChange).toHaveBeenCalledWith(null);
  });

  it('picks an item, exposing the qty input and uom select', () => {
    renderItems();
    expect(screen.queryByTestId('picker-qty-i1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('picker-pick-i1'));
    expect(screen.getByTestId('picker-qty-i1')).toBeInTheDocument();
    // Default quantity uses sourceQuantity (5).
    expect(screen.getByTestId('picker-qty-i1')).toHaveValue('5');
  });

  it('falls back to quantity 1 when the item has no sourceQuantity', () => {
    const noQty: SourceItem[] = [{ id: 'x1', name: 'No Qty Item' }];
    renderModal({
      openEntity: entities[0],
      items: noQty,
      texts: { ...texts, defaultQuantity: (i) => i.sourceQuantity ?? 1 },
    });
    fireEvent.click(screen.getByTestId('picker-pick-x1'));
    expect(screen.getByTestId('picker-qty-x1')).toHaveValue('1');
  });

  it('patches the picked quantity via the qty input', () => {
    renderItems();
    fireEvent.click(screen.getByTestId('picker-pick-i1'));
    fireEvent.change(screen.getByTestId('picker-qty-i1'), { target: { value: '42' } });
    expect(screen.getByTestId('picker-qty-i1')).toHaveValue('42');
  });

  it('coerces a non-numeric qty input to 0 (empty display)', () => {
    renderItems();
    fireEvent.click(screen.getByTestId('picker-pick-i1'));
    fireEvent.change(screen.getByTestId('picker-qty-i1'), { target: { value: 'abc' } });
    expect(screen.getByTestId('picker-qty-i1')).toHaveValue('');
  });

  it('patches the picked uom via the select', () => {
    renderItems();
    fireEvent.click(screen.getByTestId('picker-pick-i1'));
    const row = screen.getByTestId('picker-item-i1');
    const select = within(row).getByRole('combobox');
    fireEvent.change(select, { target: { value: 'kg' } });
    expect(select).toHaveValue('kg');
  });

  it('defaults the uom to "unit" when the item has no uom', () => {
    const noUom: SourceItem[] = [{ id: 'x2', name: 'Unitless', sourceQuantity: 2 }];
    renderModal({ openEntity: entities[0], items: noUom });
    fireEvent.click(screen.getByTestId('picker-pick-x2'));
    const row = screen.getByTestId('picker-item-x2');
    expect(within(row).getByRole('combobox')).toHaveValue('unit');
  });

  it('unpicks an item, hiding the qty input again', () => {
    renderItems();
    fireEvent.click(screen.getByTestId('picker-pick-i1'));
    const row = screen.getByTestId('picker-item-i1');
    fireEvent.click(within(row).getByLabelText('create.picker.deselect'));
    expect(screen.queryByTestId('picker-qty-i1')).not.toBeInTheDocument();
    expect(screen.getByTestId('picker-pick-i1')).toBeInTheDocument();
  });

  it('shows the in-entity picked count in the selection bar', () => {
    renderItems();
    fireEvent.click(screen.getByTestId('picker-pick-i1'));
    fireEvent.click(screen.getByTestId('picker-pick-i2'));
    expect(screen.getByText('create.picker.itemsSelected:2')).toBeInTheDocument();
  });

  it('clears all picked items in the entity via the selection-bar clear', () => {
    renderItems();
    fireEvent.click(screen.getByTestId('picker-pick-i1'));
    fireEvent.click(screen.getByTestId('picker-pick-i2'));
    fireEvent.click(screen.getByTestId('picker-clear-selection'));
    expect(screen.queryByText('create.picker.itemsSelected:2')).not.toBeInTheDocument();
    expect(screen.getByTestId('picker-pick-i1')).toBeInTheDocument();
  });

  it('adds all items via add-all-items', () => {
    renderItems();
    fireEvent.click(screen.getByTestId('picker-add-all-items'));
    // All three items are now picked → count 3.
    expect(screen.getByText('create.picker.itemsSelected:3')).toBeInTheDocument();
  });

  it('commits the picked items via the add-selected button', () => {
    const { props } = renderItems();
    fireEvent.click(screen.getByTestId('picker-pick-i1'));
    fireEvent.click(screen.getByTestId('picker-add-selected'));
    expect(props.onCommit).toHaveBeenCalledTimes(1);
    const [picked, entityIds] = (props.onCommit as any).mock.calls[0];
    expect(picked).toHaveLength(1);
    expect(picked[0]).toMatchObject({ id: 'i1', entityId: 'b1', quantity: 5, pickedUom: 'unit' });
    expect(entityIds).toEqual([]);
  });

  it('does not render the add-selected button in convert mode', () => {
    renderItems({ convertMode: true });
    expect(screen.queryByTestId('picker-add-selected')).not.toBeInTheDocument();
  });
});

describe('SourcePickerModal — item filters', () => {
  function renderItems(overrides: Partial<SourcePickerModalProps> = {}) {
    return renderModal({ openEntity: entities[0], items, ...overrides });
  }

  it('filters items by the search box', () => {
    renderItems();
    fireEvent.change(screen.getByPlaceholderText('create.picker.search'), {
      target: { value: 'copper' },
    });
    expect(screen.getByText('Copper Pipe')).toBeInTheDocument();
    expect(screen.queryByText('Steel Beam')).not.toBeInTheDocument();
  });

  it('opens the category filter panel and filters by a category', () => {
    renderItems();
    fireEvent.click(screen.getByTestId('picker-filters'));
    // Category buttons appear (Copper, Steel). Pick "Steel".
    const panelSteel = screen
      .getAllByText('Steel')
      .find((el) => el.tagName.toLowerCase() === 'button');
    fireEvent.click(panelSteel!);
    expect(screen.getByText('Steel Beam')).toBeInTheDocument();
    expect(screen.queryByText('Copper Pipe')).not.toBeInTheDocument();
  });

  it('resets the category filter via "all categories"', () => {
    renderItems();
    fireEvent.click(screen.getByTestId('picker-filters'));
    const panelSteel = screen
      .getAllByText('Steel')
      .find((el) => el.tagName.toLowerCase() === 'button');
    fireEvent.click(panelSteel!);
    expect(screen.queryByText('Copper Pipe')).not.toBeInTheDocument();
    // Re-open and reset.
    fireEvent.click(screen.getByTestId('picker-filters'));
    fireEvent.click(screen.getByText('create.vendors.allCategories'));
    expect(screen.getByText('Copper Pipe')).toBeInTheDocument();
    expect(screen.getByText('Steel Beam')).toBeInTheDocument();
  });

  it('toggles the filter panel closed when clicked twice', () => {
    renderItems();
    fireEvent.click(screen.getByTestId('picker-filters'));
    expect(screen.getByText('create.vendors.allCategories')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('picker-filters'));
    expect(screen.queryByText('create.vendors.allCategories')).not.toBeInTheDocument();
  });
});
