import { render, screen, fireEvent } from '@testing-library/react';

const mockUseProjectBoms = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Button: (p: any) => (
    <button onClick={p.onClick} disabled={p.disabled}>
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

vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: (p: any) => <svg data-testid="eye-icon" {...p} />,
}));

vi.mock('@forethread/ui-components/assets/icons/search.svg?react', () => ({
  default: (p: any) => <svg data-testid="search-icon" {...p} />,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: { projectBomCreate: '/projects/:id/boms/new' },
}));

vi.mock('../hooks/useBoms', () => ({
  useProjectBoms: mockUseProjectBoms,
}));

vi.mock('./BomItemsModal', () => ({
  BomItemsModal: ({ bomId, onClose }: { bomId: string; onClose: () => void }) => (
    <div data-testid="bom-items-modal">
      {bomId}
      <button onClick={onClose}>x</button>
    </div>
  ),
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

describe('BomTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('splits BOMs into active and historical by status', () => {
    mockUseProjectBoms.mockReturnValue({
      data: [
        makeBom({ id: 'bom-1', bomNumber: 'BOM-ACTIVE', status: 'ACTIVE' }),
        makeBom({ id: 'bom-2', bomNumber: 'BOM-OLD', status: 'SUPERSEDED' }),
      ],
      isLoading: false,
      isError: false,
    });
    render(<BomTab projectId="proj-1" />);

    expect(screen.getByText('BOM-ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('BOM-OLD')).toBeInTheDocument();
    expect(screen.getByTestId('bom-row-bom-1')).toBeInTheDocument();
    expect(screen.getByTestId('bom-row-bom-2')).toBeInTheDocument();
    // matched/items rendered as "3/5"
    expect(screen.getAllByText('3/5').length).toBe(2);
    expect(screen.getAllByText('Alice').length).toBe(2);
  });

  it('renders the section titles and create-new button', () => {
    mockUseProjectBoms.mockReturnValue({ data: [makeBom()], isLoading: false, isError: false });
    render(<BomTab projectId="proj-1" />);
    expect(screen.getByText('tab.activeTitle')).toBeInTheDocument();
    expect(screen.getByText('tab.historicalTitle')).toBeInTheDocument();
    expect(screen.getByText('tab.createNew')).toBeInTheDocument();
  });

  it('filters by bomNumber', () => {
    mockUseProjectBoms.mockReturnValue({
      data: [
        makeBom({ id: 'bom-1', bomNumber: 'BOM-001' }),
        makeBom({ id: 'bom-2', bomNumber: 'BOM-999' }),
      ],
      isLoading: false,
      isError: false,
    });
    render(<BomTab projectId="proj-1" />);

    fireEvent.change(screen.getByTestId('bom-search'), { target: { value: '999' } });

    expect(screen.queryByText('BOM-001')).not.toBeInTheDocument();
    expect(screen.getByText('BOM-999')).toBeInTheDocument();
  });

  it('filters by createdBy name', () => {
    mockUseProjectBoms.mockReturnValue({
      data: [
        makeBom({ id: 'bom-1', bomNumber: 'BOM-001', createdBy: { id: 'u1', name: 'Alice' } }),
        makeBom({ id: 'bom-2', bomNumber: 'BOM-002', createdBy: { id: 'u2', name: 'Bob' } }),
      ],
      isLoading: false,
      isError: false,
    });
    render(<BomTab projectId="proj-1" />);

    fireEvent.change(screen.getByTestId('bom-search'), { target: { value: 'bob' } });

    expect(screen.queryByText('BOM-001')).not.toBeInTheDocument();
    expect(screen.getByText('BOM-002')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('navigates to the BOM create route with the project id resolved', () => {
    mockUseProjectBoms.mockReturnValue({ data: [makeBom()], isLoading: false, isError: false });
    render(<BomTab projectId="proj-42" />);

    fireEvent.click(screen.getByText('tab.createNew'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects/proj-42/boms/new');
  });

  it('opens the view modal when the eye button is clicked and closes it again', () => {
    mockUseProjectBoms.mockReturnValue({
      data: [makeBom({ id: 'bom-1' })],
      isLoading: false,
      isError: false,
    });
    render(<BomTab projectId="proj-1" />);

    expect(screen.queryByTestId('bom-items-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('tab.viewBom'));

    const modal = screen.getByTestId('bom-items-modal');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveTextContent('bom-1');

    fireEvent.click(screen.getByText('x'));
    expect(screen.queryByTestId('bom-items-modal')).not.toBeInTheDocument();
  });

  it('renders pagination and forwards page/size changes for non-empty tables', () => {
    mockUseProjectBoms.mockReturnValue({ data: [makeBom()], isLoading: false, isError: false });
    render(<BomTab projectId="proj-1" />);

    // Active table renders a pagination control.
    const next = screen.getByText('tab.next');
    fireEvent.click(next);
    const rowsPerPage = screen.getByText('tab.rowsPerPage');
    fireEvent.click(rowsPerPage);
    expect(screen.getByTestId('pagination')).toBeInTheDocument();
  });

  it('treats whitespace-only search as no filter', () => {
    mockUseProjectBoms.mockReturnValue({
      data: [makeBom({ id: 'bom-1', bomNumber: 'BOM-001' })],
      isLoading: false,
      isError: false,
    });
    render(<BomTab projectId="proj-1" />);

    fireEvent.change(screen.getByTestId('bom-search'), { target: { value: '   ' } });
    expect(screen.getByText('BOM-001')).toBeInTheDocument();
  });
});
