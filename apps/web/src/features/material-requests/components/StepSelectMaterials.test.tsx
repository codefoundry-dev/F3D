import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { MrWizardLine } from '../wizard/wizard-types';

const mockSuggestions = vi.hoisted(() => vi.fn());
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
}));

// Icon mocks
vi.mock('@forethread/ui-components/assets/icons/checkmark.svg?react', () => ({
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
  render(
    <StepSelectMaterials
      projectId="proj-1"
      lines={lines}
      onToggleLine={onToggleLine}
      onAddManual={onAddManual}
      onRemoveLine={onRemoveLine}
    />,
  );
  return { onToggleLine, onAddManual, onRemoveLine };
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

  it('renders existing manual lines with a remove control', () => {
    const manual: MrWizardLine = {
      key: 'm1',
      source: 'MANUAL',
      materialName: 'Custom bracket',
      unit: 'Each',
      quantity: 3,
      priority: 'STANDARD',
    };
    const { onRemoveLine } = setup([manual]);
    fireEvent.click(screen.getByText('requestMaterials.tabManual'));
    const list = screen.getByTestId('mr-manual-list');
    expect(list).toBeInTheDocument();
    expect(screen.getByText('Custom bracket')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/requestMaterials.removeItem/));
    expect(onRemoveLine).toHaveBeenCalledWith('m1');
  });
});
