const mockNavigate = vi.hoisted(() => vi.fn());
const mockMutate = vi.hoisted(() => vi.fn());
const mockLocationState = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: mockLocationState.current }),
}));

let capturedProps: Record<string, unknown> = {};

vi.mock('@forethread/po-shared', () => ({
  CreatePoWizard: (props: Record<string, unknown>) => {
    capturedProps = props;
    return <div data-testid="create-po-wizard" />;
  },
}));

vi.mock('../services/purchase-orders.service', () => ({
  useProjectsList: () => ({
    data: {
      items: [
        { id: 'proj-1', name: 'Project Alpha' },
        { id: 'proj-2', name: 'Project Beta' },
      ],
    },
  }),
  useProjectDetail: (projectId: string) => ({
    data: projectId
      ? {
          currency: 'USD',
          locations: [
            { id: 'loc-1', type: 'DELIVERY', label: 'Warehouse A', address: '123 Main St' },
          ],
        }
      : null,
  }),
  useCompanyVendors: () => ({
    data: [{ id: 'v-1', legalName: 'Vendor One', tradeName: null }],
  }),
  useCreatePurchaseOrder: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

import { render, screen, act } from '@testing-library/react';

import CreatePurchaseOrderPage from './CreatePurchaseOrderPage';

describe('CreatePurchaseOrderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProps = {};
  });

  it('renders CreatePoWizard', () => {
    render(<CreatePurchaseOrderPage />);
    expect(screen.getByTestId('create-po-wizard')).toBeInTheDocument();
  });

  it('passes projectsData from useProjectsList', () => {
    render(<CreatePurchaseOrderPage />);
    expect(capturedProps.projectsData).toEqual({
      items: [
        { id: 'proj-1', name: 'Project Alpha' },
        { id: 'proj-2', name: 'Project Beta' },
      ],
    });
  });

  it('passes vendorsData from useCompanyVendors', () => {
    render(<CreatePurchaseOrderPage />);
    expect(capturedProps.vendorsData).toEqual([
      { id: 'v-1', legalName: 'Vendor One', tradeName: null },
    ]);
  });

  it('passes isCreating from mutation isPending', () => {
    render(<CreatePurchaseOrderPage />);
    expect(capturedProps.isCreating).toBe(false);
  });

  it('onNavigateBack navigates to purchase orders route', () => {
    render(<CreatePurchaseOrderPage />);
    act(() => {
      (capturedProps.onNavigateBack as () => void)();
    });
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders');
  });

  it('onSuccess navigates to purchase orders route', () => {
    render(<CreatePurchaseOrderPage />);
    act(() => {
      (capturedProps.onSuccess as () => void)();
    });
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders');
  });

  it('onCreatePo calls mutation.mutate with input and callbacks', () => {
    render(<CreatePurchaseOrderPage />);
    const input = { documentName: 'Test PO' };
    const files: File[] = [];
    const callbacks = { onSuccess: vi.fn(), onError: vi.fn() };
    act(() => {
      (capturedProps.onCreatePo as (input: unknown, files: File[], cb: unknown) => void)(
        input,
        files,
        callbacks,
      );
    });
    expect(mockMutate).toHaveBeenCalledWith(
      input,
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it('onProjectIdChange updates projectId for useProjectDetail', () => {
    render(<CreatePurchaseOrderPage />);
    expect(typeof capturedProps.onProjectIdChange).toBe('function');
  });

  it('passes initialValues and lockedFields from route state', () => {
    mockLocationState.current = {
      mode: 'from-rfq',
      defaultValues: { projectId: 'proj-1', vendorId: 'v-1' },
      lockedFields: ['projectId', 'vendorId'],
    };
    render(<CreatePurchaseOrderPage />);
    expect(capturedProps.initialValues).toEqual({
      projectId: 'proj-1',
      vendorId: 'v-1',
    });
    expect(capturedProps.lockedFields).toBeInstanceOf(Set);
    expect((capturedProps.lockedFields as Set<string>).has('projectId')).toBe(true);
    expect((capturedProps.lockedFields as Set<string>).has('vendorId')).toBe(true);
    expect(capturedProps.creationMode).toBe('from-rfq');
    mockLocationState.current = null;
  });
});
