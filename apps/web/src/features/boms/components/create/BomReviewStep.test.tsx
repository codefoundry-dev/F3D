import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';

const mockApi = vi.hoisted(() => ({
  getMaterialCategories: vi.fn(),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', () => mockApi);

vi.mock('@forethread/po-shared', () => ({
  NAKED_INPUT_CLASS: '',
  UOM_OPTIONS: [{ value: 'unit', label: 'unit' }],
}));

vi.mock('@forethread/ui-components', () => ({
  Alert: (p: any) => <div role="alert">{p.children}</div>,
  Badge: (p: any) => <span data-testid="badge">{p.children}</span>,
  Input: (p: any) => (
    <input
      aria-label={p['aria-label']}
      value={p.value}
      placeholder={p.placeholder}
      onChange={p.onChange}
      onKeyDown={p.onKeyDown}
    />
  ),
  CustomDropdown: (p: any) => (
    <select aria-label={p.placeholder} value={p.value} onChange={(e) => p.onChange(e.target.value)}>
      <option value="" />
      {(p.options ?? []).map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
  MaterialSearchPanel: (p: any) => (
    <div data-testid="material-search-panel">
      <button
        type="button"
        data-testid="panel-pick"
        onClick={() =>
          p.onPickItem({
            id: 'm1',
            name: 'Mat',
            unit: 'unit',
            category: 'Steel',
            subCategory: 'Reinforcement',
          })
        }
      >
        pick
      </button>
      {p.footerAction}
    </div>
  ),
  cn: (...a: any[]) => a.filter(Boolean).join(' '),
  onDecimalOnly: vi.fn(),
}));

vi.mock('../../hooks/useMaterialSearchQuery', () => ({
  useMaterialSearchQuery: () => ({
    results: [{ id: 'm1', name: 'Match', unit: 'unit' }],
    totalCount: 1,
    isLoading: false,
  }),
}));

vi.mock('./CreatePrivateMaterialModal', () => ({
  CreatePrivateMaterialModal: (p: any) => (
    <div data-testid="create-private-modal">
      <button
        type="button"
        data-testid="modal-create"
        onClick={() =>
          p.onCreated({
            id: 'm2',
            name: 'Priv',
            unitOfMeasure: 'unit',
            categoryName: 'Cat',
            subCategory: 'PrivSub',
          })
        }
      >
        create
      </button>
      <button type="button" data-testid="modal-close" onClick={p.onClose}>
        close
      </button>
    </div>
  ),
}));

import { emptyRow, type BomDraftRow } from './bom-draft';
import { BomReviewStep } from './BomReviewStep';

function row(overrides: Partial<BomDraftRow> = {}): BomDraftRow {
  return { ...emptyRow(), ...overrides };
}

/**
 * Controlled wrapper that owns the rows state so the trailing-empty-row effect
 * and updates flow through onRowsChange like in the real page.
 */
function Harness({ initialRows }: { initialRows: BomDraftRow[] }) {
  const [rows, setRows] = useState<BomDraftRow[]>(initialRows);
  return <BomReviewStep rows={rows} onRowsChange={setRows} />;
}

function renderHarness(initialRows: BomDraftRow[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Harness initialRows={initialRows} />
    </QueryClientProvider>,
  );
}

describe('BomReviewStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getMaterialCategories.mockResolvedValue([{ id: 'c1', name: 'Cat' }]);
  });

  it('renders the table headers', () => {
    renderHarness([]);
    expect(screen.getByTestId('bom-review-table')).toBeInTheDocument();
    expect(screen.getByText('create.columns.materialName')).toBeInTheDocument();
    expect(screen.getByText('create.columns.match')).toBeInTheDocument();
    expect(screen.getByText('create.columns.confidence')).toBeInTheDocument();
    expect(screen.getByText('create.columns.actions')).toBeInTheDocument();
  });

  it('appends a trailing empty row when given no rows', () => {
    renderHarness([]);
    expect(screen.getByTestId('bom-review-row-0')).toBeInTheDocument();
  });

  it('appends a trailing empty row when the last row is not empty', () => {
    renderHarness([row({ materialName: 'Steel' })]);
    // original row 0 + appended empty row 1
    expect(screen.getByTestId('bom-review-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('bom-review-row-1')).toBeInTheDocument();
  });

  it('shows the unmatched destructive alert when a real row is unmatched', () => {
    renderHarness([row({ materialName: 'Steel', matchedMaterialId: null })]);
    expect(screen.getByRole('alert')).toHaveTextContent('create.unmatchedAlert');
  });

  it('does not show the alert when all real rows are matched', () => {
    renderHarness([
      row({ materialName: 'Steel', matchedMaterialId: 'm9', matchedMaterialName: 'Steel Bar' }),
    ]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('edits the material name input', () => {
    renderHarness([]);
    const input = screen.getAllByLabelText('create.columns.materialName')[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Cement' } });
    expect(
      (screen.getAllByLabelText('create.columns.materialName')[0] as HTMLInputElement).value,
    ).toBe('Cement');
  });

  it('edits the description input', () => {
    renderHarness([]);
    const input = screen.getAllByLabelText('create.columns.description')[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Fine grade' } });
    expect(
      (screen.getAllByLabelText('create.columns.description')[0] as HTMLInputElement).value,
    ).toBe('Fine grade');
  });

  it('edits the quantity input', () => {
    renderHarness([]);
    const input = screen.getAllByLabelText('create.columns.quantity')[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5' } });
    expect((screen.getAllByLabelText('create.columns.quantity')[0] as HTMLInputElement).value).toBe(
      '5',
    );
  });

  it('increments and decrements the quantity via the spinner buttons', () => {
    renderHarness([row({ materialName: 'Steel', quantity: '2' })]);
    fireEvent.click(screen.getAllByLabelText('Increase quantity')[0]);
    expect((screen.getAllByLabelText('create.columns.quantity')[0] as HTMLInputElement).value).toBe(
      '3',
    );
    fireEvent.click(screen.getAllByLabelText('Decrease quantity')[0]);
    expect((screen.getAllByLabelText('create.columns.quantity')[0] as HTMLInputElement).value).toBe(
      '2',
    );
  });

  it('does not let quantity decrement below zero', () => {
    renderHarness([row({ materialName: 'Steel', quantity: '0' })]);
    fireEvent.click(screen.getAllByLabelText('Decrease quantity')[0]);
    expect((screen.getAllByLabelText('create.columns.quantity')[0] as HTMLInputElement).value).toBe(
      '0',
    );
  });

  it('edits the uom dropdown', () => {
    renderHarness([row({ materialName: 'Steel', uom: '' })]);
    const select = screen.getAllByLabelText('UoM')[0] as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'unit' } });
    expect((screen.getAllByLabelText('UoM')[0] as HTMLSelectElement).value).toBe('unit');
  });

  it('keeps a custom uom value as an option', () => {
    renderHarness([row({ materialName: 'Steel', uom: 'drum' })]);
    expect(screen.getByRole('option', { name: 'drum' })).toBeInTheDocument();
  });

  it('edits the category dropdown after categories load', async () => {
    renderHarness([row({ materialName: 'Steel', category: '' })]);
    const tr = screen.getByTestId('bom-review-row-0');
    await waitFor(() =>
      expect(within(tr).getByRole('option', { name: 'Cat' })).toBeInTheDocument(),
    );
    const select = within(tr).getByLabelText('—');
    fireEvent.change(select, { target: { value: 'Cat' } });
    expect(
      within(screen.getByTestId('bom-review-row-0')).getByLabelText<HTMLSelectElement>('—').value,
    ).toBe('Cat');
  });

  it('keeps a custom category value as an option', () => {
    renderHarness([row({ materialName: 'Steel', category: 'Custom Cat' })]);
    expect(screen.getByRole('option', { name: 'Custom Cat' })).toBeInTheDocument();
  });

  it('edits the material type input', () => {
    renderHarness([row({ materialName: 'Steel' })]);
    const input = screen.getAllByLabelText('create.columns.materialType')[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Raw' } });
    expect(
      (screen.getAllByLabelText('create.columns.materialType')[0] as HTMLInputElement).value,
    ).toBe('Raw');
  });

  it('duplicates a row', () => {
    renderHarness([row({ materialName: 'Steel' })]);
    fireEvent.click(screen.getAllByLabelText('create.duplicateRow')[0]);
    // duplicated -> 2 real rows + 1 trailing empty
    expect(screen.getByTestId('bom-review-row-2')).toBeInTheDocument();
  });

  it('removes a row', () => {
    renderHarness([row({ materialName: 'Steel' }), row({ materialName: 'Cement' })]);
    expect(screen.getByTestId('bom-review-row-2')).toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText('create.removeRow')[0]);
    expect(screen.queryByTestId('bom-review-row-2')).not.toBeInTheDocument();
  });

  it('opens the match panel and picks a material', () => {
    renderHarness([row({ materialName: 'Steel' })]);
    fireEvent.click(screen.getByTestId('bom-match-cell-0'));
    expect(screen.getByTestId('material-search-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('panel-pick'));
    // the picked name now shows in the (closed) match cell
    expect(screen.getByTestId('bom-match-cell-0')).toHaveTextContent('Mat');
    // category + material type are filled from the picked catalogue material
    const tr = screen.getByTestId('bom-review-row-0');
    expect(within(tr).getByLabelText<HTMLSelectElement>('—').value).toBe('Steel');
    expect(within(tr).getByLabelText<HTMLInputElement>('create.columns.materialType').value).toBe(
      'Reinforcement',
    );
  });

  it('overwrites a suggestion-derived category and material type when a different material is picked', () => {
    // The row arrives pre-filled from an unconfirmed suggestion; an explicit
    // pick is authoritative and must replace those values.
    renderHarness([row({ materialName: 'Steel', category: 'OldCat', materialType: 'OldType' })]);
    fireEvent.click(screen.getByTestId('bom-match-cell-0'));
    fireEvent.click(screen.getByTestId('panel-pick'));
    const tr = screen.getByTestId('bom-review-row-0');
    expect(within(tr).getByLabelText<HTMLSelectElement>('—').value).toBe('Steel');
    expect(within(tr).getByLabelText<HTMLInputElement>('create.columns.materialType').value).toBe(
      'Reinforcement',
    );
  });

  it('opens the create-private-material modal from the panel footer and patches the row on create', () => {
    renderHarness([row({ materialName: 'Steel' })]);
    fireEvent.click(screen.getByTestId('bom-match-cell-0'));
    fireEvent.click(screen.getByTestId('bom-create-material-0'));
    expect(screen.getByTestId('create-private-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('modal-create'));
    expect(screen.queryByTestId('create-private-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('bom-match-cell-0')).toHaveTextContent('Priv');
    // material type is filled from the created material's sub-category
    expect(
      within(screen.getByTestId('bom-review-row-0')).getByLabelText<HTMLInputElement>(
        'create.columns.materialType',
      ).value,
    ).toBe('PrivSub');
  });

  it('closes the create-private-material modal without changes', () => {
    renderHarness([row({ materialName: 'Steel' })]);
    fireEvent.click(screen.getByTestId('bom-match-cell-0'));
    fireEvent.click(screen.getByTestId('bom-create-material-0'));
    fireEvent.click(screen.getByTestId('modal-close'));
    expect(screen.queryByTestId('create-private-modal')).not.toBeInTheDocument();
  });

  it('shows the manual badge for a matched row with null confidence', () => {
    renderHarness([
      row({
        materialName: 'Steel',
        matchedMaterialId: 'm1',
        matchedMaterialName: 'Steel Bar',
        matchConfidence: null,
      }),
    ]);
    expect(screen.getByText('create.manual')).toBeInTheDocument();
  });

  it('shows the high-confidence badge with a percentage', () => {
    renderHarness([
      row({
        materialName: 'Steel',
        matchedMaterialId: 'm1',
        matchedMaterialName: 'Steel Bar',
        matchConfidence: 0.9,
      }),
    ]);
    expect(screen.getByText('create.high')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('shows the medium-confidence badge', () => {
    renderHarness([
      row({
        materialName: 'Steel',
        matchedMaterialId: 'm1',
        matchedMaterialName: 'Steel Bar',
        matchConfidence: 0.6,
      }),
    ]);
    expect(screen.getByText('create.medium')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('shows the low-confidence badge', () => {
    renderHarness([
      row({
        materialName: 'Steel',
        matchedMaterialId: 'm1',
        matchedMaterialName: 'Steel Bar',
        matchConfidence: 0.2,
      }),
    ]);
    expect(screen.getByText('create.low')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('shows the no-match badge for an unmatched row with no candidates (red tint)', () => {
    renderHarness([row({ materialName: 'Steel', matchedMaterialId: null, candidates: [] })]);
    const tr = screen.getByTestId('bom-review-row-0');
    expect(within(tr).getByText('create.noMatch')).toBeInTheDocument();
    expect(tr.className).toContain('FFC9CB');
  });

  it('uses the top candidate score and name when unmatched but candidates exist (amber tint)', () => {
    renderHarness([
      row({
        materialName: 'Steel',
        matchedMaterialId: null,
        candidates: [{ materialId: 'cm1', name: 'Suggested', confidence: 0.9 }] as any,
      }),
    ]);
    const tr = screen.getByTestId('bom-review-row-0');
    expect(within(tr).getByText('create.high')).toBeInTheDocument();
    expect(screen.getByTestId('bom-match-cell-0')).toHaveTextContent('Suggested');
    expect(tr.className).toContain('FFE6CA');
  });

  it('tints an auto-accepted low-confidence match amber (flagged for review)', () => {
    renderHarness([
      row({
        materialName: 'Steel',
        matchedMaterialId: 'm1',
        matchedMaterialName: 'Steel Bar',
        matchConfidence: 0.6,
      }),
    ]);
    expect(screen.getByTestId('bom-review-row-0').className).toContain('FFE6CA');
  });

  it('does not tint a high-confidence match', () => {
    renderHarness([
      row({
        materialName: 'Steel',
        matchedMaterialId: 'm1',
        matchedMaterialName: 'Steel Bar',
        matchConfidence: 0.9,
      }),
    ]);
    const cls = screen.getByTestId('bom-review-row-0').className;
    expect(cls).not.toContain('FFE6CA');
    expect(cls).not.toContain('FFC9CB');
  });

  it('tints a manually resolved row blue and renders its badge', () => {
    const r = row({
      materialName: 'Steel',
      matchedMaterialId: 'm1',
      matchedMaterialName: 'Steel Bar',
      matchConfidence: null,
      manuallyResolved: true,
    });
    renderHarness([r]);
    const tr = screen.getByTestId('bom-review-row-0');
    expect(tr.className).toContain('C5E3FF');
  });
});
