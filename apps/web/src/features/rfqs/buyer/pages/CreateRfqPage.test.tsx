import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockSaveDraft = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false, isError: false }));
const mockUpdateDraft = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
}));

const mockUseRfqProjects = vi.hoisted(() => vi.fn());
const mockUseRfqMaterials = vi.hoisted(() => vi.fn());
const mockUseAssignedVendors = vi.hoisted(() => vi.fn());
const mockUseProjectDeliveryLocations = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockUseConfirmedBoms = vi.hoisted(() => vi.fn());

vi.mock('../services/rfqs.service', () => ({
  useSaveRfqDraft: () => mockSaveDraft,
  useUpdateRfq: () => mockUpdateDraft,
  useRfqProjects: mockUseRfqProjects,
  useRfqMaterials: mockUseRfqMaterials,
  useAssignedVendors: mockUseAssignedVendors,
  useProjectDeliveryLocations: mockUseProjectDeliveryLocations,
}));

vi.mock('@/features/doc-intelligence', () => ({
  useConfirmedBoms: mockUseConfirmedBoms,
}));

// Simple deterministic stand-ins for design-system components. The page's real
// Zod step schemas still run, so validation gating is genuinely exercised.
vi.mock('@forethread/ui-components', () => ({
  Input: (props: any) => <input {...props} />,
  Textarea: (props: any) => <textarea {...props} />,
  Checkbox: (props: any) => (
    <label>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(e: any) => props.onChange?.(e.target.checked)}
      />
      {props.label}
    </label>
  ),
  CustomDropdown: (props: any) => (
    <select
      aria-label={props.placeholder}
      value={props.value ?? ''}
      onChange={(e: any) => props.onChange?.(e.target.value)}
    >
      <option value="">{props.placeholder}</option>
      {props.options.map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
  DatePicker: (props: any) => (
    <input
      type="date"
      aria-label="date"
      value={props.value ?? ''}
      onChange={(e: any) => props.onChange?.(e.target.value)}
    />
  ),
  RadioGroup: (props: any) => (
    <div role="radiogroup">
      {props.options.map((o: any) => (
        <label key={o.value}>
          <input
            type="radio"
            name={props.name}
            checked={props.value === o.value}
            onChange={() => props.onChange?.(o.value)}
          />
          {o.label}
        </label>
      ))}
    </div>
  ),
  Badge: (props: any) => <span>{props.children}</span>,
  FormField: ({ children, label, error }: any) => (
    <div>
      <label>{label}</label>
      {children}
      {error && <span>{error}</span>}
    </div>
  ),
  Button: (props: any) => (
    <button
      type={props.type ?? 'button'}
      disabled={props.disabled ?? props.isLoading}
      onClick={props.onClick}
      data-testid={props['data-testid']}
    >
      {props.children}
    </button>
  ),
  Alert: ({ children }: any) => <div role="alert">{children}</div>,
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({
  default: () => <span data-testid="delete-icon" />,
}));

import CreateRfqPage from './CreateRfqPage';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const MATERIAL_ID = '22222222-2222-4222-8222-222222222222';
const VENDOR_ID = '33333333-3333-4333-8333-333333333333';
const LOCATION_ID = '44444444-4444-4444-8444-444444444444';

function setupData() {
  mockUseRfqProjects.mockReturnValue({
    data: [{ id: PROJECT_ID, name: 'Tower 5' }],
    isLoading: false,
  });
  mockUseRfqMaterials.mockReturnValue({
    data: [{ id: MATERIAL_ID, name: 'Cement', unitOfMeasure: 'bag' }],
  });
  mockUseAssignedVendors.mockReturnValue({
    data: [{ id: VENDOR_ID, companyName: 'Acme Supplies' }],
    isLoading: false,
  });
  mockUseProjectDeliveryLocations.mockReturnValue({
    data: [
      { id: LOCATION_ID, type: 'DELIVERY', address: '1 Build St', label: 'Site', isDefault: true },
    ],
    isLoading: false,
  });
  mockUseConfirmedBoms.mockReturnValue({ data: { items: [], meta: {} } });
}

function selectProject() {
  fireEvent.change(screen.getByLabelText(/select a project/i), { target: { value: PROJECT_ID } });
}

async function addMaterial(qty = '50') {
  await screen.findByTestId('add-line-item');
  fireEvent.change(screen.getByLabelText(/select a material/i), { target: { value: MATERIAL_ID } });
  fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: qty } });
  fireEvent.click(screen.getByTestId('add-line-item'));
}

describe('CreateRfqPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveDraft.isPending = false;
    mockSaveDraft.isError = false;
    mockUpdateDraft.isPending = false;
    mockUpdateDraft.isError = false;
    mockSaveDraft.mutateAsync.mockResolvedValue({ id: 'draft-1' });
    mockUpdateDraft.mutateAsync.mockResolvedValue({ id: 'draft-1' });
    setupData();
  });

  it('renders the five-step indicator', () => {
    render(<CreateRfqPage />);
    expect(screen.getByText('Create RFQ')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: /rfq creation steps/i });
    expect(within(nav).getByText('Project')).toBeInTheDocument();
    expect(within(nav).getByText('Materials')).toBeInTheDocument();
    expect(within(nav).getByText('Vendors')).toBeInTheDocument();
    expect(within(nav).getByText('Delivery & specs')).toBeInTheDocument();
    expect(within(nav).getByText('Review')).toBeInTheDocument();
  });

  it('blocks advancing from Project when none is selected', () => {
    render(<CreateRfqPage />);
    // Before: only the dropdown placeholder option reads "Select a project".
    expect(screen.getAllByText('Select a project')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('next-step'));
    // After: the validation error adds a second occurrence.
    expect(screen.getAllByText('Select a project')).toHaveLength(2);
    expect(mockSaveDraft.mutateAsync).not.toHaveBeenCalled();
  });

  it('saves a draft via saveRfqDraft on the first Next and advances', async () => {
    render(<CreateRfqPage />);
    selectProject();
    fireEvent.click(screen.getByTestId('next-step'));

    await waitFor(() => expect(mockSaveDraft.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mockSaveDraft.mutateAsync).toHaveBeenCalledWith({ projectId: PROJECT_ID });
    expect(mockUpdateDraft.mutateAsync).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/Add at least one material to request quotes for/i),
    ).toBeInTheDocument();
  });

  it('blocks advancing from Materials with no line items', async () => {
    render(<CreateRfqPage />);
    selectProject();
    fireEvent.click(screen.getByTestId('next-step'));
    await screen.findByTestId('add-line-item');

    fireEvent.click(screen.getByTestId('next-step'));
    expect(await screen.findByText('Add at least one material')).toBeInTheDocument();
    expect(mockUpdateDraft.mutateAsync).not.toHaveBeenCalled();
  });

  it('persists subsequent steps via updateRfq with the stored draft id (no projectId in patch)', async () => {
    render(<CreateRfqPage />);

    selectProject();
    fireEvent.click(screen.getByTestId('next-step'));
    await waitFor(() => expect(mockSaveDraft.mutateAsync).toHaveBeenCalledTimes(1));

    await addMaterial('50');
    expect(screen.getByTestId('line-item-list')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('next-step'));
    await waitFor(() => expect(mockUpdateDraft.mutateAsync).toHaveBeenCalledTimes(1));

    const firstUpdate = mockUpdateDraft.mutateAsync.mock.calls[0][0];
    expect(firstUpdate.id).toBe('draft-1');
    expect(firstUpdate.dto.lineItems).toEqual([
      {
        source: 'CATALOG',
        materialId: MATERIAL_ID,
        quantity: 50,
        uom: 'bag',
        costCode: undefined,
        notes: undefined,
        pickUp: undefined,
      },
    ]);
    expect(firstUpdate.dto).not.toHaveProperty('projectId');
  });

  it('lets the user navigate back to a prior step via the step indicator', async () => {
    render(<CreateRfqPage />);
    selectProject();
    fireEvent.click(screen.getByTestId('next-step'));
    await screen.findByTestId('add-line-item');

    const nav = screen.getByRole('navigation', { name: /rfq creation steps/i });
    fireEvent.click(within(nav).getByText('Project'));

    // Back on the Project step
    expect(screen.getByText('Choose the project this request for quote belongs to.')).toBeInTheDocument();
  });

  it('walks all steps and saves the draft, then navigates to the RFQ detail', async () => {
    render(<CreateRfqPage />);

    // Step 1
    selectProject();
    fireEvent.click(screen.getByTestId('next-step'));
    await waitFor(() => expect(mockSaveDraft.mutateAsync).toHaveBeenCalled());

    // Step 2
    await addMaterial('10');
    fireEvent.click(screen.getByTestId('next-step'));

    // Step 3: vendors
    await screen.findByTestId('vendor-list');
    fireEvent.click(within(screen.getByTestId('vendor-list')).getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('next-step'));

    // Step 4: delivery
    await screen.findByText('Response deadline');
    fireEvent.change(screen.getByLabelText(/select a delivery location/i), {
      target: { value: LOCATION_ID },
    });
    const dateInputs = screen.getAllByLabelText('date');
    fireEvent.change(dateInputs[0], { target: { value: '2030-01-15' } });
    fireEvent.click(screen.getByTestId('next-step'));

    // Step 5: review
    expect(await screen.findByTestId('review-line-items')).toBeInTheDocument();
    expect(screen.getByTestId('review-vendors')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('save-as-draft'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/rfqs/draft-1'));
  });

  it('shows an error alert when the draft save fails', async () => {
    mockSaveDraft.mutateAsync.mockRejectedValueOnce(new Error('boom'));
    mockSaveDraft.isError = true;
    render(<CreateRfqPage />);
    selectProject();
    fireEvent.click(screen.getByTestId('next-step'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Something went wrong saving your draft/i);
  });
});
