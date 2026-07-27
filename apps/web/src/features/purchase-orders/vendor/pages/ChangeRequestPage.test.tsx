const mockPo = vi.hoisted(() => ({
  value: {
    data: {
      id: 'po-1',
      poNumber: 'PO-001',
      projectId: 'proj-1',
      projectName: 'Test Project',
      vendor: { id: 'v-1', name: 'Acme Supplies' },
      deliveryLocationId: 'loc-1',
      deliveryLocationName: 'Site A',
      lineItems: [],
    } as Record<string, unknown> | null,
    isLoading: false,
    isError: false,
  },
}));

const mockPropose = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const mockWizard = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'po-1' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/po-shared', () => ({
  usePurchaseOrder: () => mockPo.value,
  poToFormDefaults: () => ({ defaultValues: { projectId: 'proj-1' } }),
  CreatePoWizard: (props: Record<string, unknown>) => {
    mockWizard.props = props;
    return <div data-testid="wizard">wizard:{String(props.mode)}</div>;
  },
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: () => vi.fn(),
}));

vi.mock('@forethread/ui-components', () => ({
  todayIso: () => new Date().toISOString().slice(0, 10),
  Spinner: () => <div data-testid="spinner" />,
  Alert: ({ children }: { children: React.ReactNode }) => <div role="alert">{children}</div>,
}));

vi.mock('../services/purchase-orders.service', () => ({
  useProposePoChange: () => mockPropose,
}));

import { render, screen } from '@testing-library/react';

import ChangeRequestPage from './ChangeRequestPage';

describe('ChangeRequestPage (vendor)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWizard.props = null;
    mockPo.value = {
      data: {
        id: 'po-1',
        poNumber: 'PO-001',
        projectId: 'proj-1',
        projectName: 'Test Project',
        vendor: { id: 'v-1', name: 'Acme Supplies' },
        deliveryLocationId: 'loc-1',
        deliveryLocationName: 'Site A',
        lineItems: [],
      },
      isLoading: false,
      isError: false,
    };
  });

  it('shows a spinner while loading', () => {
    mockPo.value = { data: null, isLoading: true, isError: false };
    render(<ChangeRequestPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows an error when the PO fails to load', () => {
    mockPo.value = { data: null, isLoading: false, isError: true };
    render(<ChangeRequestPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('detail.failedToLoad');
  });

  it('renders the shared PO wizard in change mode', () => {
    render(<ChangeRequestPage />);
    expect(screen.getByTestId('wizard')).toHaveTextContent('wizard:change');
  });

  it('locks the buyer-owned identity fields and passes the PO through', () => {
    render(<ChangeRequestPage />);
    const props = mockWizard.props!;
    expect(props.existingPo).toMatchObject({ id: 'po-1' });
    const locked = props.lockedFields as Set<string>;
    expect(locked.has('projectId')).toBe(true);
    expect(locked.has('vendorId')).toBe(true);
    expect(locked.has('deliveryLocationId')).toBe(true);
  });

  it('drives the locked dropdown labels from the PO (no extra fetches)', () => {
    render(<ChangeRequestPage />);
    const props = mockWizard.props!;
    expect(props.projectsData).toEqual({ items: [{ id: 'proj-1', name: 'Test Project' }] });
    expect((props.vendorsData as Array<{ id: string }>)[0]).toMatchObject({ id: 'v-1' });
    expect((props.projectDetail as { locations: unknown[] }).locations).toHaveLength(1);
  });

  it('forwards a proposed change to the mutation', () => {
    render(<ChangeRequestPage />);
    const props = mockWizard.props!;
    const onProposeChange = props.onProposeChange as (
      input: unknown,
      cb: { onSuccess: () => void; onError: () => void },
    ) => void;
    const input = { changeType: 'COMMERCIAL', changedFields: { fields: {} } };
    onProposeChange(input, { onSuccess: vi.fn(), onError: vi.fn() });
    expect(mockPropose.mutate).toHaveBeenCalledWith(input, expect.any(Object));
  });
});
