import { render, screen, fireEvent } from '@testing-library/react';

const mockQueryResult = vi.hoisted(() => ({
  value: {
    data: null as Record<string, unknown> | null,
    isLoading: false,
    isError: false,
  },
}));

const mockNavigate = vi.fn();

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'mat-1' }),
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/api-client', () => ({
  getMaterials: vi.fn(),
}));

vi.mock('@forethread/ui-components', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
    className?: string;
  }) => <button onClick={onClick}>{children}</button>,
  Spinner: () => <div data-testid="spinner" />,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mockQueryResult.value,
}));

import MaterialDetailPage from './MaterialDetailPage';

describe('MaterialDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryResult.value = { data: null, isLoading: false, isError: false };
  });

  it('shows spinner when loading', () => {
    mockQueryResult.value = { data: null, isLoading: true, isError: false };
    render(<MaterialDetailPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows not found alert on error', () => {
    mockQueryResult.value = { data: null, isLoading: false, isError: true };
    render(<MaterialDetailPage />);
    expect(screen.getByText('materialDetail.notFound')).toBeInTheDocument();
  });

  it('shows not found when data is null', () => {
    mockQueryResult.value = { data: null, isLoading: false, isError: false };
    render(<MaterialDetailPage />);
    expect(screen.getByText('materialDetail.notFound')).toBeInTheDocument();
  });

  it('navigates back when go back button is clicked on error', () => {
    mockQueryResult.value = { data: null, isLoading: false, isError: true };
    render(<MaterialDetailPage />);
    fireEvent.click(screen.getByText('materialDetail.goBack'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('renders material details when data is loaded', () => {
    mockQueryResult.value = {
      data: {
        id: 'mat-1',
        name: 'Steel Beam',
        code: 'SB-100',
        categoryName: 'Metal',
        unitOfMeasure: 'pcs',
        status: 'ACTIVE',
        description: 'High-grade steel beam',
      },
      isLoading: false,
      isError: false,
    };
    render(<MaterialDetailPage />);
    expect(screen.getByText('Steel Beam')).toBeInTheDocument();
    expect(screen.getByText('SB-100')).toBeInTheDocument();
    expect(screen.getByText('Metal')).toBeInTheDocument();
    expect(screen.getByText('pcs')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('High-grade steel beam')).toBeInTheDocument();
  });

  it('renders go back button on detail page', () => {
    mockQueryResult.value = {
      data: {
        id: 'mat-1',
        name: 'Steel Beam',
        unitOfMeasure: 'pcs',
      },
      isLoading: false,
      isError: false,
    };
    render(<MaterialDetailPage />);
    fireEvent.click(screen.getByText('materialDetail.goBack'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('does not render code field when absent', () => {
    mockQueryResult.value = {
      data: {
        id: 'mat-1',
        name: 'Steel Beam',
        unitOfMeasure: 'pcs',
      },
      isLoading: false,
      isError: false,
    };
    render(<MaterialDetailPage />);
    expect(screen.queryByText('materialDetail.code')).not.toBeInTheDocument();
  });

  it('does not render description when absent', () => {
    mockQueryResult.value = {
      data: {
        id: 'mat-1',
        name: 'Steel Beam',
        unitOfMeasure: 'pcs',
      },
      isLoading: false,
      isError: false,
    };
    render(<MaterialDetailPage />);
    expect(screen.queryByText('materialDetail.description')).not.toBeInTheDocument();
  });
});
