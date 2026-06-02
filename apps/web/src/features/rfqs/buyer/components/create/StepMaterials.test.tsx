import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/ui-components', () => ({
  Input: (props: any) => <input {...props} />,
  Textarea: (props: any) => <textarea {...props} />,
  Checkbox: (props: any) => (
    <label>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e: any) => props.onChange?.(e.target.checked)}
      />
      {props.label}
    </label>
  ),
  CustomDropdown: (props: any) => (
    <select
      aria-label="material"
      value={props.value ?? ''}
      onChange={(e: any) => props.onChange?.(e.target.value)}
    >
      <option value="">{props.placeholder}</option>
      {props.options.map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
  FormField: ({ children, label }: any) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  ),
  Button: (props: any) => (
    <button type="button" onClick={props.onClick} data-testid={props['data-testid']}>
      {props.children}
    </button>
  ),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({
  default: () => <span data-testid="delete-icon" />,
}));

import { StepMaterials } from './StepMaterials';

const materials = [{ id: 'm1', name: 'Cement', unitOfMeasure: 'bag' }] as any;

function renderStep(overrides: Partial<React.ComponentProps<typeof StepMaterials>> = {}) {
  const props = {
    materials,
    search: '',
    onSearchChange: vi.fn(),
    lineItems: [],
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
  render(<StepMaterials {...props} />);
  return props;
}

describe('StepMaterials', () => {
  it('renders the heading', () => {
    renderStep();
    expect(screen.getByText('Materials')).toBeInTheDocument();
  });

  it('shows a local error and does not add when no material is selected', () => {
    const { onAdd } = renderStep();
    // "Select a material" is the dropdown placeholder; clicking Add adds the error too.
    expect(screen.getAllByText('Select a material')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('add-line-item'));
    expect(screen.getAllByText('Select a material')).toHaveLength(2);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('shows a quantity error when material chosen but quantity missing', () => {
    const { onAdd } = renderStep();
    fireEvent.change(screen.getByLabelText('material'), { target: { value: 'm1' } });
    fireEvent.click(screen.getByTestId('add-line-item'));
    expect(screen.getByText(/Enter a quantity of at least 0.01/i)).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('adds a valid line item and defaults the uom from the material', () => {
    const { onAdd } = renderStep();
    fireEvent.change(screen.getByLabelText('material'), { target: { value: 'm1' } });
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '25' } });
    fireEvent.click(screen.getByTestId('add-line-item'));
    expect(onAdd).toHaveBeenCalledWith({
      materialId: 'm1',
      materialName: 'Cement',
      quantity: 25,
      uom: 'bag',
      costCode: undefined,
      notes: undefined,
      pickUp: undefined,
    });
  });

  it('renders existing line items and supports removal', () => {
    const onRemove = vi.fn();
    renderStep({
      lineItems: [{ materialId: 'm1', materialName: 'Cement', quantity: 5, uom: 'bag' }],
      onRemove,
    });
    expect(screen.getByTestId('line-item-list')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Remove Cement'));
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it('renders the step-level error when provided', () => {
    renderStep({ error: 'Add at least one material' });
    expect(screen.getByText('Add at least one material')).toBeInTheDocument();
  });
});
