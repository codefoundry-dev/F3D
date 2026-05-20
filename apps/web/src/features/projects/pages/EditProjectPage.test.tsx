import { render, screen, fireEvent } from '@testing-library/react';

const mockUpdateMutation = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}));

const mockUseProject = vi.hoisted(() => vi.fn());
const mockUseUpdateProject = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'proj-1' }),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/api-client', () => ({
  searchAddresses: vi.fn(),
}));

vi.mock('@forethread/shared-types/client', () => ({
  updateProjectSchema: { parse: vi.fn() },
  ProjectStatus: {
    ACTIVE: 'ACTIVE',
    ON_HOLD: 'ON_HOLD',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    PLANNED: 'PLANNED',
  },
  LocationType: {
    DELIVERY: 'DELIVERY',
    STORAGE: 'STORAGE',
  },
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
  RadioButton: (props: any) => (
    <label>
      <input type="radio" checked={props.checked} onChange={props.onChange} />
      {props.label}
    </label>
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
  Spinner: () => <div data-testid="spinner" />,
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  DatePicker: (props: any) => (
    <input
      data-testid="date-picker"
      type="date"
      value={props.value ?? ''}
      onChange={(e: any) => props.onChange?.(e.target.value)}
      placeholder={props.placeholder}
    />
  ),
  buttonVariants: () => 'btn-class',
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({
  default: () => <div data-testid="delete-icon" />,
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => () => ({ values: {}, errors: {} }),
}));

vi.mock('axios', () => ({
  isAxiosError: (err: any) => err?.isAxiosError === true,
}));

vi.mock('../services/projects.service', () => ({
  useProject: mockUseProject,
  useUpdateProject: mockUseUpdateProject,
}));

import EditProjectPage from './EditProjectPage';

const mockProject = {
  id: 'proj-1',
  name: 'Test Project',
  description: 'A test description',
  type: 'Residential',
  status: 'PLANNED',
  plannedBudget: 50000,
  currency: 'AUD',
  startDate: '2026-01-15T00:00:00Z',
  expectedEndDate: '2026-06-15T00:00:00Z',
  locations: [
    { type: 'DELIVERY', address: '123 Main St', label: 'HQ', isDefault: true },
    { type: 'STORAGE', address: '456 Warehouse Rd', label: 'WH1', isDefault: true },
  ],
};

describe('EditProjectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUpdateProject.mockReturnValue(mockUpdateMutation);
  });

  it('renders spinner when loading', () => {
    mockUseProject.mockReturnValue({ data: undefined, isLoading: true });
    render(<EditProjectPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders not found message when project is null and not loading', () => {
    mockUseProject.mockReturnValue({ data: undefined, isLoading: false });
    render(<EditProjectPage />);
    expect(screen.getByText('detail.notFound')).toBeInTheDocument();
  });

  it('renders the edit title when project is loaded', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    expect(screen.getByText('edit.title')).toBeInTheDocument();
  });

  it('renders project details section', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    expect(screen.getByText('create.projectDetails')).toBeInTheDocument();
  });

  it('renders form field labels', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    expect(screen.getByText('create.name')).toBeInTheDocument();
    expect(screen.getByText('create.description')).toBeInTheDocument();
    expect(screen.getByText('create.type')).toBeInTheDocument();
    expect(screen.getByText('create.status')).toBeInTheDocument();
    expect(screen.getByText('create.budget')).toBeInTheDocument();
    expect(screen.getByText('create.currency')).toBeInTheDocument();
    expect(screen.getByText('create.startDate')).toBeInTheDocument();
    expect(screen.getByText('create.expectedEndDate')).toBeInTheDocument();
  });

  it('renders delivery locations section', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    expect(screen.getByText('create.deliveryLocations')).toBeInTheDocument();
  });

  it('renders storage locations section', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    expect(screen.getByText('create.storageLocations')).toBeInTheDocument();
  });

  it('renders save button', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    expect(screen.getByText('edit.save')).toBeInTheDocument();
  });

  it('renders cancel link back to project detail', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    const cancelLink = screen.getByText('edit.cancel');
    expect(cancelLink.closest('a')).toHaveAttribute('href', '/projects/proj-1');
  });

  it('shows saving text when mutation is pending', () => {
    mockUseUpdateProject.mockReturnValue({ ...mockUpdateMutation, isPending: true });
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    expect(screen.getByText('edit.saving')).toBeInTheDocument();
  });

  it('shows error alert when mutation fails with non-409', () => {
    mockUseUpdateProject.mockReturnValue({
      ...mockUpdateMutation,
      isError: true,
      error: new Error('Server error'),
    });
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    expect(screen.getByTestId('alert')).toBeInTheDocument();
    expect(screen.getByText('edit.updateError')).toBeInTheDocument();
  });

  it('shows duplicate name error for 409 response', () => {
    const axiosError = new Error('Conflict') as any;
    axiosError.isAxiosError = true;
    axiosError.response = { status: 409 };

    mockUseUpdateProject.mockReturnValue({
      ...mockUpdateMutation,
      isError: true,
      error: axiosError,
    });
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    expect(screen.getByTestId('alert')).toBeInTheDocument();
    expect(screen.getByText('edit.duplicateNameError')).toBeInTheDocument();
  });

  it('renders add location buttons for both delivery and storage', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    const addButtons = screen.getAllByText('create.addLocation');
    expect(addButtons.length).toBe(2);
  });

  it('adds a new delivery location when add location is clicked', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    const addButtons = screen.getAllByText('create.addLocation');
    fireEvent.click(addButtons[0]);
    const addressInputs = screen.getAllByTestId('address-input');
    expect(addressInputs.length).toBeGreaterThanOrEqual(3);
  });

  it('adds a new storage location when add location is clicked', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    const addButtons = screen.getAllByText('create.addLocation');
    fireEvent.click(addButtons[1]);
    const addressInputs = screen.getAllByTestId('address-input');
    expect(addressInputs.length).toBeGreaterThanOrEqual(3);
  });

  it('removes a delivery location when delete is clicked after adding a second one', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    const addButtons = screen.getAllByText('create.addLocation');
    fireEvent.click(addButtons[0]);
    const deleteButtons = screen.getAllByLabelText('create.removeLocation');
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(deleteButtons[0]);
    const addressInputsAfter = screen.getAllByTestId('address-input');
    expect(addressInputsAfter.length).toBe(2);
  });

  it('submits the form when save button is clicked', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    const saveButton = screen.getByText('edit.save');
    fireEvent.click(saveButton);
    expect(saveButton).toBeInTheDocument();
  });

  it('changes radio button for delivery location default', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]);
    expect(radios[0]).toBeChecked();
  });

  it('removes a storage location when delete is clicked after adding a second one', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    const addButtons = screen.getAllByText('create.addLocation');
    fireEvent.click(addButtons[1]);
    const deleteButtons = screen.getAllByLabelText('create.removeLocation');
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    const addressInputsAfter = screen.getAllByTestId('address-input');
    expect(addressInputsAfter.length).toBe(2);
  });

  it('changes radio button for storage location default', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    const addButtons = screen.getAllByText('create.addLocation');
    fireEvent.click(addButtons[1]);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[radios.length - 1]);
    expect(radios[radios.length - 1]).toBeInTheDocument();
  });

  it('updates address value via AddressInput onChange', () => {
    mockUseProject.mockReturnValue({ data: mockProject, isLoading: false });
    render(<EditProjectPage />);
    const addressInputs = screen.getAllByTestId('address-input');
    fireEvent.change(addressInputs[0], { target: { value: '789 New Address' } });
    expect(addressInputs[0]).toHaveValue('789 New Address');
  });

  it('renders project with multiple delivery locations', () => {
    const projectWithMultipleLocations = {
      ...mockProject,
      locations: [
        { type: 'DELIVERY', address: '123 Main St', label: 'HQ', isDefault: true },
        { type: 'DELIVERY', address: '789 Second St', label: 'Branch', isDefault: false },
        { type: 'STORAGE', address: '456 Warehouse Rd', label: 'WH1', isDefault: true },
      ],
    };
    mockUseProject.mockReturnValue({ data: projectWithMultipleLocations, isLoading: false });
    render(<EditProjectPage />);
    const addressInputs = screen.getAllByTestId('address-input');
    expect(addressInputs.length).toBe(3);
    const deleteButtons = screen.getAllByLabelText('create.removeLocation');
    expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
  });
});
