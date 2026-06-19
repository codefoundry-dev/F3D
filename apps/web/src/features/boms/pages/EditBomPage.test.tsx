import { render, screen, fireEvent } from '@testing-library/react';

const mockUseBom = vi.hoisted(() => vi.fn());
const mockUseUpdateBom = vi.hoisted(() => vi.fn());
const mockMutate = vi.hoisted(() => vi.fn());
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
  notificationService: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@forethread/ui-components/assets/icons/info.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: 'proj-1', bomId: 'bom-1' }),
}));
vi.mock('@/app/route-config', () => ({
  ROUTES: { projectBomDetail: '/projects/:id/bom/:bomId' },
}));
vi.mock('../components/create/BomReviewStep', () => ({
  BomReviewStep: ({ rows, variant }: { rows: unknown[]; variant: string }) => (
    <div data-testid="review-step" data-variant={variant}>
      {rows.length} rows
    </div>
  ),
}));
vi.mock('../hooks/useBoms', () => ({ useBom: mockUseBom, useUpdateBom: mockUseUpdateBom }));

import EditBomPage from './EditBomPage';

const matchedItem = {
  id: 'i1',
  materialName: 'Cement',
  matchedMaterialId: 'm1',
  matchedMaterialName: 'Cement Type I',
  description: 'desc',
  uom: 'kg',
  quantity: 5,
  category: 'Concrete',
  materialType: 'Cement',
  matchConfidence: 0.9,
  sortOrder: 0,
};
const bom = { id: 'bom-1', bomNumber: 'BOM-2024-234', items: [matchedItem] };

describe('EditBomPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUpdateBom.mockReturnValue({ mutate: mockMutate, isPending: false });
  });

  it('renders a spinner while loading', () => {
    mockUseBom.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<EditBomPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders a not-found message on error', () => {
    mockUseBom.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<EditBomPage />);
    expect(screen.getByText('edit.notFound')).toBeInTheDocument();
  });

  it('seeds the review table (edit variant) from the BOM items and shows the banner', () => {
    mockUseBom.mockReturnValue({ data: bom, isLoading: false, isError: false });
    render(<EditBomPage />);
    expect(mockSetTitle).toHaveBeenCalledWith(
      'edit.title',
      'edit.subtitle',
      '/projects/proj-1/bom/bom-1',
    );
    expect(screen.getByText('edit.banner')).toBeInTheDocument();
    const step = screen.getByTestId('review-step');
    expect(step).toHaveAttribute('data-variant', 'edit');
    expect(step).toHaveTextContent('1 rows');
  });

  it('saves the edited items and navigates back to the detail page', () => {
    mockUseBom.mockReturnValue({ data: bom, isLoading: false, isError: false });
    mockMutate.mockImplementation((_input: unknown, opts: { onSuccess?: () => void }) =>
      opts?.onSuccess?.(),
    );
    render(<EditBomPage />);

    fireEvent.click(screen.getByText('edit.save'));

    expect(mockMutate).toHaveBeenCalled();
    const [payload] = mockMutate.mock.calls[0];
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].matchedMaterialId).toBe('m1');
    expect(mockNavigate).toHaveBeenCalledWith('/projects/proj-1/bom/bom-1');
  });
});
