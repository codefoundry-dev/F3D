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
  GridModal: (p: any) => (
    <div data-testid="modal">
      <span>{p.title}</span>
      <span>{p.description}</span>
      {p.children}
      {p.actions}
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
  notes: 'handle with care',
  projectId: 'p1',
};

function renderModal(overrides: Partial<Item> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  const item = { ...baseItem, ...overrides };
  render(<EditMaterialModal item={item as any} onConfirm={onConfirm} onClose={onClose} />);
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

  it('prefills an empty date when the optional field is absent', () => {
    renderModal({ description: undefined, expectedDeliveryDate: undefined, notes: undefined });
    expect(screen.getByTestId('date')).toHaveValue('');
  });

  it('does not render a delivery-location field', () => {
    renderModal();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText('create.editMaterial.deliveryLocation')).not.toBeInTheDocument();
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
      notes: 'handle with care',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('omits optional fields that are blank in the confirmed patch', () => {
    const { onConfirm } = renderModal({
      description: undefined,
      expectedDeliveryDate: undefined,
      notes: undefined,
    });
    fireEvent.click(screen.getByTestId('edit-material-confirm'));
    expect(onConfirm).toHaveBeenCalledWith({
      materialName: 'Steel Beam',
      description: undefined,
      uom: 'unit',
      quantity: 5,
      expectedDeliveryDate: undefined,
      notes: undefined,
    });
  });

  it('updates the description, date and notes fields', () => {
    const { onConfirm } = renderModal();
    fireEvent.change(screen.getByTestId('date'), { target: { value: '2026-08-15' } });
    const notes = screen
      .getAllByRole('textbox')
      .find((el) => el.tagName.toLowerCase() === 'textarea');
    fireEvent.change(notes!, { target: { value: 'updated note' } });
    fireEvent.click(screen.getByTestId('edit-material-confirm'));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedDeliveryDate: '2026-08-15',
        notes: 'updated note',
      }),
    );
  });
});
