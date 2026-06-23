import { render, screen, fireEvent } from '@testing-library/react';

const mockUseBom = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: (p: any) => (
    <span data-testid="badge" className={p.className}>
      {p.children}
    </span>
  ),
  Button: (p: any) => (
    <button onClick={p.onClick} disabled={p.disabled}>
      {p.children}
    </button>
  ),
  Modal: (p: any) => <div data-testid="modal">{p.children}</div>,
  ModalGridBackground: () => <div data-testid="modal-grid-bg" />,
  Spinner: () => <div data-testid="spinner" />,
}));

vi.mock('../hooks/useBoms', () => ({
  useBom: mockUseBom,
}));

import { BomItemsModal } from './BomItemsModal';

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    materialName: 'Steel Beam',
    matchedMaterialId: 'm-1',
    matchedMaterialName: 'Steel Beam (catalogue)',
    description: 'A sturdy beam',
    uom: 'EA',
    quantity: 10,
    category: 'Structural',
    materialType: 'Raw',
    matchConfidence: 0.9,
    sortOrder: 0,
    ...overrides,
  };
}

function makeBom(items: ReturnType<typeof makeItem>[]) {
  return {
    id: 'bom-1',
    bomNumber: 'BOM-001',
    projectId: 'proj-1',
    status: 'ACTIVE',
    extractionId: null,
    itemCount: items.length,
    matchedCount: items.length,
    createdBy: { id: 'u1', name: 'Alice' },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    items,
  };
}

describe('BomItemsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a spinner while the BOM is loading', () => {
    mockUseBom.mockReturnValue({ data: undefined, isLoading: true });
    render(<BomItemsModal bomId="bom-1" onClose={() => {}} />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(screen.queryByTestId('bom-items-view-table')).not.toBeInTheDocument();
  });

  it('shows a spinner when loading is done but data is missing', () => {
    mockUseBom.mockReturnValue({ data: undefined, isLoading: false });
    render(<BomItemsModal bomId="bom-1" onClose={() => {}} />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders the column headers and a populated item row', () => {
    mockUseBom.mockReturnValue({ data: makeBom([makeItem()]), isLoading: false });
    render(<BomItemsModal bomId="bom-1" onClose={() => {}} />);

    expect(screen.getByTestId('bom-items-view-table')).toBeInTheDocument();
    expect(screen.getByText('viewModal.columns.materialName')).toBeInTheDocument();
    expect(screen.getByText('viewModal.columns.confidence')).toBeInTheDocument();
    expect(screen.getByText('Steel Beam')).toBeInTheDocument();
    expect(screen.getByText('Steel Beam (catalogue)')).toBeInTheDocument();
    expect(screen.getByText('A sturdy beam')).toBeInTheDocument();
    expect(screen.getByText('Structural')).toBeInTheDocument();
    expect(screen.getByText('Raw')).toBeInTheDocument();
  });

  it('renders an em dash for each null field', () => {
    mockUseBom.mockReturnValue({
      data: makeBom([
        makeItem({
          matchedMaterialName: null,
          description: null,
          uom: null,
          quantity: null,
          category: null,
          materialType: null,
          matchConfidence: null,
        }),
      ]),
      isLoading: false,
    });
    render(<BomItemsModal bomId="bom-1" onClose={() => {}} />);

    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBe(6);
  });

  it('labels a manual (null confidence) match with no percentage', () => {
    mockUseBom.mockReturnValue({
      data: makeBom([makeItem({ matchConfidence: null })]),
      isLoading: false,
    });
    render(<BomItemsModal bomId="bom-1" onClose={() => {}} />);

    const badge = screen.getByTestId('badge');
    expect(badge).toHaveTextContent('viewModal.manual');
    expect(screen.queryByText('%', { exact: false })).not.toBeInTheDocument();
  });

  it('labels a high-confidence match (>= 0.85) with its percentage', () => {
    mockUseBom.mockReturnValue({
      data: makeBom([makeItem({ matchConfidence: 0.92 })]),
      isLoading: false,
    });
    render(<BomItemsModal bomId="bom-1" onClose={() => {}} />);

    expect(screen.getByTestId('badge')).toHaveTextContent('create.high');
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('labels a medium-confidence match (>= 0.5)', () => {
    mockUseBom.mockReturnValue({
      data: makeBom([makeItem({ matchConfidence: 0.5 })]),
      isLoading: false,
    });
    render(<BomItemsModal bomId="bom-1" onClose={() => {}} />);

    expect(screen.getByTestId('badge')).toHaveTextContent('create.medium');
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('labels a low-confidence match (< 0.5)', () => {
    mockUseBom.mockReturnValue({
      data: makeBom([makeItem({ matchConfidence: 0.3 })]),
      isLoading: false,
    });
    render(<BomItemsModal bomId="bom-1" onClose={() => {}} />);

    expect(screen.getByTestId('badge')).toHaveTextContent('create.low');
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    mockUseBom.mockReturnValue({ data: makeBom([makeItem()]), isLoading: false });
    render(<BomItemsModal bomId="bom-1" onClose={onClose} />);

    fireEvent.click(screen.getByText('viewModal.close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
