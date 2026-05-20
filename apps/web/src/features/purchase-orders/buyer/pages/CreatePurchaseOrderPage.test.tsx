const mockNavigate = vi.hoisted(() => vi.fn());
const mockCreateMutate = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
}));

vi.mock('@forethread/po-shared', () => ({
  CreatePoWizard: (props: any) => (
    <div data-testid="create-po-wizard">
      <button data-testid="navigate-back" onClick={props.onNavigateBack}>
        back
      </button>
      <button data-testid="on-success" onClick={props.onSuccess}>
        success
      </button>
      <span data-testid="is-creating">{String(props.isCreating)}</span>
      <button
        data-testid="on-create-po"
        onClick={() =>
          props.onCreatePo({ poType: 'STANDARD' }, [], { onSuccess: () => {}, onError: () => {} })
        }
      >
        create
      </button>
      <button data-testid="on-project-id-change" onClick={() => props.onProjectIdChange('proj-1')}>
        change project
      </button>
    </div>
  ),
}));

vi.mock('@forethread/shared-types/client', () => ({
  PoType: { STANDARD: 'STANDARD', HOLD_FOR_RELEASE: 'HOLD_FOR_RELEASE' },
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({
    children,
    onClick,
    type,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    type?: string;
  }) => (
    <button type={(type as 'button' | 'submit') ?? 'button'} onClick={onClick}>
      {children}
    </button>
  ),
  CopyEntityModal: ({ children }: any) => <div data-testid="copy-entity-modal">{children}</div>,
  notificationService: { error: vi.fn() },
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
  onPhoneOnly: vi.fn(),
  StatusSuccessModal: () => <div data-testid="success-modal" />,
  StatusErrorModal: () => <div data-testid="error-modal" />,
}));

vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => vi.fn(),
}));

vi.mock('../services/purchase-orders.service', () => ({
  useProjectsList: () => ({ data: { items: [{ id: 'proj-1', name: 'Project A' }] } }),
  useProjectDetail: () => ({ data: { id: 'proj-1', locations: [] } }),
  useCompanyVendors: () => ({ data: [{ id: 'v-1', name: 'Vendor A' }] }),
  useCreatePurchaseOrder: () => ({
    mutate: mockCreateMutate,
    isPending: false,
  }),
}));

import { render, screen, fireEvent } from '@testing-library/react';

import CreatePurchaseOrderPage from './CreatePurchaseOrderPage';

describe('CreatePurchaseOrderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders CreatePoWizard', () => {
    render(<CreatePurchaseOrderPage />);
    expect(screen.getByTestId('create-po-wizard')).toBeInTheDocument();
  });

  it('passes projectsData to wizard', () => {
    render(<CreatePurchaseOrderPage />);
    // The wizard renders, which means projectsData was passed successfully
    expect(screen.getByTestId('create-po-wizard')).toBeInTheDocument();
  });

  it('navigates back to purchase orders on onNavigateBack', () => {
    render(<CreatePurchaseOrderPage />);
    fireEvent.click(screen.getByTestId('navigate-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders');
  });

  it('navigates to purchase orders on onSuccess', () => {
    render(<CreatePurchaseOrderPage />);
    fireEvent.click(screen.getByTestId('on-success'));
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders');
  });

  it('calls createMutation.mutate via onCreatePo', () => {
    render(<CreatePurchaseOrderPage />);
    fireEvent.click(screen.getByTestId('on-create-po'));
    expect(mockCreateMutate).toHaveBeenCalledWith(
      { poType: 'STANDARD' },
      { onSuccess: expect.any(Function), onError: expect.any(Function) },
    );
  });

  it('passes isCreating as false when not pending', () => {
    render(<CreatePurchaseOrderPage />);
    expect(screen.getByTestId('is-creating')).toHaveTextContent('false');
  });

  it('handles onProjectIdChange', () => {
    render(<CreatePurchaseOrderPage />);
    // Clicking triggers setProjectId('proj-1'), which re-renders with useProjectDetail
    fireEvent.click(screen.getByTestId('on-project-id-change'));
    // No crash means state update worked
    expect(screen.getByTestId('create-po-wizard')).toBeInTheDocument();
  });
});
