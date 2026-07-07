vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const MAT = vi.hoisted(() => ({
  id: 'mat-1',
  name: 'Steel Beam W12x26',
  unit: 'ea',
  sku: 'SB-W12X26',
  upc: '01234567',
  manufacturerPartNumber: 'MPN-1',
  costCode: 'CC-100',
  taxCode: 'TX-A',
}));

vi.mock('@forethread/ui-components', () => ({
  Input: (p: Record<string, unknown>) => <input data-testid="cell-input" name={String(p.name)} />,
  CustomDropdown: () => <div data-testid="dropdown" />,
  DatePicker: () => <input data-testid="date" readOnly />,
  MessageBadgeIcon: () => <span data-testid="notes-icon" />,
  onDigitsOnly: () => undefined,
  onDecimalOnly: () => undefined,
  // The cell's catalogue popup: expose the placeholder and a whole-row pick
  // button so the test can drive the single-pick path (onPickItem).
  MaterialSearchPanel: (p: {
    searchPlaceholder?: string;
    onPickItem?: (mat: typeof MAT) => void;
  }) => (
    <div>
      <span data-testid="cell-placeholder">{p.searchPlaceholder}</span>
      <button type="button" data-testid="pick-row" onClick={() => p.onPickItem?.(MAT)}>
        {MAT.name}
      </button>
    </div>
  ),
}));

vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({
  default: () => <svg data-testid="icon-delete" />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit-in-square.svg?react', () => ({
  default: () => <svg data-testid="icon-edit" />,
}));
vi.mock('@forethread/ui-components/assets/icons/info.svg?react', () => ({
  default: () => <svg data-testid="icon-info" />,
}));

import { fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';

import { EMPTY_LINE_ITEM, type FormValues } from '../schemas/create-po.schema';

import { LineItemRow, type MaterialSearchState } from './LineItemRow';

const setValueSpy = vi.fn();
const closeSpy = vi.fn();

function Harness() {
  const form = useForm<FormValues>({
    defaultValues: { lineItems: [{ ...EMPTY_LINE_ITEM }] } as Partial<FormValues>,
  });
  const setValue: typeof form.setValue = (name, value, options) => {
    setValueSpy(name, value);
    return form.setValue(name, value, options);
  };
  const materialSearch: MaterialSearchState = {
    cellSearchOpen: 0,
    cellSearchQuery: 'steel',
    onCellSearchChange: () => undefined,
    onCellSearchClose: closeSpy,
    results: [MAT],
    selected: [],
    filters: {
      category: '',
      manufacturer: '',
      materialType: '',
      unitOfMeasurement: '',
      countryOfOrigin: '',
      colour: '',
    },
    onFiltersChange: () => undefined,
    onDeselect: () => undefined,
    onQtyChange: () => undefined,
  };
  return (
    <table>
      <tbody>
        <LineItemRow
          index={0}
          isFilled={false}
          isLast
          hasNotes={false}
          item={form.watch('lineItems.0')}
          register={form.register}
          control={form.control}
          errors={{}}
          setValue={setValue}
          remove={() => undefined}
          locationOptions={[]}
          onToggleNotes={() => undefined}
          materialSearch={materialSearch}
        />
      </tbody>
    </table>
  );
}

describe('LineItemRow — manual material cell (FOR-274)', () => {
  beforeEach(() => {
    setValueSpy.mockClear();
    closeSpy.mockClear();
  });

  it('shows the enter-material-name placeholder on the empty cell', () => {
    render(<Harness />);
    expect(screen.getByTestId('cell-placeholder')).toHaveTextContent('create.enterMaterialName');
  });

  it('single-pick from the popup links the material and prefills its codes', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('pick-row'));

    const calls = new Map(setValueSpy.mock.calls.map(([name, value]) => [name, value]));
    expect(calls.get('lineItems.0.materialName')).toBe('Steel Beam W12x26');
    expect(calls.get('lineItems.0.materialId')).toBe('mat-1');
    expect(calls.get('lineItems.0.materialCode')).toBe('SB-W12X26');
    expect(calls.get('lineItems.0.costCode')).toBe('CC-100');
    expect(calls.get('lineItems.0.upc')).toBe('01234567');
    expect(calls.get('lineItems.0.manufacturerPartNumber')).toBe('MPN-1');
    expect(calls.get('lineItems.0.taxCode')).toBe('TX-A');
    expect(calls.get('lineItems.0.unitOfMeasure')).toBe('ea');
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
