import { render, screen, fireEvent } from '@testing-library/react';

const mockUseProjectBoms = vi.hoisted(() => vi.fn());
const mockUseBom = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: (p: any) => <span>{p.children}</span>,
  Button: (p: any) => (
    <button onClick={p.onClick} disabled={p.disabled} data-testid={p['data-testid']}>
      {p.children}
    </button>
  ),
  Input: (p: any) => (
    <input
      value={p.value}
      onChange={p.onChange}
      placeholder={p.placeholder}
      data-testid={p['data-testid']}
    />
  ),
  Spinner: () => <div data-testid="spinner" />,
  TablePagination: (p: any) => (
    <div data-testid="pagination">
      <span>{p.showingLabel({ from: 1, to: p.totalItems, total: p.totalItems })}</span>
      <button onClick={() => p.onPageChange(2)}>{p.nextLabel}</button>
      <button onClick={() => p.onPageSizeChange(50)}>{p.rowsPerPageLabel}</button>
    </div>
  ),
}));

vi.mock('@forethread/ui-components/assets/icons/chevron-down.svg?react', () => ({
  default: (p: any) => <svg data-testid="chevron-icon" {...p} />,
}));

vi.mock('@forethread/ui-components/assets/icons/search.svg?react', () => ({
  default: (p: any) => <svg data-testid="search-icon" {...p} />,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: {
    projectBomCreate: '/projects/:id/bom/new',
    projectBomDetail: '/projects/:id/bom/:bomId',
    projectBomEdit: '/projects/:id/bom/:bomId/edit',
  },
}));

vi.mock('../hooks/useBoms', () => ({
  useProjectBoms: mockUseProjectBoms,
  useBom: mockUseBom,
}));

import { BomTab } from './BomTab';

function makeBom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bom-1',
    bomNumber: 'BOM-001',
    projectId: 'proj-1',
    status: 'ACTIVE',
    extractionId: null,
    itemCount: 5,
    matchedCount: 3,
    createdBy: { id: 'u1', name: 'Alice' },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    materialName: 'Cement',
    matchedMaterialId: 'mat-1',
    matchedMaterialName: 'Portland Cement',
    description: 'Grey cement 42.5N',
    uom: 'bag',
    quantity: 10,
    category: 'Concrete',
    materialType: 'Raw',
    matchConfidence: 0.9,
    sortOrder: 0,
    ...overrides,
  };
}

/** useBom mock resolving per-BOM detail payloads keyed by id. */
function stubBomDetails(details: Record<string, Record<string, unknown>[]>) {
  mockUseBom.mockImplementation((id: string | null) => {
    if (id && details[id]) {
      return {
        data: { ...makeBom({ id }), items: details[id] },
        isLoading: false,
        isError: false,
      };
    }
    return { data: undefined, isLoading: false, isError: false };
  });
}

describe('BomTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBomDetails({});
  });

  it('renders a spinner while loading', () => {
    mockUseProjectBoms.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<BomTab projectId="proj-1" />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(screen.queryByTestId('bom-tab')).not.toBeInTheDocument();
  });

  it('renders an error message when the query fails', () => {
    mockUseProjectBoms.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<BomTab projectId="proj-1" />);
    expect(screen.getByText('tab.loadFailed')).toBeInTheDocument();
  });

  it('renders empty states for both sections when there are no BOMs', () => {
    mockUseProjectBoms.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<BomTab projectId="proj-1" />);
    expect(screen.getByText('tab.emptyActive')).toBeInTheDocument();
    expect(screen.getByText('tab.emptyHistorical')).toBeInTheDocument();
  });

  it('renders the active BOM materials directly as a list', () => {
    mockUseProjectBoms.mockReturnValue({
      data: [makeBom({ id: 'bom-1', bomNumber: 'BOM-ACTIVE', status: 'ACTIVE' })],
      isLoading: false,
      isError: false,
    });
    stubBomDetails({
      'bom-1': [makeItem({ id: 'item-1', materialName: 'Cement' })],
    });
    render(<BomTab projectId="proj-1" />);

    expect(screen.getByTestId('active-bom-meta')).toHaveTextContent('BOM-ACTIVE');
    expect(screen.getByTestId('bom-items-view-table')).toBeInTheDocument();
    expect(screen.getByText('Cement')).toBeInTheDocument();
    expect(mockUseBom).toHaveBeenCalledWith('bom-1');
  });

  it('does not render eye-icon view actions anywhere', () => {
    mockUseProjectBoms.mockReturnValue({
      data: [
        makeBom({ id: 'bom-1', status: 'ACTIVE' }),
        makeBom({ id: 'bom-2', status: 'SUPERSEDED' }),
      ],
      isLoading: false,
      isError: false,
    });
    render(<BomTab projectId="proj-1" />);

    expect(screen.queryByTestId('bom-view-bom-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bom-view-bom-2')).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows a spinner while the active BOM items load', () => {
    mockUseProjectBoms.mockReturnValue({ data: [makeBom()], isLoading: false, isError: false });
    mockUseBom.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<BomTab projectId="proj-1" />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows an error message when the active BOM items fail to load', () => {
    mockUseProjectBoms.mockReturnValue({ data: [makeBom()], isLoading: false, isError: false });
    mockUseBom.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<BomTab projectId="proj-1" />);
    expect(screen.getByText('tab.itemsLoadFailed')).toBeInTheDocument();
  });

  it('shows an empty message when the active BOM has no line items', () => {
    mockUseProjectBoms.mockReturnValue({ data: [makeBom()], isLoading: false, isError: false });
    stubBomDetails({ 'bom-1': [] });
    render(<BomTab projectId="proj-1" />);
    expect(screen.getByText('tab.noItems')).toBeInTheDocument();
  });

  it('filters the active BOM materials by search term', () => {
    mockUseProjectBoms.mockReturnValue({ data: [makeBom()], isLoading: false, isError: false });
    stubBomDetails({
      'bom-1': [
        makeItem({ id: 'item-1', materialName: 'Cement' }),
        makeItem({ id: 'item-2', materialName: 'Steel Rebar', matchedMaterialName: null }),
      ],
    });
    render(<BomTab projectId="proj-1" />);

    fireEvent.change(screen.getByTestId('bom-search'), { target: { value: 'steel' } });

    expect(screen.queryByText('Cement')).not.toBeInTheDocument();
    expect(screen.getByText('Steel Rebar')).toBeInTheDocument();
  });

  it('shows a no-results message when no materials match the search', () => {
    mockUseProjectBoms.mockReturnValue({ data: [makeBom()], isLoading: false, isError: false });
    stubBomDetails({ 'bom-1': [makeItem({ materialName: 'Cement' })] });
    render(<BomTab projectId="proj-1" />);

    fireEvent.change(screen.getByTestId('bom-search'), { target: { value: 'zzz' } });
    expect(screen.getByText('tab.noMatchingItems')).toBeInTheDocument();
  });

  it('treats whitespace-only search as no filter', () => {
    mockUseProjectBoms.mockReturnValue({ data: [makeBom()], isLoading: false, isError: false });
    stubBomDetails({ 'bom-1': [makeItem({ materialName: 'Cement' })] });
    render(<BomTab projectId="proj-1" />);

    fireEvent.change(screen.getByTestId('bom-search'), { target: { value: '   ' } });
    expect(screen.getByText('Cement')).toBeInTheDocument();
  });

  it('navigates to the BOM create route with the project id resolved', () => {
    mockUseProjectBoms.mockReturnValue({ data: [makeBom()], isLoading: false, isError: false });
    render(<BomTab projectId="proj-42" />);

    fireEvent.click(screen.getByText('tab.createNew'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects/proj-42/bom/new');
  });

  it('navigates to the Edit BOM page from the active BOM header', () => {
    mockUseProjectBoms.mockReturnValue({
      data: [makeBom({ id: 'bom-1', status: 'ACTIVE' })],
      isLoading: false,
      isError: false,
    });
    render(<BomTab projectId="proj-1" />);

    fireEvent.click(screen.getByTestId('bom-edit-active'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects/proj-1/bom/bom-1/edit');
  });

  it('does not render the Edit action when there is no active BOM', () => {
    mockUseProjectBoms.mockReturnValue({
      data: [makeBom({ id: 'bom-2', status: 'SUPERSEDED' })],
      isLoading: false,
      isError: false,
    });
    render(<BomTab projectId="proj-1" />);
    expect(screen.queryByTestId('bom-edit-active')).not.toBeInTheDocument();
  });

  it('lists historical BOM versions as summary rows', () => {
    mockUseProjectBoms.mockReturnValue({
      data: [
        makeBom({ id: 'bom-1', bomNumber: 'BOM-ACTIVE', status: 'ACTIVE' }),
        makeBom({ id: 'bom-2', bomNumber: 'BOM-OLD', status: 'SUPERSEDED' }),
      ],
      isLoading: false,
      isError: false,
    });
    render(<BomTab projectId="proj-1" />);

    expect(screen.getByTestId('bom-row-bom-2')).toBeInTheDocument();
    expect(screen.getByText('BOM-OLD')).toBeInTheDocument();
    expect(screen.getByText('3/5')).toBeInTheDocument();
    // The active BOM is not a summary row — its materials render directly.
    expect(screen.queryByTestId('bom-row-bom-1')).not.toBeInTheDocument();
  });

  it('expands a historical BOM row to show its materials in place', () => {
    mockUseProjectBoms.mockReturnValue({
      data: [makeBom({ id: 'bom-2', bomNumber: 'BOM-OLD', status: 'SUPERSEDED' })],
      isLoading: false,
      isError: false,
    });
    stubBomDetails({ 'bom-2': [makeItem({ id: 'item-9', materialName: 'Old Timber' })] });
    render(<BomTab projectId="proj-1" />);

    expect(screen.queryByTestId('bom-items-row-bom-2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('bom-toggle-bom-2'));
    expect(screen.getByTestId('bom-items-row-bom-2')).toBeInTheDocument();
    expect(screen.getByText('Old Timber')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('bom-toggle-bom-2'));
    expect(screen.queryByTestId('bom-items-row-bom-2')).not.toBeInTheDocument();
  });

  it('renders pagination and forwards page/size changes for the historical table', () => {
    mockUseProjectBoms.mockReturnValue({
      data: [makeBom({ id: 'bom-2', status: 'SUPERSEDED' })],
      isLoading: false,
      isError: false,
    });
    render(<BomTab projectId="proj-1" />);

    const next = screen.getByText('tab.next');
    fireEvent.click(next);
    const rowsPerPage = screen.getByText('tab.rowsPerPage');
    fireEvent.click(rowsPerPage);
    expect(screen.getByTestId('pagination')).toBeInTheDocument();
  });
});
