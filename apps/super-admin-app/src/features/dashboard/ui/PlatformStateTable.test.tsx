import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
  Spinner: ({ size }: { size: string }) => <div data-testid={`spinner-${size}`} />,
  SortIcon: ({ active, direction }: { active: boolean; direction: string | null }) => (
    <span data-testid="sort-icon" data-active={active} data-direction={direction} />
  ),
  ToggleSwitch: (props: Record<string, unknown>) => (
    <button
      aria-label={props['aria-label'] as string}
      data-checked={String(props.checked)}
      onClick={props.onChange as () => void}
    >
      toggle
    </button>
  ),
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/circle-reload.svg?react', () => ({
  default: () => <span data-testid="reload-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <span data-testid="eye-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/toggle-switch.svg?react', () => ({
  default: () => <span data-testid="toggle-icon" />,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/app/route-config', () => ({
  ROUTES: { adminPanel: '/admin-panel' },
}));

const mockPlatformState = {
  sortedComponents: [] as ReturnType<typeof createComponent>[],
  sort: { column: null as string | null, direction: null as string | null },
  handleSort: vi.fn(),
  toggleIntegration: vi.fn(),
  reloadComponent: vi.fn(),
  canToggle: vi.fn().mockReturnValue(false),
  canReload: vi.fn().mockReturnValue(false),
  isReloading: vi.fn().mockReturnValue(false),
  isDisabled: vi.fn().mockReturnValue(false),
  isLoading: false,
};

vi.mock('../hooks/usePlatformState', () => ({
  usePlatformState: () => mockPlatformState,
}));

function createComponent(
  overrides: Partial<{
    id: string;
    name: string;
    status: string;
    category: string;
    lastSuccessfulRun: string | null;
    lastError: string | null;
    errorInfo: string | null;
  }> = {},
) {
  return {
    id: 'c1',
    name: 'Email Service',
    status: 'Healthy',
    category: 'integration',
    lastSuccessfulRun: '2026-03-10T10:00:00Z',
    lastError: null,
    errorInfo: null,
    ...overrides,
  };
}

import { PlatformStateTable } from './PlatformStateTable';

describe('PlatformStateTable', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatformState.sortedComponents = [];
    mockPlatformState.isLoading = false;
    mockPlatformState.sort = { column: null, direction: null };
    mockPlatformState.canToggle.mockReturnValue(false);
    mockPlatformState.canReload.mockReturnValue(false);
    mockPlatformState.isReloading.mockReturnValue(false);
    mockPlatformState.isDisabled.mockReturnValue(false);
  });

  it('returns null when not loading and no components', () => {
    const { container } = render(<PlatformStateTable />);
    expect(container.innerHTML).toBe('');
  });

  it('shows spinner when loading', () => {
    mockPlatformState.isLoading = true;
    render(<PlatformStateTable />);

    expect(screen.getByTestId('spinner-lg')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    mockPlatformState.sortedComponents = [createComponent()];
    render(<PlatformStateTable />);

    expect(screen.getByText('platformState.component')).toBeInTheDocument();
    expect(screen.getByText('platformState.status')).toBeInTheDocument();
    expect(screen.getByText('platformState.lastSuccessfulRun')).toBeInTheDocument();
    expect(screen.getByText('platformState.lastError')).toBeInTheDocument();
    expect(screen.getByText('platformState.errorInfo')).toBeInTheDocument();
    expect(screen.getByText('platformState.actions')).toBeInTheDocument();
  });

  it('renders component rows with name and status badge', () => {
    mockPlatformState.sortedComponents = [
      createComponent({ id: 'c1', name: 'Email Service', status: 'Healthy' }),
      createComponent({ id: 'c2', name: 'Report Gen', status: 'Error' }),
    ];
    render(<PlatformStateTable />);

    expect(screen.getByText('Email Service')).toBeInTheDocument();
    expect(screen.getByText('Report Gen')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('renders error info or fallback text', () => {
    mockPlatformState.sortedComponents = [createComponent({ errorInfo: 'Connection timeout' })];
    render(<PlatformStateTable />);

    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
  });

  it('shows no errors fallback for null errorInfo', () => {
    mockPlatformState.sortedComponents = [createComponent({ errorInfo: null })];
    render(<PlatformStateTable />);

    // The errorInfo cell and lastError cell both use "platformState.noErrors"
    const noErrorTexts = screen.getAllByText('platformState.noErrors');
    expect(noErrorTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('shows toggle button for integration components', () => {
    mockPlatformState.sortedComponents = [createComponent({ category: 'integration' })];
    mockPlatformState.canToggle.mockReturnValue(true);

    render(<PlatformStateTable />);

    const toggleBtn = screen.getByLabelText('Disable');
    expect(toggleBtn).toBeInTheDocument();
  });

  it('shows Enable label when component is disabled', () => {
    mockPlatformState.sortedComponents = [
      createComponent({ status: 'Disabled', category: 'integration' }),
    ];
    mockPlatformState.canToggle.mockReturnValue(true);
    mockPlatformState.isDisabled.mockReturnValue(true);

    render(<PlatformStateTable />);

    expect(screen.getByLabelText('Enable')).toBeInTheDocument();
  });

  it('calls toggleIntegration when toggle button is clicked', () => {
    const comp = createComponent({ category: 'integration' });
    mockPlatformState.sortedComponents = [comp];
    mockPlatformState.canToggle.mockReturnValue(true);

    render(<PlatformStateTable />);

    fireEvent.click(screen.getByLabelText('Disable'));
    expect(mockPlatformState.toggleIntegration).toHaveBeenCalledWith(comp);
  });

  it('shows reload button for error/warning components', () => {
    mockPlatformState.sortedComponents = [createComponent({ status: 'Error' })];
    mockPlatformState.canReload.mockReturnValue(true);

    render(<PlatformStateTable />);

    expect(screen.getByLabelText('Reload')).toBeInTheDocument();
  });

  it('calls reloadComponent when reload button is clicked', () => {
    const comp = createComponent({ status: 'Error' });
    mockPlatformState.sortedComponents = [comp];
    mockPlatformState.canReload.mockReturnValue(true);

    render(<PlatformStateTable />);

    fireEvent.click(screen.getByLabelText('Reload'));
    expect(mockPlatformState.reloadComponent).toHaveBeenCalledWith(comp);
  });

  it('disables reload button when component is reloading', () => {
    mockPlatformState.sortedComponents = [createComponent({ status: 'Error' })];
    mockPlatformState.canReload.mockReturnValue(true);
    mockPlatformState.isReloading.mockReturnValue(true);

    render(<PlatformStateTable />);

    expect(screen.getByLabelText('Reload')).toBeDisabled();
  });

  it('calls handleSort when a sortable header is clicked', () => {
    mockPlatformState.sortedComponents = [createComponent()];

    render(<PlatformStateTable />);

    fireEvent.click(screen.getByText('platformState.component'));
    expect(mockPlatformState.handleSort).toHaveBeenCalledWith('component');
  });

  it('navigates to admin panel when view button is clicked', () => {
    mockPlatformState.sortedComponents = [createComponent()];

    render(<PlatformStateTable />);

    fireEvent.click(screen.getByLabelText('View'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin-panel');
  });

  it('renders title and subtitle', () => {
    mockPlatformState.sortedComponents = [createComponent()];
    render(<PlatformStateTable />);

    expect(screen.getByText('platformState.title')).toBeInTheDocument();
    expect(screen.getByText('platformState.subtitle')).toBeInTheDocument();
  });
});
