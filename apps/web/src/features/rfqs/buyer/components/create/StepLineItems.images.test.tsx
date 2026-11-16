import type { MaterialListItemDto, ProjectListItem } from '@forethread/api-client';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';

import { StepLineItems } from './StepLineItems';
import type { WizardLineItem } from './wizard-types';

// FOR-402: a wizard line keeps the catalogue image of the material it was
// added from, for as long as it stays linked to that material.

const mockUseRfqMaterialSuggestions = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));
vi.mock('../../services/rfqs.service', () => ({
  useRfqMaterialSuggestions: mockUseRfqMaterialSuggestions,
}));
vi.mock('@forethread/ui-components', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  // Identity debounce so the suggestions popup tracks the input synchronously.
  useDebounce: (value: unknown) => value,
  // One button per search result, handing the result straight to onSelect.
  MaterialSearchPanel: (props: {
    results: Array<{ id: string; name: string }>;
    onSelect: (item: { id: string; name: string }) => void;
  }) => (
    <div>
      {props.results.map((result) => (
        <button
          key={result.id}
          type="button"
          data-testid={`search-result-${result.id}`}
          onClick={() => props.onSelect(result)}
        >
          {result.name}
        </button>
      ))}
    </div>
  ),
}));

const projects = [{ id: 'p1', name: 'Alpha Construction' }] as ProjectListItem[];

const materials = [
  {
    id: 'm-1',
    name: 'Steel Beam',
    unitOfMeasure: 'unit',
    imageUrl: 'https://cdn.test/beam.jpg',
  },
  { id: 'm-2', name: 'Copper Wire', unitOfMeasure: 'm', imageUrl: null },
] as MaterialListItemDto[];

const steelSuggestion = {
  id: 'm-1',
  name: 'Steel Beam',
  categoryName: 'Structural',
  uom: 'unit',
  description: 'H-beam',
  imageUrl: 'https://cdn.test/beam.jpg',
};

function Harness({ initial = [] }: { initial?: WizardLineItem[] }) {
  const [items, setItems] = useState(initial);
  return (
    <>
      <StepLineItems
        items={items}
        onItemsChange={setItems}
        projects={projects}
        materials={materials}
        search=""
        onSearchChange={() => undefined}
        onOpenAddFromBom={() => undefined}
        onOpenAddFromMaterialList={() => undefined}
        onCheckAvailability={() => undefined}
        availabilityChecked={false}
        availabilityLoading={false}
        allocations={new Map()}
        onAllocationsChange={() => undefined}
      />
      <output data-testid="state">{JSON.stringify(items)}</output>
    </>
  );
}

const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '[]') as WizardLineItem[];

beforeEach(() => {
  mockUseRfqMaterialSuggestions.mockReset();
  mockUseRfqMaterialSuggestions.mockReturnValue({
    data: { results: [steelSuggestion], frequentlyUsed: [], recentlyUsed: [] },
    isLoading: false,
  });
});

describe('StepLineItems — catalogue images (FOR-402)', () => {
  it('keeps the image of a material added from the catalogue search and shows it in the row', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('search-result-m-1'));
    fireEvent.click(screen.getByTestId('search-result-m-2'));

    const [withImage, withoutImage] = state();
    expect(withImage).toMatchObject({ materialId: 'm-1', imageUrl: 'https://cdn.test/beam.jpg' });
    expect(withoutImage.materialId).toBe('m-2');
    expect(withoutImage.imageUrl ?? null).toBeNull();

    const table = screen.getByTestId('line-items-table');
    expect(within(table).getByRole('img', { name: 'Steel Beam' })).toHaveAttribute(
      'src',
      'https://cdn.test/beam.jpg',
    );
    // The line without an image renders its name and no image.
    const plainRow = screen.getByTestId(`line-item-${withoutImage.key}`);
    expect(plainRow).toHaveTextContent('Copper Wire');
    expect(within(plainRow).queryByRole('img')).not.toBeInTheDocument();
  });

  it('carries the picked suggestion image from the manual row onto the new line', () => {
    render(<Harness />);
    const name = screen.getByTestId('manual-name-p1');
    fireEvent.focus(name);
    fireEvent.change(name, { target: { value: 'Steel' } });
    fireEvent.mouseDown(screen.getByTestId('material-name-suggestion-m-1'));
    fireEvent.change(screen.getByTestId('manual-qty-p1'), { target: { value: '4' } });
    fireEvent.blur(screen.getByTestId('manual-qty-p1'));

    expect(state()).toEqual([
      expect.objectContaining({
        materialId: 'm-1',
        materialName: 'Steel Beam',
        imageUrl: 'https://cdn.test/beam.jpg',
        quantity: 4,
      }),
    ]);
    const row = screen.getByTestId(`line-item-${state()[0].key}`);
    expect(within(row).getByRole('img', { name: 'Steel Beam' })).toBeInTheDocument();
  });

  it('drops the image with the catalogue link when the picked name is edited to free text', () => {
    render(<Harness />);
    const name = screen.getByTestId('manual-name-p1');
    fireEvent.focus(name);
    fireEvent.change(name, { target: { value: 'Steel' } });
    fireEvent.mouseDown(screen.getByTestId('material-name-suggestion-m-1'));
    // Retyping the name unlinks the draft from the catalogue material.
    fireEvent.change(name, { target: { value: 'Steel Beam (salvaged)' } });
    fireEvent.change(screen.getByTestId('manual-qty-p1'), { target: { value: '2' } });
    fireEvent.blur(screen.getByTestId('manual-qty-p1'));

    const [line] = state();
    expect(line.materialName).toBe('Steel Beam (salvaged)');
    expect(line.materialId).toBeUndefined();
    expect(line.imageUrl).toBeUndefined();
    const row = screen.getByTestId(`line-item-${line.key}`);
    expect(within(row).queryByRole('img')).not.toBeInTheDocument();
  });
});
