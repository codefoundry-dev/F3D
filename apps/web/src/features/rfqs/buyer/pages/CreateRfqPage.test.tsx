import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockUseLocation = vi.hoisted(() => vi.fn((): { state: unknown } => ({ state: null })));
const mockSaveDraft = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
}));
const mockUpdateDraft = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
}));
const mockSendRfq = vi.hoisted(() => ({
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
  useLocation: () => mockUseLocation(),
}));

const mockUseConfirmedBoms = vi.hoisted(() => vi.fn());

vi.mock('../services/rfqs.service', () => ({
  useSaveRfqDraft: () => mockSaveDraft,
  useUpdateRfq: () => mockUpdateDraft,
  useSendRfq: () => mockSendRfq,
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
  Modal: ({ children }: any) => <div role="dialog">{children}</div>,
  ModalHeader: ({ children }: any) => <div>{children}</div>,
  ModalBody: ({ children }: any) => <div>{children}</div>,
  ModalFooter: ({ children }: any) => <div>{children}</div>,
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({
  default: () => <span data-testid="delete-icon" />,
}));

import CreateRfqPage from './CreateRfqPage';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const MATERIAL_ID = '22222222-2222-4222-8222-222222222222';
// VENDOR_ID is the CompanyVendorAssignment row id; VENDOR_COMPANY_ID is the
// vendor's Company id. The wizard must submit the Company id (what the RFQ
// backend validates), so these are deliberately different.
const VENDOR_ID = '33333333-3333-4333-8333-333333333333';
const VENDOR_COMPANY_ID = '55555555-5555-4555-8555-555555555555';
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
    data: [{ id: VENDOR_ID, companyId: VENDOR_COMPANY_ID, companyName: 'Acme Supplies' }],
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

/** Render the wizard and walk every step until the Review step is showing. */
async function walkToReviewStep() {
  render(<CreateRfqPage />);
  selectProject();
  fireEvent.click(screen.getByTestId('next-step'));
  await addMaterial('10');
  fireEvent.click(screen.getByTestId('next-step'));
  await screen.findByTestId('vendor-list');
  fireEvent.click(within(screen.getByTestId('vendor-list')).getByRole('checkbox'));
  fireEvent.click(screen.getByTestId('next-step'));
  await screen.findByText('Response deadline');
  fireEvent.change(screen.getByLabelText(/select a delivery location/i), {
    target: { value: LOCATION_ID },
  });
  fireEvent.change(screen.getAllByLabelText('date')[0], { target: { value: '2030-01-15' } });
  fireEvent.click(screen.getByTestId('next-step'));
  await screen.findByTestId('review-line-items');
}

describe('CreateRfqPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocation.mockReturnValue({ state: null });
    mockSaveDraft.isPending = false;
    mockSaveDraft.isError = false;
    mockUpdateDraft.isPending = false;
    mockUpdateDraft.isError = false;
    mockSendRfq.isPending = false;
    mockSendRfq.isError = false;
    mockSaveDraft.mutateAsync.mockResolvedValue({ id: 'draft-1' });
    mockUpdateDraft.mutateAsync.mockResolvedValue({ id: 'draft-1' });
    mockSendRfq.mutateAsync.mockResolvedValue({ id: 'draft-1' });
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
    expect(
      screen.getByText('Choose the project this request for quote belongs to.'),
    ).toBeInTheDocument();
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

    // Step 3: vendors — selecting a vendor must submit its Company id, not the
    // assignment row id, or the RFQ backend rejects it (assertVendorsAssigned).
    await screen.findByTestId('vendor-list');
    fireEvent.click(within(screen.getByTestId('vendor-list')).getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('next-step'));
    await waitFor(() =>
      expect(mockUpdateDraft.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          dto: expect.objectContaining({ vendorIds: [VENDOR_COMPANY_ID] }),
        }),
      ),
    );

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

  it('sends the RFQ to vendors via the confirm dialog (with CC) then navigates to the detail page', async () => {
    await walkToReviewStep();

    // Send opens a confirmation dialog rather than firing immediately.
    fireEvent.click(screen.getByTestId('send-to-vendors'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/will be emailed a secure link/i)).toBeInTheDocument();
    expect(mockSendRfq.mutateAsync).not.toHaveBeenCalled();

    // CC is parsed (trailing comma/space trimmed) and the saved draft id is sent.
    fireEvent.change(screen.getByTestId('send-rfq-cc'), { target: { value: 'ops@acme.com, ' } });
    fireEvent.click(screen.getByTestId('confirm-send-rfq'));

    await waitFor(() =>
      expect(mockSendRfq.mutateAsync).toHaveBeenCalledWith({
        id: 'draft-1',
        cc: ['ops@acme.com'],
      }),
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/rfqs/draft-1'));
  });

  it('surfaces an in-dialog error when sending the RFQ fails', async () => {
    mockSendRfq.mutateAsync.mockRejectedValueOnce(new Error('boom'));
    mockSendRfq.isError = true;
    await walkToReviewStep();

    fireEvent.click(screen.getByTestId('send-to-vendors'));
    fireEvent.click(await screen.findByTestId('confirm-send-rfq'));

    expect(await screen.findByText(/couldn’t send this RFQ/i)).toBeInTheDocument();
    // Dialog stays open; no navigation away on failure.
    expect(mockNavigate).not.toHaveBeenCalledWith('/rfqs/draft-1');
  });

  it('shows an error alert when the draft save fails', async () => {
    mockSaveDraft.mutateAsync.mockRejectedValueOnce(new Error('boom'));
    mockSaveDraft.isError = true;
    render(<CreateRfqPage />);
    selectProject();
    fireEvent.click(screen.getByTestId('next-step'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Something went wrong saving your draft/i,
    );
  });

  it('seeds the Materials step from a confirmed BOM passed via route state (FOR-200)', async () => {
    mockUseLocation.mockReturnValue({ state: { bomExtractionId: 'bom-1' } });
    mockUseConfirmedBoms.mockReturnValue({
      data: {
        items: [
          {
            id: 'bom-1',
            type: 'BOM',
            status: 'CONFIRMED',
            file: { filename: 'tower-5-bom.pdf' },
            editedResult: {
              title: 'Tower 5 BOM',
              projectName: null,
              currency: 'AUD',
              items: [
                {
                  description: 'Cement',
                  quantity: 50,
                  unit: 'bag',
                  targetPrice: null,
                  notes: null,
                },
                {
                  description: 'Rebar 12mm',
                  quantity: 200,
                  unit: 'm',
                  targetPrice: null,
                  notes: null,
                },
              ],
              notes: null,
            },
          },
        ],
        meta: {},
      },
    });

    render(<CreateRfqPage />);

    // Advance past Project into Materials — the BOM lines are already present,
    // with no manual catalogue entry.
    selectProject();
    fireEvent.click(screen.getByTestId('next-step'));

    const list = await screen.findByTestId('line-item-list');
    expect(within(list).getByText('Cement')).toBeInTheDocument();
    expect(within(list).getByText('Rebar 12mm')).toBeInTheDocument();
  });

  it('seeds a matched BOM line as a catalogue-linked RFQ line and sends its materialId', async () => {
    mockUseLocation.mockReturnValue({ state: { bomExtractionId: 'bom-1' } });
    mockUseConfirmedBoms.mockReturnValue({
      data: {
        items: [
          {
            id: 'bom-1',
            type: 'BOM',
            status: 'CONFIRMED',
            file: { filename: 'tower-5-bom.pdf' },
            editedResult: {
              title: 'Tower 5 BOM',
              projectName: null,
              currency: 'AUD',
              items: [
                {
                  description: 'Cement 25kg',
                  quantity: 50,
                  unit: 'bag',
                  targetPrice: null,
                  notes: null,
                  matchedMaterialId: MATERIAL_ID,
                  matchedMaterialName: 'Cement Bag 50kg',
                  matchConfidence: 0.9,
                  matchCandidates: [],
                },
              ],
              notes: null,
            },
          },
        ],
        meta: {},
      },
    });

    render(<CreateRfqPage />);

    // The seeded line shows the catalogue name, not the raw BOM text.
    selectProject();
    fireEvent.click(screen.getByTestId('next-step'));
    const list = await screen.findByTestId('line-item-list');
    expect(within(list).getByText('Cement Bag 50kg')).toBeInTheDocument();

    // Advance past Materials → the persisted line carries the catalogue materialId
    // (not a free-text materialName), so it is a catalogue-linked RFQ line.
    await waitFor(() => expect(mockSaveDraft.mutateAsync).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('next-step'));
    await waitFor(() => expect(mockUpdateDraft.mutateAsync).toHaveBeenCalled());

    const update = mockUpdateDraft.mutateAsync.mock.calls[0][0];
    expect(update.dto.lineItems).toEqual([
      {
        source: 'BOM',
        materialId: MATERIAL_ID,
        quantity: 50,
        uom: 'bag',
        costCode: undefined,
        notes: 'Cement 25kg',
        pickUp: undefined,
      },
    ]);
  });
});
