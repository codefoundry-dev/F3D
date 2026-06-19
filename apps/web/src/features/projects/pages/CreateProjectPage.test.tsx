import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockCreateMutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}));

const mockUseCompanyUsers = vi.hoisted(() => vi.fn());
const mockUseCreateProject = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockSetPageTitle = vi.hoisted(() => vi.fn());
const mockAuthUser = vi.hoisted(() => ({ value: { id: 'u1', name: 'Sarah Chen', role: 'COMPANY_ADMIN' } as any }));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: (s: any) => any) => selector({ setTitle: mockSetPageTitle }),
}));

vi.mock('@forethread/po-shared', () => ({
  Stepper: ({ step }: any) => <div data-testid="stepper">step-{step}</div>,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/api-client', () => ({
  searchAddresses: vi.fn(),
}));

vi.mock('@forethread/shared-types/client', () => ({
  createProjectSchema: { parse: vi.fn() },
  ProjectStatus: {
    PLANNED: 'PLANNED',
    ONGOING: 'ONGOING',
    COMPLETED: 'COMPLETED',
    ARCHIVED: 'ARCHIVED',
  },
  LocationType: { DELIVERY: 'DELIVERY', STORAGE: 'STORAGE' },
  UserRole: { COMPANY_ADMIN: 'COMPANY_ADMIN', PROCUREMENT_OFFICER: 'PROCUREMENT_OFFICER' },
}));

vi.mock('@forethread/ui-components', () => ({
  Input: (props: any) => <input data-testid="input" {...props} />,
  AddressInput: (props: any) => (
    <input
      data-testid="address-input"
      value={props.value}
      onChange={(e: any) => props.onChange?.(e.target.value)}
    />
  ),
  Textarea: (props: any) => <textarea data-testid="textarea" {...props} />,
  CustomDropdown: (props: any) => (
    <select
      data-testid="dropdown"
      value={props.value}
      onChange={(e: any) => props.onChange?.(e.target.value)}
    />
  ),
  FormField: ({ children, label, error }: any) => (
    <div data-testid="form-field">
      <label>{label}</label>
      {children}
      {error && <span>{error}</span>}
    </div>
  ),
  Button: (props: any) => (
    <button type={props.type} disabled={props.disabled} onClick={props.onClick}>
      {props.children}
    </button>
  ),
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  AvatarWithStatus: ({ name }: any) => <span data-testid="avatar" title={name} />,
  DatePicker: (props: any) => (
    <input
      data-testid="date-picker"
      type="date"
      value={props.value ?? ''}
      onChange={(e: any) => props.onChange?.(e.target.value)}
    />
  ),
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({
  default: () => <div data-testid="delete-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/flag.svg?react', () => ({
  default: () => <div data-testid="flag-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/info.svg?react', () => ({
  default: () => <div data-testid="info-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/paperclip.svg?react', () => ({
  default: () => <div data-testid="paperclip-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/plus.svg?react', () => ({
  default: () => <div data-testid="plus-icon" />,
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => () => ({ values: {}, errors: {} }),
}));

vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: (s: any) => any) => selector({ currentUser: mockAuthUser.value }),
}));

vi.mock('../services/projects.service', () => ({
  useCreateProject: mockUseCreateProject,
  useCompanyUsers: mockUseCompanyUsers,
}));

import CreateProjectPage from './CreateProjectPage';

describe('CreateProjectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthUser.value = { id: 'u1', name: 'Sarah Chen', role: 'COMPANY_ADMIN' };
    mockUseCreateProject.mockReturnValue(mockCreateMutation);
    mockUseCompanyUsers.mockReturnValue({ data: [] });
  });

  it('sets the wizard title and back route on mount', () => {
    render(<CreateProjectPage />);
    expect(mockSetPageTitle).toHaveBeenCalledWith('create.title', 'create.subtitle', '/projects');
  });

  it('renders the stepper starting at step 1', () => {
    render(<CreateProjectPage />);
    expect(screen.getByTestId('stepper')).toHaveTextContent('step-1');
  });

  it('renders the step 1 heading and project details section', () => {
    render(<CreateProjectPage />);
    expect(screen.getByText('create.step1Heading')).toBeInTheDocument();
    expect(screen.getAllByText('create.projectDetails').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the mandatory project name and status chips on step 1', () => {
    render(<CreateProjectPage />);
    expect(screen.getByText('create.name *')).toBeInTheDocument();
    expect(screen.getByText('create.statusChips.PLANNED')).toBeInTheDocument();
    expect(screen.getByText('create.statusChips.ONGOING')).toBeInTheDocument();
    expect(screen.getByText('create.statusChips.COMPLETED')).toBeInTheDocument();
  });

  it('renders both location groups with add buttons on step 1', () => {
    render(<CreateProjectPage />);
    expect(screen.getByText('create.addLocation')).toBeInTheDocument();
    expect(screen.getByText('create.addStorageLocation')).toBeInTheDocument();
  });

  it('does NOT show the procurement-officer banner for a company admin', () => {
    render(<CreateProjectPage />);
    expect(screen.queryByText('create.poBanner')).not.toBeInTheDocument();
  });

  it('shows the procurement-officer banner and locks the assigned creator chip', () => {
    mockAuthUser.value = { id: 'u1', name: 'Sarah Chen', role: 'PROCUREMENT_OFFICER' };
    mockUseCompanyUsers.mockReturnValue({
      data: [{ id: 'u1', name: 'Sarah Chen', email: 's@x.com', avatarUrl: null, workStatus: null }],
    });
    render(<CreateProjectPage />);
    expect(screen.getByText('create.poBanner')).toBeInTheDocument();
    // The creator chip is rendered (avatar) but no search box for a PO.
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('create.searchUsers')).not.toBeInTheDocument();
  });

  it('advances to step 2 when Continue is clicked (validation passes)', async () => {
    render(<CreateProjectPage />);
    fireEvent.click(screen.getByText('create.continue'));
    expect(await screen.findByText('create.step2Heading')).toBeInTheDocument();
    expect(screen.getByText('create.plannedBudgetAud')).toBeInTheDocument();
    expect(screen.getByText('create.uploadFile')).toBeInTheDocument();
  });

  it('reaches the review step and shows the Create project button', async () => {
    render(<CreateProjectPage />);
    fireEvent.click(screen.getByText('create.continue'));
    await screen.findByText('create.step2Heading');
    fireEvent.click(screen.getByText('create.continue'));
    expect(await screen.findByText('create.step3Heading')).toBeInTheDocument();
    expect(screen.getByText('create.createProject')).toBeInTheDocument();
  });

  it('calls the create mutation from the review step', async () => {
    render(<CreateProjectPage />);
    fireEvent.click(screen.getByText('create.continue'));
    await screen.findByText('create.step2Heading');
    fireEvent.click(screen.getByText('create.continue'));
    await screen.findByText('create.step3Heading');
    fireEvent.click(screen.getByText('create.createProject'));
    await waitFor(() => expect(mockCreateMutation.mutate).toHaveBeenCalled());
  });

  it('cancels back to the projects list', () => {
    render(<CreateProjectPage />);
    fireEvent.click(screen.getByText('create.cancel'));
    expect(mockNavigate).toHaveBeenCalledWith('/projects');
  });

  it('shows the duplicate-name error on a 409 response', () => {
    const axiosError = new Error('Conflict') as any;
    axiosError.isAxiosError = true;
    axiosError.response = { status: 409 };
    vi.mock('axios', () => ({ isAxiosError: (err: any) => err?.isAxiosError === true }));
    mockUseCreateProject.mockReturnValue({
      ...mockCreateMutation,
      isError: true,
      error: axiosError,
    });
    render(<CreateProjectPage />);
    expect(screen.getByTestId('alert')).toBeInTheDocument();
    expect(screen.getByText('create.duplicateNameError')).toBeInTheDocument();
  });

  it('shows a generic error on a non-409 failure', () => {
    mockUseCreateProject.mockReturnValue({
      ...mockCreateMutation,
      isError: true,
      error: new Error('Server error'),
    });
    render(<CreateProjectPage />);
    expect(screen.getByText('create.createError')).toBeInTheDocument();
  });

  it('selects a user from search and renders the chip (company admin)', () => {
    mockUseCompanyUsers.mockReturnValue({
      data: [
        { id: 'u2', name: 'Bob', email: 'bob@x.com', avatarUrl: null, workStatus: null },
      ],
    });
    render(<CreateProjectPage />);
    const search = screen.getByPlaceholderText('create.searchUsers');
    fireEvent.change(search, { target: { value: 'Bob' } });
    fireEvent.click(screen.getByText('bob@x.com'));
    expect(screen.getAllByText('Bob').length).toBeGreaterThanOrEqual(1);
  });

  it('adds a delivery location row when Add location is clicked', () => {
    render(<CreateProjectPage />);
    const before = screen.getAllByTestId('address-input').length;
    fireEvent.click(screen.getByText('create.addLocation'));
    expect(screen.getAllByTestId('address-input').length).toBe(before + 1);
  });
});
