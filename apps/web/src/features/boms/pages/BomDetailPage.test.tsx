import { render, screen, fireEvent } from '@testing-library/react';

const mockUseBom = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockSetTitle = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (sel: any) => sel({ setTitle: mockSetTitle }),
}));
vi.mock('@forethread/ui-components', () => ({
  Button: (p: any) => (
    <button onClick={p.onClick} disabled={p.disabled}>
      {p.children}
    </button>
  ),
  Spinner: () => <div data-testid="spinner" />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: 'proj-1', bomId: 'bom-1' }),
}));
vi.mock('@/app/route-config', () => ({
  ROUTES: {
    projectDetail: '/projects/:id',
    projectBomEdit: '/projects/:id/bom/:bomId/edit',
  },
}));
vi.mock('../components/BomItemsTable', () => ({
  BomItemsTable: ({ items }: { items: unknown[] }) => (
    <div data-testid="bom-items-table">{items.length} items</div>
  ),
}));
vi.mock('../hooks/useBoms', () => ({ useBom: mockUseBom }));

import BomDetailPage from './BomDetailPage';

const bom = { id: 'bom-1', bomNumber: 'BOM-2024-234', items: [{ id: 'i1' }, { id: 'i2' }] };

describe('BomDetailPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a spinner while loading', () => {
    mockUseBom.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<BomDetailPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders a not-found message on error', () => {
    mockUseBom.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<BomDetailPage />);
    expect(screen.getByText('detail.notFound')).toBeInTheDocument();
  });

  it('sets the header to the BOM number with a back route and renders the items table', () => {
    mockUseBom.mockReturnValue({ data: bom, isLoading: false, isError: false });
    render(<BomDetailPage />);
    expect(mockSetTitle).toHaveBeenCalledWith(
      'BOM-2024-234',
      'detail.subtitle',
      '/projects/proj-1?tab=bom',
    );
    expect(screen.getByTestId('bom-items-table')).toHaveTextContent('2 items');
  });

  it('navigates to the edit page when Edit is clicked', () => {
    mockUseBom.mockReturnValue({ data: bom, isLoading: false, isError: false });
    render(<BomDetailPage />);
    fireEvent.click(screen.getByText('detail.edit'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects/proj-1/bom/bom-1/edit');
  });
});
