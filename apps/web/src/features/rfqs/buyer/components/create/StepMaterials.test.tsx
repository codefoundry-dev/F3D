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
      aria-label={props.placeholder}
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
  RadioGroup: (props: any) => (
    <div role="radiogroup">
      {props.options.map((o: any) => (
        <label key={o.value}>
          <input
            type="radio"
            name={props.name}
            checked={props.value === o.value}
            onChange={() => props.onChange?.(o.value)}
          />
          {o.label}
        </label>
      ))}
    </div>
  ),
  Badge: (props: any) => <span>{props.children}</span>,
  FormField: ({ children, label }: any) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  ),
  Button: (props: any) => (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      data-testid={props['data-testid']}
    >
      {props.children}
    </button>
  ),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({
  default: () => <span data-testid="delete-icon" />,
}));

import type { ConfirmedBomSummary } from '@/features/doc-intelligence';

import { StepMaterials, type RfqLineItemDraft } from './StepMaterials';

const materials = [{ id: 'm1', name: 'Cement', unitOfMeasure: 'bag' }] as any;

const confirmedBoms: ConfirmedBomSummary[] = [
  {
    id: 'bom1',
    file: { originalName: 'site-a.pdf' },
    editedResult: {
      title: 'Site A BOM',
      projectName: 'Project A',
      currency: 'USD',
      notes: null,
      items: [
        {
          description: 'Plywood sheet',
          quantity: 10,
          unit: 'sheet',
          targetPrice: null,
          notes: 'grade B',
        },
        { description: 'Nails', quantity: null, unit: null, targetPrice: null, notes: null },
      ],
    },
  } as any,
];

function renderStep(overrides: Partial<React.ComponentProps<typeof StepMaterials>> = {}) {
  const props = {
    materials,
    search: '',
    onSearchChange: vi.fn(),
    lineItems: [],
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    confirmedBoms,
    ...overrides,
  };
  render(<StepMaterials {...props} />);
  return props;
}

describe('StepMaterials', () => {
  it('renders the heading and defaults to catalogue mode', () => {
    renderStep();
    expect(screen.getByText('Materials')).toBeInTheDocument();
    expect(screen.getByTestId('catalogue-fields')).toBeInTheDocument();
    expect(screen.queryByTestId('bom-fields')).not.toBeInTheDocument();
  });

  it('shows a local error and does not add when no material is selected', () => {
    const { onAdd } = renderStep();
    fireEvent.click(screen.getByTestId('add-line-item'));
    // The formError text is rendered as a paragraph (distinct from the dropdown's aria-label).
    expect(screen.getByText('Select a material', { selector: 'p' })).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('shows a quantity error when material chosen but quantity missing', () => {
    const { onAdd } = renderStep();
    fireEvent.change(screen.getByLabelText('Select a material'), { target: { value: 'm1' } });
    fireEvent.click(screen.getByTestId('add-line-item'));
    expect(screen.getByText(/Enter a quantity of at least 0.01/i)).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('adds a catalogue line item with source CATALOG and defaults the uom from the material', () => {
    const { onAdd } = renderStep();
    fireEvent.change(screen.getByLabelText('Select a material'), { target: { value: 'm1' } });
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '25' } });
    fireEvent.click(screen.getByTestId('add-line-item'));
    expect(onAdd).toHaveBeenCalledWith({
      source: 'CATALOG',
      materialId: 'm1',
      materialName: 'Cement',
      quantity: 25,
      uom: 'bag',
      costCode: undefined,
      notes: undefined,
      pickUp: undefined,
    });
  });

  it('switches to BOM mode, picks a BOM line, and adds it as a BOM-sourced draft', () => {
    const { onAdd } = renderStep();

    fireEvent.click(screen.getByLabelText('From BOM'));
    expect(screen.getByTestId('bom-fields')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Select a confirmed BOM'), {
      target: { value: 'bom1' },
    });
    expect(screen.getByTestId('bom-line-list')).toBeInTheDocument();

    const firstRow = screen.getByTestId('bom-line-0');
    fireEvent.click(firstRow.querySelector('input[type="checkbox"]')!);

    fireEvent.click(screen.getByTestId('add-bom-line-items'));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const draft = (onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0] as RfqLineItemDraft;
    expect(draft).toEqual({
      source: 'BOM',
      materialName: 'Plywood sheet',
      quantity: 10,
      uom: 'sheet',
      notes: 'grade B',
    });
    expect(draft.materialId).toBeUndefined();
  });

  it('validates BOM lines with null quantity/unit before adding', () => {
    const { onAdd } = renderStep();

    fireEvent.click(screen.getByLabelText('From BOM'));
    fireEvent.change(screen.getByLabelText('Select a confirmed BOM'), {
      target: { value: 'bom1' },
    });

    const secondRow = screen.getByTestId('bom-line-1');
    fireEvent.click(secondRow.querySelector('input[type="checkbox"]')!);

    fireEvent.click(screen.getByTestId('add-bom-line-items'));
    expect(screen.getByText(/quantity of at least 0\.01/i)).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('bom-line-1-quantity'), { target: { value: '50' } });
    fireEvent.change(screen.getByTestId('bom-line-1-uom'), { target: { value: 'box' } });
    fireEvent.click(screen.getByTestId('add-bom-line-items'));

    expect(onAdd).toHaveBeenCalledWith({
      source: 'BOM',
      materialName: 'Nails',
      quantity: 50,
      uom: 'box',
      notes: undefined,
    });
  });

  it('truncates an over-long BOM description to the 255-char name cap and keeps the full text in notes', () => {
    const longDescription = 'Galvanised steel bracket assembly, '.repeat(15); // > 255 chars
    const { onAdd } = renderStep({
      confirmedBoms: [
        {
          id: 'bom1',
          file: { originalName: 'site-a.pdf' },
          editedResult: {
            title: 'Site A BOM',
            projectName: 'Project A',
            currency: 'USD',
            notes: null,
            items: [
              {
                description: longDescription,
                quantity: 4,
                unit: 'ea',
                targetPrice: null,
                notes: null,
              },
            ],
          },
        } as any,
      ],
    });

    fireEvent.click(screen.getByLabelText('From BOM'));
    fireEvent.change(screen.getByLabelText('Select a confirmed BOM'), {
      target: { value: 'bom1' },
    });
    fireEvent.click(screen.getByTestId('bom-line-0').querySelector('input[type="checkbox"]')!);
    fireEvent.click(screen.getByTestId('add-bom-line-items'));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const draft = (onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0] as RfqLineItemDraft;
    expect(draft.materialName.length).toBeLessThanOrEqual(255);
    expect(draft.materialName.endsWith('…')).toBe(true);
    // Full description preserved so the spec is not silently dropped.
    expect(draft.notes).toBe(longDescription.trim());
  });

  it('adds a matched BOM line as a catalogue-linked draft (materialId set)', () => {
    const { onAdd } = renderStep({
      confirmedBoms: [
        {
          id: 'bom1',
          file: { originalName: 'site-a.pdf' },
          editedResult: {
            title: 'Site A BOM',
            projectName: 'Project A',
            currency: 'USD',
            notes: null,
            items: [
              {
                description: 'Cement 25kg',
                quantity: 50,
                unit: 'bag',
                targetPrice: null,
                notes: null,
                matchedMaterialId: 'mat-cement',
                matchedMaterialName: 'Cement Bag 50kg',
                matchConfidence: 0.9,
                matchCandidates: [],
              },
            ],
          },
        } as any,
      ],
    });

    fireEvent.click(screen.getByLabelText('From BOM'));
    fireEvent.change(screen.getByLabelText('Select a confirmed BOM'), {
      target: { value: 'bom1' },
    });
    fireEvent.click(screen.getByTestId('bom-line-0').querySelector('input[type="checkbox"]')!);
    fireEvent.click(screen.getByTestId('add-bom-line-items'));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const draft = (onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0] as RfqLineItemDraft;
    expect(draft).toMatchObject({
      source: 'BOM',
      materialId: 'mat-cement',
      materialName: 'Cement Bag 50kg',
      quantity: 50,
      uom: 'bag',
    });
    // The original BOM text is kept as notes (differs from the catalogue name).
    expect(draft.notes).toBe('Cement 25kg');
  });

  it('renders existing line items (catalogue and BOM) and supports removal', () => {
    const onRemove = vi.fn();
    renderStep({
      lineItems: [
        { source: 'CATALOG', materialId: 'm1', materialName: 'Cement', quantity: 5, uom: 'bag' },
        { source: 'BOM', materialName: 'Plywood sheet', quantity: 10, uom: 'sheet' },
      ],
      onRemove,
    });
    expect(screen.getByTestId('line-item-list')).toBeInTheDocument();
    expect(screen.getByText('Catalogue')).toBeInTheDocument();
    expect(screen.getByText('Plywood sheet')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Remove Cement'));
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it('renders the step-level error when provided', () => {
    renderStep({ error: 'Add at least one material' });
    expect(screen.getByText('Add at least one material')).toBeInTheDocument();
  });
});
