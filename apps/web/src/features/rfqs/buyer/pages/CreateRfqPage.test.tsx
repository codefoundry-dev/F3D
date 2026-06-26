import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
const mockUseConfirmedBoms = vi.hoisted(() => vi.fn());

const mockApi = vi.hoisted(() => ({
  getProject: vi.fn(),
  checkRfqAvailability: vi.fn(),
  confirmRfqCoverage: vi.fn(),
  deleteRfq: vi.fn(),
  uploadRfqDocument: vi.fn(),
  getBoms: vi.fn().mockResolvedValue([]),
  getBom: vi.fn(),
  getMaterialLists: vi.fn().mockResolvedValue([]),
  getMaterialList: vi.fn(),
  getProjects: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && 'count' in opts ? `${key}:${String(opts.count)}` : key,
  }),
}));

vi.mock('@forethread/api-client', () => mockApi);

vi.mock('@forethread/po-shared', () => ({
  Stepper: ({ step, labels }: { step: number; labels: string[] }) => (
    <div data-testid="stepper">
      {labels.join('|')} (step {step})
    </div>
  ),
}));

vi.mock('../services/rfqs.service', () => ({
  useSaveRfqDraft: () => mockSaveDraft,
  useUpdateRfq: () => mockUpdateDraft,
  useSendRfq: () => mockSendRfq,
  useRfqProjects: mockUseRfqProjects,
  useRfqMaterials: mockUseRfqMaterials,
  useAssignedVendors: mockUseAssignedVendors,
}));

vi.mock('@/features/doc-intelligence', () => ({
  useConfirmedBoms: mockUseConfirmedBoms,
}));

// Swap only the fiddly inputs for deterministic stand-ins; everything else
// renders the real design-system components.
vi.mock('@forethread/ui-components', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    DatePicker: (props: { value?: string; onChange?: (d: string) => void }) => (
      <input
        type="date"
        aria-label="date"
        value={props.value ?? ''}
        onChange={(e) => props.onChange?.(e.target.value)}
      />
    ),
    SelectDropdown: (props: {
      selected?: string[];
      onSelectedChange?: (s: string[]) => void;
      options: Array<{ value: string; label: string }>;
      placeholder?: string;
    }) => (
      <select
        multiple
        aria-label={props.placeholder}
        value={props.selected ?? []}
        onChange={(e) =>
          props.onSelectedChange?.(Array.from(e.target.selectedOptions).map((o) => o.value))
        }
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    ),
    MaterialSearchPanel: (props: {
      onSelect: (item: { id: string; name: string; unit?: string; description?: string }) => void;
    }) => (
      <button
        type="button"
        data-testid="mock-pick-material"
        onClick={() =>
          props.onSelect({ id: MATERIAL_ID, name: 'Cement', unit: 'bag', description: 'Bagged' })
        }
      >
        pick material
      </button>
    ),
  };
});

import CreateRfqPage from './CreateRfqPage';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const MATERIAL_ID = '22222222-2222-4222-8222-222222222222';
// The assignment row id and the vendor's Company id differ on purpose — the
// wizard must submit the Company id (what the RFQ backend validates).
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
    data: [
      {
        id: VENDOR_ID,
        companyId: VENDOR_COMPANY_ID,
        companyName: 'Acme Supplies',
        categories: ['Steel & Metals'],
        specialisations: ['Chicago, IL'],
      },
    ],
    isLoading: false,
  });
  mockUseConfirmedBoms.mockReturnValue({ data: { items: [] } });
  mockApi.getProject.mockResolvedValue({
    id: PROJECT_ID,
    name: 'Tower 5',
    locations: [{ id: LOCATION_ID, type: 'DELIVERY', address: '1 Site Rd', label: 'Dock A' }],
  });
  mockApi.checkRfqAvailability.mockResolvedValue({ vendors: [], items: [] });
  mockSaveDraft.mutateAsync.mockResolvedValue({
    id: 'rfq-1',
    lineItems: [{ id: 'srv-li-1' }],
  });
  mockUpdateDraft.mutateAsync.mockResolvedValue({
    id: 'rfq-1',
    lineItems: [{ id: 'srv-li-1' }],
  });
  mockSendRfq.mutateAsync.mockResolvedValue({ id: 'rfq-1' });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CreateRfqPage />
    </QueryClientProvider>,
  );
}

/** Select values in one of the stubbed multi-selects. */
function selectMulti(label: string, values: string[]) {
  const select = screen.getByLabelText<HTMLSelectElement>(label);
  for (const option of Array.from(select.options)) {
    option.selected = values.includes(option.value);
  }
  fireEvent.change(select);
}

/** Fill the basic-info fields and select a vendor (no line item yet). */
function fillBasics() {
  fireEvent.change(screen.getByTestId('rfq-reference'), {
    target: { value: 'Structural steel package' },
  });
  // First date input = RFQ response deadline.
  fireEvent.change(screen.getAllByLabelText('date')[0], { target: { value: '2026-07-01' } });
  selectMulti('create.basicInfo.projectPlaceholder', [PROJECT_ID]);
  fireEvent.click(screen.getByTestId(`vendor-toggle-${VENDOR_COMPANY_ID}`));
}

/** Add the stubbed catalogue material to the line-items table. */
function addMaterial() {
  fireEvent.click(screen.getByTestId('mock-pick-material'));
}

/** Complete the whole first step (basics + a line item). */
function fillStepOne() {
  fillBasics();
  addMaterial();
}

function continueWizard() {
  fireEvent.click(screen.getByTestId('wizard-continue'));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLocation.mockReturnValue({ state: null });
  setupData();
});

describe('CreateRfqPage', () => {
  it('renders the two-step stepper and the consolidated step-1 sections', () => {
    renderPage();
    expect(screen.getByTestId('stepper')).toHaveTextContent(
      'create.steps.basicInfo|create.steps.review (step 1)',
    );
    expect(screen.getByText('create.basicInfo.cardTitle')).toBeInTheDocument();
    // Vendors + line-items accordions carry their titles in the header.
    expect(screen.getByText('create.vendors.cardTitle')).toBeInTheDocument();
    expect(screen.getByText('create.lineItems.cardTitle')).toBeInTheDocument();
  });

  it('blocks continuing with an empty form and shows field + vendor errors', async () => {
    renderPage();
    continueWizard();
    expect(await screen.findAllByText('create.errors.required')).not.toHaveLength(0);
    expect(mockSaveDraft.mutateAsync).not.toHaveBeenCalled();
    // Still on the consolidated first step.
    expect(screen.getByText(/create\.headings\.step1Title/)).toBeInTheDocument();
  });

  it('persists the draft (reference, projects, ISO deadline, vendor COMPANY id, items) and advances to review', async () => {
    renderPage();
    fillStepOne();
    continueWizard();

    await waitFor(() => expect(mockSaveDraft.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = mockSaveDraft.mutateAsync.mock.calls[0][0];
    expect(payload).toMatchObject({
      projectId: PROJECT_ID,
      projectIds: [PROJECT_ID],
      name: 'Structural steel package',
      deadlineEnd: '2026-07-01T00:00:00.000Z',
      vendorIds: [VENDOR_COMPANY_ID],
    });
    expect(payload).not.toHaveProperty('deliveryLocationId');
    expect(payload.lineItems).toHaveLength(1);
    expect(await screen.findByText(/create\.headings\.step4Title/)).toBeInTheDocument();
  });

  it('reveals a pick-up location field only on pick-up orders (no delivery location field)', () => {
    renderPage();
    expect(screen.queryByTestId('rfq-pickup-location')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rfq-delivery-location')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('create.basicInfo.pickUpOrder'));
    expect(screen.getByTestId('rfq-pickup-location')).toBeInTheDocument();
    expect(screen.queryByTestId('rfq-delivery-location')).not.toBeInTheDocument();
  });

  it('reveals the earliest allowed delivery date only when holding for release', () => {
    renderPage();
    expect(screen.queryByTestId('rfq-earliest-date')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('create.basicInfo.holdForRelease'));
    expect(screen.getByTestId('rfq-earliest-date')).toBeInTheDocument();
  });

  it('runs the inline availability check from the line-items section', async () => {
    renderPage();
    fillStepOne();
    const table = screen.getByTestId('line-items-table');
    expect(within(table).getByText('Cement')).toBeInTheDocument();
    expect(screen.getByTestId('total-items')).toHaveTextContent('1');

    fireEvent.click(screen.getByTestId('check-availability'));

    await waitFor(() => expect(mockApi.checkRfqAvailability).toHaveBeenCalledTimes(1));
    expect(mockApi.checkRfqAvailability).toHaveBeenCalledWith({
      lineItems: [
        expect.objectContaining({ index: 0, materialId: MATERIAL_ID, quantity: 1, uom: 'bag' }),
      ],
    });
    // Persisting the draft gave the rows server ids (one save).
    expect(mockSaveDraft.mutateAsync).toHaveBeenCalledTimes(1);
    // No bulk-order vendors in the default fixture → the no-coverage hint shows.
    expect(await screen.findByTestId('no-coverage')).toBeInTheDocument();
  });

  it('offers a per-row availability check in the Availability column', async () => {
    renderPage();
    fillStepOne();
    // Before any check, each row exposes an inline Availability "Check" action.
    fireEvent.click(screen.getByTestId('row-check-0'));
    await waitFor(() => expect(mockApi.checkRfqAvailability).toHaveBeenCalledTimes(1));
  });

  it('walks through to review & send and submits the RFQ', async () => {
    renderPage();
    fillStepOne();
    continueWizard();
    await screen.findByText(/create\.headings\.step4Title/);
    expect(screen.getByText('create.review.rfqInformation')).toBeInTheDocument();
    expect(screen.getByText('Structural steel package')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('submit-rfq'));
    await waitFor(() => expect(mockSendRfq.mutateAsync).toHaveBeenCalledWith({ id: 'rfq-1' }));
    // Success dialog with redirect countdown appears.
    expect(await screen.findByText('create.submit.successTitle')).toBeInTheDocument();
    expect(mockApi.confirmRfqCoverage).not.toHaveBeenCalled();
  });

  it('confirms bulk-order coverage and shows the No-RFQ-Required state when fully covered', async () => {
    mockApi.checkRfqAvailability.mockResolvedValue({
      vendors: [{ vendorId: 'v1', vendorName: 'SteelCorp' }],
      items: [
        {
          index: 0,
          matches: [
            {
              bulkOrderId: 'bo-1',
              bulkOrderNumber: 'BO-1',
              bulkOrderLineItemId: 'bol-1',
              vendorId: 'v1',
              qtyRemaining: 500,
              expirationDate: null,
              pricePerUnit: 10,
            },
          ],
        },
      ],
    });
    mockApi.confirmRfqCoverage.mockResolvedValue({
      rfq: { id: 'rfq-1' },
      drawdownsCreated: 1,
      remainingLineItems: 0,
    });
    mockApi.deleteRfq.mockResolvedValue(undefined);

    renderPage();
    fillStepOne();
    fireEvent.click(screen.getByTestId('check-availability'));

    // The line is auto-covered from its best vendor the moment the check
    // returns (no manual "Cover" click), so the row shows the covered state.
    await screen.findByTestId('row-cancel-0');
    expect(screen.queryByTestId('row-cover-0')).not.toBeInTheDocument();
    continueWizard();

    await waitFor(() =>
      expect(mockApi.confirmRfqCoverage).toHaveBeenCalledWith('rfq-1', {
        allocations: [{ rfqLineItemId: 'srv-li-1', bulkOrderLineItemId: 'bol-1', quantity: 1 }],
      }),
    );
    expect(await screen.findByText('create.noRfqRequired.title')).toBeInTheDocument();
    expect(mockApi.deleteRfq).toHaveBeenCalledWith('rfq-1');
  });

  it('seeds line items and locks the project from a Converting-BOM seed', () => {
    mockUseLocation.mockReturnValue({
      state: {
        seed: {
          source: 'BOM',
          projectIds: [PROJECT_ID],
          items: [
            {
              source: 'BOM',
              materialName: 'Paint Primer White 5-Gal',
              quantity: 12,
              uom: 'gallons',
              projectId: PROJECT_ID,
            },
          ],
        },
      },
    });

    renderPage();
    const table = screen.getByTestId('line-items-table');
    expect(within(table).getByText('Paint Primer White 5-Gal')).toBeInTheDocument();
    expect(screen.getByTestId('total-qty')).toHaveTextContent('12');
  });

  it('seeds from a confirmed BOM extraction passed via route state (FOR-200)', () => {
    mockUseLocation.mockReturnValue({ state: { bomExtractionId: 'ext-1' } });
    mockUseConfirmedBoms.mockReturnValue({
      data: {
        items: [
          {
            id: 'ext-1',
            editedResult: {
              documentType: 'BOM',
              items: [
                {
                  description: 'Wide flange beam W12x26',
                  quantity: 4,
                  unit: 'ea',
                  matchedMaterialId: null,
                  matchedMaterialName: null,
                },
              ],
            },
          },
        ],
      },
    });

    renderPage();
    // The seeded rows need a selected project to render their group.
    selectMulti('create.basicInfo.projectPlaceholder', [PROJECT_ID]);
    expect(
      within(screen.getByTestId('line-items-table')).getByText('Wide flange beam W12x26'),
    ).toBeInTheDocument();
  });

  it('saves as draft from any step and navigates to the RFQ detail', async () => {
    renderPage();
    fillStepOne();
    fireEvent.click(screen.getByTestId('save-as-draft'));
    await waitFor(() => expect(mockSaveDraft.mutateAsync).toHaveBeenCalled());
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/rfqs/rfq-1'));
  });

  it('keeps added line items visible before a project is picked (Unassigned group)', () => {
    renderPage();
    // No project selected yet — just add a catalogue material via search.
    addMaterial();
    const table = screen.getByTestId('line-items-table');
    expect(within(table).getByText('Cement')).toBeInTheDocument();
    expect(within(table).getByText('create.lineItems.unassignedGroup')).toBeInTheDocument();
    expect(screen.getByTestId('total-items')).toHaveTextContent('1');
  });

  it('guides to the project field instead of failing the save when none is picked', async () => {
    renderPage();
    addMaterial();
    fireEvent.click(screen.getByTestId('save-as-draft'));
    // The save is never attempted — the missing-project error is surfaced.
    expect(mockSaveDraft.mutateAsync).not.toHaveBeenCalled();
    expect(await screen.findAllByText('create.errors.required')).not.toHaveLength(0);
  });
});
