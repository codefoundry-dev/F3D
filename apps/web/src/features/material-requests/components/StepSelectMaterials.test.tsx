import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { MrWizardLine } from '../wizard/wizard-types';

const mockSuggestions = vi.hoisted(() => vi.fn());
const mockSuggestionGroups = vi.hoisted(() => vi.fn());
const mockBoms = vi.hoisted(() => vi.fn());
const mockBomDetail = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && 'sku' in opts ? `${key}:${String(opts.sku)}` : key,
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  useDebounce: (v: string) => v,
  StepperInput: ({
    value,
    onValueChange,
    ...rest
  }: {
    value: string;
    onValueChange: (v: string) => void;
  }) => <input value={value} onChange={(e) => onValueChange(e.target.value)} {...rest} />,
}));

// Icon mocks
vi.mock('@forethread/ui-components/assets/icons/checkmark.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/package.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/plus.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/search.svg?react', () => ({
  default: () => <svg />,
}));

vi.mock('../services/material-requests.service', () => ({
  useMrMaterialSuggestions: () => mockSuggestions(),
  useMrMaterialSuggestionGroups: (term: string) => mockSuggestionGroups(term),
  useMrProjectBoms: () => mockBoms(),
  useMrBomDetail: () => mockBomDetail(),
}));

vi.mock('./NewMaterialModal', () => ({
  NewMaterialModal: ({ onAdd }: { onAdd: (d: unknown) => void }) => (
    <div data-testid="new-material-modal">
      <button
        type="button"
        data-testid="modal-add"
        onClick={() => onAdd({ materialName: 'Custom', unit: 'Each', quantity: 3 })}
      >
        add
      </button>
    </div>
  ),
}));

import { StepSelectMaterials } from './StepSelectMaterials';

function setup(lines: MrWizardLine[] = []) {
  const onToggleLine = vi.fn();
  const onAddManual = vi.fn();
  const onRemoveLine = vi.fn();
  const onPatchLine = vi.fn();
  render(
    <StepSelectMaterials
      projectId="proj-1"
      lines={lines}
      onToggleLine={onToggleLine}
      onAddManual={onAddManual}
      onRemoveLine={onRemoveLine}
      onPatchLine={onPatchLine}
    />,
  );
  return { onToggleLine, onAddManual, onRemoveLine, onPatchLine };
}

describe('StepSelectMaterials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuggestions.mockReturnValue({
      data: [
        { id: 'mat-1', name: '2x4x8 Lumber', sku: 'LUM-2048-001', uom: 'Each' },
        { id: 'mat-2', name: 'Drywall Sheets 4x8', sku: 'DRY-4800-002', uom: 'Sheet' },
      ],
    });
    mockSuggestionGroups.mockReturnValue({ data: undefined, isLoading: false });
    mockBoms.mockReturnValue({ data: [] });
    mockBomDetail.mockReturnValue({ data: undefined });
  });

  it('defaults to the Catalog tab and lists catalogue suggestions', () => {
    setup();
    const list = screen.getByTestId('mr-catalog-list');
    expect(list).toBeInTheDocument();
    expect(screen.getByText('2x4x8 Lumber')).toBeInTheDocument();
    expect(screen.getByText('Drywall Sheets 4x8')).toBeInTheDocument();
  });

  it('adds a catalogue line when a row is clicked', () => {
    const { onToggleLine } = setup();
    fireEvent.click(screen.getByText('2x4x8 Lumber'));
    expect(onToggleLine).toHaveBeenCalledTimes(1);
    const line = onToggleLine.mock.calls[0][0] as MrWizardLine;
    expect(line.materialId).toBe('mat-1');
    expect(line.materialName).toBe('2x4x8 Lumber');
    expect(line.source).toBe('CATALOG');
  });

  it('removes an already-selected catalogue line when its row is clicked again', () => {
    const existing: MrWizardLine = {
      key: 'k1',
      source: 'CATALOG',
      materialId: 'mat-1',
      materialName: '2x4x8 Lumber',
      unit: 'Each',
      quantity: 0,
      priority: 'STANDARD',
    };
    const { onRemoveLine, onToggleLine } = setup([existing]);
    fireEvent.click(screen.getByText('2x4x8 Lumber'));
    expect(onRemoveLine).toHaveBeenCalledWith('k1');
    expect(onToggleLine).not.toHaveBeenCalled();
  });

  it('shows the no-BOM empty state on the BOM tab when the project has no BOM', () => {
    setup();
    fireEvent.click(screen.getByText('requestMaterials.tabBom'));
    expect(screen.getByText('requestMaterials.noBom')).toBeInTheDocument();
  });

  it('lists BOM items when an active BOM exists', () => {
    mockBoms.mockReturnValue({ data: [{ id: 'bom-1', status: 'ACTIVE' }] });
    mockBomDetail.mockReturnValue({
      data: {
        items: [{ id: 'it-1', materialName: 'Rebar', matchedMaterialId: 'mat-9', uom: 'Each' }],
      },
    });
    setup();
    fireEvent.click(screen.getByText('requestMaterials.tabBom'));
    expect(screen.getByTestId('mr-bom-list')).toBeInTheDocument();
    expect(screen.getByText('Rebar')).toBeInTheDocument();
  });

  it('opens the New Material modal from the Manual tab and forwards the draft', () => {
    const { onAddManual } = setup();
    fireEvent.click(screen.getByText('requestMaterials.tabManual'));
    fireEvent.click(screen.getByTestId('mr-manual-add'));
    expect(screen.getByTestId('new-material-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('modal-add'));
    expect(onAddManual).toHaveBeenCalledWith({ materialName: 'Custom', unit: 'Each', quantity: 3 });
  });

  it('renders existing manual lines as editable rows with a remove control', () => {
    const manual: MrWizardLine = {
      key: 'm1',
      source: 'MANUAL',
      materialName: 'Custom bracket',
      unit: 'Each',
      quantity: 3,
      priority: 'STANDARD',
    };
    const { onRemoveLine, onPatchLine } = setup([manual]);
    fireEvent.click(screen.getByText('requestMaterials.tabManual'));
    expect(screen.getByTestId('mr-manual-list')).toBeInTheDocument();
    expect(screen.getByTestId('mr-manual-name-m1')).toHaveValue('Custom bracket');

    fireEvent.change(screen.getByTestId('mr-manual-qty-m1'), { target: { value: '7' } });
    expect(onPatchLine).toHaveBeenCalledWith('m1', { quantity: 7 });

    fireEvent.click(screen.getByLabelText(/requestMaterials.removeItem/));
    expect(onRemoveLine).toHaveBeenCalledWith('m1');
  });

  it('adds a manual line item from the inline draft row', () => {
    const { onAddManual } = setup();
    fireEvent.click(screen.getByText('requestMaterials.tabManual'));

    fireEvent.change(screen.getByTestId('mr-manual-draft-name'), {
      target: { value: '  Scaffold clamp  ' },
    });
    fireEvent.change(screen.getByTestId('mr-manual-draft-qty'), { target: { value: '4' } });
    fireEvent.click(screen.getByTestId('mr-manual-draft-add'));

    expect(onAddManual).toHaveBeenCalledWith({
      materialName: 'Scaffold clamp',
      materialId: undefined,
      unit: 'Each',
      quantity: 4,
      description: undefined,
    });
    // The draft row resets so the next line can be typed straight away.
    expect(screen.getByTestId('mr-manual-draft-name')).toHaveValue('');
  });

  it('blocks an incomplete draft row and explains why', () => {
    const { onAddManual } = setup();
    fireEvent.click(screen.getByText('requestMaterials.tabManual'));

    fireEvent.click(screen.getByTestId('mr-manual-draft-add'));
    expect(onAddManual).not.toHaveBeenCalled();
    expect(screen.getByTestId('mr-manual-draft-error')).toHaveTextContent(
      'requestMaterials.manualNameRequired',
    );

    fireEvent.change(screen.getByTestId('mr-manual-draft-name'), { target: { value: 'Anchor' } });
    fireEvent.click(screen.getByTestId('mr-manual-draft-add'));
    expect(onAddManual).not.toHaveBeenCalled();
    expect(screen.getByTestId('mr-manual-draft-error')).toHaveTextContent(
      'requestMaterials.manualQtyRequired',
    );
  });

  it('always shows a blank row, with or without existing lines (FOR-403)', () => {
    setup();
    fireEvent.click(screen.getByText('requestMaterials.tabManual'));
    const list = screen.getByTestId('mr-manual-list');
    expect(list).toContainElement(screen.getByTestId('mr-manual-draft'));
    expect(screen.getByTestId('mr-manual-draft-name')).toHaveValue('');
  });

  it('auto-adds a completed blank row when focus leaves it (FOR-403)', () => {
    const { onAddManual } = setup();
    fireEvent.click(screen.getByText('requestMaterials.tabManual'));

    fireEvent.change(screen.getByTestId('mr-manual-draft-name'), { target: { value: 'Anchor' } });
    fireEvent.change(screen.getByTestId('mr-manual-draft-qty'), { target: { value: '2' } });

    // Moving between the row's own fields must not add it yet.
    fireEvent.blur(screen.getByTestId('mr-manual-draft-qty'), {
      relatedTarget: screen.getByTestId('mr-manual-draft-unit'),
    });
    expect(onAddManual).not.toHaveBeenCalled();

    fireEvent.blur(screen.getByTestId('mr-manual-draft-unit'), { relatedTarget: document.body });
    expect(onAddManual).toHaveBeenCalledTimes(1);
    expect(onAddManual).toHaveBeenCalledWith(
      expect.objectContaining({ materialName: 'Anchor', quantity: 2 }),
    );
    expect(screen.getByTestId('mr-manual-draft-name')).toHaveValue('');
  });

  it('leaves an unfinished blank row alone on blur, without errors (FOR-403)', () => {
    const { onAddManual } = setup();
    fireEvent.click(screen.getByText('requestMaterials.tabManual'));

    fireEvent.change(screen.getByTestId('mr-manual-draft-name'), { target: { value: 'Anchor' } });
    fireEvent.blur(screen.getByTestId('mr-manual-draft-name'), { relatedTarget: document.body });

    expect(onAddManual).not.toHaveBeenCalled();
    expect(screen.queryByTestId('mr-manual-draft-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('mr-manual-draft-name')).toHaveValue('Anchor');
  });

  it('adds the blank row once on Enter in the quantity field (FOR-403)', () => {
    const { onAddManual } = setup();
    fireEvent.click(screen.getByText('requestMaterials.tabManual'));

    fireEvent.change(screen.getByTestId('mr-manual-draft-name'), { target: { value: 'Anchor' } });
    fireEvent.change(screen.getByTestId('mr-manual-draft-qty'), { target: { value: '5' } });
    fireEvent.keyUp(screen.getByTestId('mr-manual-draft-qty'), { key: 'Enter' });

    expect(onAddManual).toHaveBeenCalledTimes(1);
  });

  it('links the draft row to a catalogue material picked from the suggestions popup', () => {
    mockSuggestionGroups.mockReturnValue({
      isLoading: false,
      data: {
        results: [
          { id: 'mat-7', name: 'Rebar #4', uom: 'Rod', description: 'Grade 60', imageUrl: null },
        ],
        frequentlyUsed: [],
        recentlyUsed: [],
      },
    });
    const { onAddManual } = setup();
    fireEvent.click(screen.getByText('requestMaterials.tabManual'));

    const nameInput = screen.getByTestId('mr-manual-draft-name');
    fireEvent.change(nameInput, { target: { value: 'reb' } });
    fireEvent.mouseDown(screen.getByTestId('mr-manual-suggestion-mat-7'));
    fireEvent.change(screen.getByTestId('mr-manual-draft-qty'), { target: { value: '12' } });
    fireEvent.click(screen.getByTestId('mr-manual-draft-add'));

    expect(onAddManual).toHaveBeenCalledWith({
      materialName: 'Rebar #4',
      materialId: 'mat-7',
      unit: 'Rod',
      quantity: 12,
      description: 'Grade 60',
    });
  });
});
