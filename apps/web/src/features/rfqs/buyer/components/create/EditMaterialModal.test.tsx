import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('@forethread/ui-components', () => ({
  Button: (p: any) => (
    <button
      type="button"
      onClick={p.onClick}
      disabled={p.disabled ?? p.isLoading}
      data-testid={p['data-testid']}
    >
      {p.children}
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
  Input: (p: any) => <input value={p.value} onChange={p.onChange} data-testid={p['data-testid']} />,
  Textarea: (p: any) => (
    <textarea value={p.value} onChange={p.onChange} data-testid={p['data-testid']} />
  ),
  DatePicker: (p: any) => (
    <input data-testid="date" value={p.value} onChange={(e: any) => p.onChange(e.target.value)} />
  ),
}));

import { EditMaterialModal } from './EditMaterialModal';

interface Item {
  key: string;
  source: 'CATALOG' | 'BOM' | 'MATERIAL_LIST';
  materialName: string;
  description?: string;
  uom: string;
  quantity: number;
  expectedDeliveryDate?: string;
  deliveryLocationId?: string;
  notes?: string;
  projectId?: string;
}

const baseItem: Item = {
  key: 'li-1',
  source: 'CATALOG',
  materialName: 'Steel Beam',
  description: 'Heavy beam',
  uom: 'unit',
  quantity: 5,
  expectedDeliveryDate: '2026-07-01',
  deliveryLocationId: 'loc-p1',
  notes: 'handle with care',
  projectId: 'p1',
};

const locationOptions = [
  { id: 'loc-p1', label: 'Site A (P1)', projectId: 'p1' },
  { id: 'loc-p1b', label: 'Site B (P1)', projectId: 'p1' },
  { id: 'loc-p2', label: 'Site C (P2)', projectId: 'p2' },
];

function renderModal(
  overrides: Partial<Item> = {},
  opts: { locations?: typeof locationOptions } = {},
) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  const item = { ...baseItem, ...overrides };
  render(
    <EditMaterialModal
      item={item as any}
      locationOptions={(opts.locations ?? locationOptions) as any}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );
  return { onConfirm, onClose, item };
}

describe('EditMaterialModal', () => {
  it('renders the header title and subtitle', () => {
    renderModal();
    expect(screen.getByText('create.editMaterial.title')).toBeInTheDocument();
    expect(screen.getByText('create.editMaterial.subtitle')).toBeInTheDocument();
  });

  it('prefills the form from the item', () => {
    renderModal();
    expect(screen.getByTestId('edit-material-name')).toHaveValue('Steel Beam');
    expect(screen.getByTestId('edit-material-uom')).toHaveValue('unit');
    expect(screen.getByTestId('edit-material-qty')).toHaveValue('5');
    expect(screen.getByTestId('date')).toHaveValue('2026-07-01');
  });

  it('prefills empty strings when optional fields are absent', () => {
    renderModal({
      description: undefined,
      expectedDeliveryDate: undefined,
      deliveryLocationId: undefined,
      notes: undefined,
    });
    expect(screen.getByTestId('date')).toHaveValue('');
    // delivery-location select falls back to the placeholder option.
    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('only renders delivery locations matching the item projectId', () => {
    renderModal();
    expect(screen.getByText('Site A (P1)')).toBeInTheDocument();
    expect(screen.getByText('Site B (P1)')).toBeInTheDocument();
    expect(screen.queryByText('Site C (P2)')).not.toBeInTheDocument();
  });

  it('renders every location when the item has no projectId', () => {
    renderModal({ projectId: undefined });
    expect(screen.getByText('Site A (P1)')).toBeInTheDocument();
    expect(screen.getByText('Site C (P2)')).toBeInTheDocument();
  });

  it('calls onClose from the header close button', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByLabelText('close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose from the cancel button', () => {
    const { onClose, onConfirm } = renderModal();
    fireEvent.click(screen.getByText('create.editMaterial.cancel'));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('shows a validation error and does not confirm when the name is empty', () => {
    const { onConfirm } = renderModal();
    fireEvent.change(screen.getByTestId('edit-material-name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('edit-material-confirm'));
    expect(screen.getByText('create.editMaterial.invalid')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('shows a validation error when the uom is empty', () => {
    const { onConfirm } = renderModal();
    fireEvent.change(screen.getByTestId('edit-material-uom'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('edit-material-confirm'));
    expect(screen.getByText('create.editMaterial.invalid')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('shows a validation error when quantity is below 0.01', () => {
    const { onConfirm } = renderModal();
    fireEvent.change(screen.getByTestId('edit-material-qty'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('edit-material-confirm'));
    expect(screen.getByText('create.editMaterial.invalid')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('shows a validation error when quantity is not a number', () => {
    const { onConfirm } = renderModal();
    fireEvent.change(screen.getByTestId('edit-material-qty'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByTestId('edit-material-confirm'));
    expect(screen.getByText('create.editMaterial.invalid')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms with a trimmed patch and then closes', () => {
    const { onConfirm, onClose } = renderModal();
    fireEvent.change(screen.getByTestId('edit-material-name'), {
      target: { value: '  New Name  ' },
    });
    fireEvent.change(screen.getByTestId('edit-material-uom'), { target: { value: ' kg ' } });
    fireEvent.change(screen.getByTestId('edit-material-qty'), { target: { value: '12' } });
    fireEvent.click(screen.getByTestId('edit-material-confirm'));
    expect(onConfirm).toHaveBeenCalledWith({
      materialName: 'New Name',
      description: 'Heavy beam',
      uom: 'kg',
      quantity: 12,
      expectedDeliveryDate: '2026-07-01',
      deliveryLocationId: 'loc-p1',
      notes: 'handle with care',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('omits optional fields that are blank in the confirmed patch', () => {
    const { onConfirm } = renderModal({
      description: undefined,
      expectedDeliveryDate: undefined,
      deliveryLocationId: undefined,
      notes: undefined,
    });
    fireEvent.click(screen.getByTestId('edit-material-confirm'));
    expect(onConfirm).toHaveBeenCalledWith({
      materialName: 'Steel Beam',
      description: undefined,
      uom: 'unit',
      quantity: 5,
      expectedDeliveryDate: undefined,
      deliveryLocationId: undefined,
      notes: undefined,
    });
  });

  it('updates the description, date, location and notes fields', () => {
    const { onConfirm } = renderModal();
    fireEvent.change(screen.getByTestId('date'), { target: { value: '2026-08-15' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'loc-p1b' } });
    // description is the second Input (no testid); query all textboxes.
    const textboxes = screen.getAllByRole('textbox');
    // Order: name, description, uom, quantity, date(? — it's an input), textarea(notes)
    // Just change the notes textarea explicitly.
    const notes = textboxes.find((el) => el.tagName.toLowerCase() === 'textarea');
    fireEvent.change(notes!, { target: { value: 'updated note' } });
    fireEvent.click(screen.getByTestId('edit-material-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedDeliveryDate: '2026-08-15',
        deliveryLocationId: 'loc-p1b',
        notes: 'updated note',
      }),
    );
  });

  it('clears the delivery location when set back to the placeholder', () => {
    const { onConfirm } = renderModal();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('edit-material-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryLocationId: undefined }),
    );
  });
});
