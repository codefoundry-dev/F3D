import type { MrDetail } from '@forethread/api-client';
import { render, screen, fireEvent } from '@testing-library/react';
import type React from 'react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockUseParams = vi.hoisted(() => vi.fn(() => ({ id: 'mr-1' })));
const mockHas = vi.hoisted(() => vi.fn());
const mockUseMaterialRequest = vi.hoisted(() => vi.fn());
const mockUseAudit = vi.hoisted(() => vi.fn(() => ({ data: [], isLoading: false })));
const approveMutate = vi.hoisted(() => vi.fn());
const declineMutate = vi.hoisted(() => vi.fn());
const convertRfqMutate = vi.hoisted(() => vi.fn());
const convertPoMutate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
}));
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
vi.mock('@forethread/ui-components', () => ({
  // B7 (FOR-373): desktop layout in tests; PageActions renders its actions inline.
  useIsPhone: () => false,
  useHideMobileNav: () => {},
  MobileActionBar: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PageActions: ({
    primary,
    secondary = [],
  }: {
    primary?: React.ReactNode;
    secondary?: Array<{
      key: string;
      label: string;
      onClick: () => void;
      disabled?: boolean;
      testId?: string;
    }>;
  }) => (
    <div>
      {secondary.map((a) => (
        <button
          key={a.key}
          type="button"
          onClick={a.onClick}
          disabled={a.disabled}
          data-testid={a.testId}
        >
          {a.label}
        </button>
      ))}
      {primary}
    </div>
  ),
  Button: ({
    children,
    onClick,
    disabled,
    leftIcon: _leftIcon,
    rightIcon: _rightIcon,
    isLoading: _isLoading,
    variant: _variant,
    size: _size,
    ...props
  }: Record<string, unknown>) => (
    <button onClick={onClick as () => void} disabled={disabled as boolean} {...props}>
      {children as ReactNode}
    </button>
  ),
  Spinner: () => <div data-testid="spinner" />,
  formatDate: (d: string) => d,
  formatDateTime: (d: string) => d,
}));
vi.mock('@forethread/ui-components/assets/icons/chevron-right.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@/app/route-config', () => ({
  ROUTES: {
    materialRequests: '/material-requests',
    materialRequestDetail: '/material-requests/:id',
    rfqDetail: '/rfqs/:id',
    purchaseOrderDetail: '/purchase-orders/:id',
  },
}));
vi.mock('@/shared/role/usePermissions', () => ({ usePermissions: () => ({ has: mockHas }) }));
// Current-user identity for the FOR-349 own-request gate. Defaults to a viewer
// who is NOT the fixture requester ('u1'); own-request tests point it at 'u1'.
const mockCurrentUser = vi.hoisted(() => ({ id: 'viewer-9' }));
vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: (s: { currentUser: { id: string } }) => unknown) =>
    selector({ currentUser: { id: mockCurrentUser.id } }),
}));
vi.mock('../components/MrStatusBadge', () => ({
  MrStatusBadge: ({ status }: { status: string }) => <span>status:{status}</span>,
  MrPriorityBadge: ({ priority }: { priority: string }) => <span>prio:{priority}</span>,
}));
vi.mock('../components/MrLineItemsTable', () => ({
  MrLineItemsTable: () => <div data-testid="line-items" />,
}));
vi.mock('../components/MrActivityTimeline', () => ({
  MrActivityTimeline: () => <div data-testid="activity" />,
}));
vi.mock('../components/DeclineReasonModal', () => ({
  DeclineReasonModal: ({ onConfirm }: { onConfirm: (r: string) => void }) => (
    <div data-testid="decline-modal">
      <button onClick={() => onConfirm('too expensive')}>confirm-decline</button>
    </div>
  ),
}));
vi.mock('../components/ConvertToPoModal', () => ({
  ConvertToPoModal: ({ onConfirm }: { onConfirm: (v: string) => void }) => (
    <div data-testid="convert-po-modal">
      <button onClick={() => onConfirm('vendor-9')}>confirm-po</button>
    </div>
  ),
}));
// The Approver Pool panel has its own suite in @forethread/approval-shared; here
// it is a stub like every other child, so this suite stays about page layout.
vi.mock('@forethread/approval-shared', () => ({
  ApproverPoolPanel: (props: { entityType: string; entityId: string }) => (
    <div
      data-testid="approver-pool-panel"
      data-entity-type={props.entityType}
      data-entity-id={props.entityId}
    />
  ),
}));
vi.mock('../../services/material-requests.service', () => ({
  useMaterialRequest: (id: string) => mockUseMaterialRequest(id),
  useMaterialRequestAudit: () => mockUseAudit(),
  useApproveMaterialRequest: () => ({ mutate: approveMutate, isPending: false }),
  useDeclineMaterialRequest: () => ({ mutate: declineMutate, isPending: false }),
  useConvertMaterialRequestToRfq: () => ({ mutate: convertRfqMutate, isPending: false }),
  useConvertMaterialRequestToPo: () => ({ mutate: convertPoMutate, isPending: false }),
}));

import MaterialRequestDetailPage from './MaterialRequestDetailPage';

function detail(overrides: Partial<MrDetail>): MrDetail {
  return {
    id: 'mr-1',
    mrNumber: 'MR-0001',
    status: 'SUBMITTED',
    priority: 'HIGH',
    projectId: 'p1',
    project: { id: 'p1', name: 'Downtown Office' },
    company: { id: 'comp-1', name: 'BuildCo' },
    requestedBy: { id: 'u1', name: 'John Foreman', email: 'john@x.com' },
    reviewedBy: null,
    reviewedAt: null,
    declineReason: null,
    neededByDate: '2026-07-01',
    deliveryLocationId: 'loc-1',
    deliveryLocation: 'Main gate',
    note: 'Urgent for framing',
    convertedToRfq: null,
    convertedToPo: null,
    convertedAt: null,
    lineItems: [],
    createdAt: '2026-06-15',
    updatedAt: '2026-06-15',
    ...overrides,
  };
}

describe('MaterialRequestDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHas.mockReturnValue(true);
    mockCurrentUser.id = 'viewer-9';
    mockUseAudit.mockReturnValue({ data: [], isLoading: false });
  });

  it('shows the spinner while loading', () => {
    mockUseMaterialRequest.mockReturnValue({ isLoading: true });
    render(<MaterialRequestDetailPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows the not-found state on error', () => {
    mockUseMaterialRequest.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    render(<MaterialRequestDetailPage />);
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('renders the header and core meta', () => {
    mockUseMaterialRequest.mockReturnValue({ isLoading: false, data: detail({}) });
    render(<MaterialRequestDetailPage />);
    expect(screen.getByText('MR-0001')).toBeInTheDocument();
    expect(screen.getByText('john@x.com')).toBeInTheDocument();
    expect(screen.getByTestId('line-items')).toBeInTheDocument();
    expect(screen.getByTestId('activity')).toBeInTheDocument();
  });

  it('mounts the Approver Pool panel for the material request (FOR-347)', () => {
    mockUseMaterialRequest.mockReturnValue({ isLoading: false, data: detail({}) });
    render(<MaterialRequestDetailPage />);
    const panel = screen.getByTestId('approver-pool-panel');
    expect(panel).toHaveAttribute('data-entity-type', 'MATERIAL_REQUEST');
    expect(panel).toHaveAttribute('data-entity-id', 'mr-1');
  });

  it('shows Approve + Decline for a SUBMITTED request with permissions', () => {
    mockUseMaterialRequest.mockReturnValue({
      isLoading: false,
      data: detail({ status: 'SUBMITTED' }),
    });
    render(<MaterialRequestDetailPage />);
    expect(screen.getByTestId('mr-approve')).toBeInTheDocument();
    expect(screen.getByTestId('mr-decline')).toBeInTheDocument();
    expect(screen.queryByTestId('mr-convert-rfq')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mr-own-request-note')).not.toBeInTheDocument();
  });

  it('hides Approve/Decline and explains when the viewer raised the request (FOR-349)', () => {
    mockCurrentUser.id = 'u1'; // the fixture requester
    mockUseMaterialRequest.mockReturnValue({
      isLoading: false,
      data: detail({ status: 'SUBMITTED' }),
    });
    render(<MaterialRequestDetailPage />);
    expect(screen.queryByTestId('mr-approve')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mr-decline')).not.toBeInTheDocument();
    expect(screen.getByTestId('mr-own-request-note')).toBeInTheDocument();
  });

  it('shows no own-request note to a requester without review permissions (FOR-349)', () => {
    mockCurrentUser.id = 'u1';
    mockHas.mockReturnValue(false);
    mockUseMaterialRequest.mockReturnValue({
      isLoading: false,
      data: detail({ status: 'SUBMITTED' }),
    });
    render(<MaterialRequestDetailPage />);
    expect(screen.queryByTestId('mr-own-request-note')).not.toBeInTheDocument();
  });

  it('hides Approve/Decline when the user lacks the permissions', () => {
    mockHas.mockReturnValue(false);
    mockUseMaterialRequest.mockReturnValue({
      isLoading: false,
      data: detail({ status: 'SUBMITTED' }),
    });
    render(<MaterialRequestDetailPage />);
    expect(screen.queryByTestId('mr-approve')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mr-decline')).not.toBeInTheDocument();
  });

  it('shows Convert buttons only for an APPROVED request', () => {
    mockUseMaterialRequest.mockReturnValue({
      isLoading: false,
      data: detail({ status: 'APPROVED' }),
    });
    render(<MaterialRequestDetailPage />);
    expect(screen.getByTestId('mr-convert-rfq')).toBeInTheDocument();
    expect(screen.getByTestId('mr-convert-po')).toBeInTheDocument();
    expect(screen.queryByTestId('mr-approve')).not.toBeInTheDocument();
  });

  it('shows a terminal note and no actions for a CONVERTED request', () => {
    mockUseMaterialRequest.mockReturnValue({
      isLoading: false,
      data: detail({ status: 'CONVERTED' }),
    });
    render(<MaterialRequestDetailPage />);
    expect(screen.getByTestId('mr-terminal-note')).toBeInTheDocument();
    expect(screen.queryByTestId('mr-approve')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mr-convert-po')).not.toBeInTheDocument();
  });

  it('approves via the mutation', () => {
    mockUseMaterialRequest.mockReturnValue({
      isLoading: false,
      data: detail({ status: 'SUBMITTED' }),
    });
    render(<MaterialRequestDetailPage />);
    fireEvent.click(screen.getByTestId('mr-approve'));
    expect(approveMutate).toHaveBeenCalledWith('mr-1');
  });

  it('opens the decline modal and submits the reason', () => {
    mockUseMaterialRequest.mockReturnValue({
      isLoading: false,
      data: detail({ status: 'SUBMITTED' }),
    });
    render(<MaterialRequestDetailPage />);
    expect(screen.queryByTestId('decline-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mr-decline'));
    fireEvent.click(screen.getByText('confirm-decline'));
    expect(declineMutate).toHaveBeenCalledWith(
      { id: 'mr-1', reason: 'too expensive' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('converts to RFQ and navigates to the new RFQ on success', () => {
    convertRfqMutate.mockImplementation((_args, opts) =>
      opts.onSuccess({ rfqId: 'rfq-7', rfqNumber: 'RFQ-7' }),
    );
    mockUseMaterialRequest.mockReturnValue({
      isLoading: false,
      data: detail({ status: 'APPROVED' }),
    });
    render(<MaterialRequestDetailPage />);
    fireEvent.click(screen.getByTestId('mr-convert-rfq'));
    expect(convertRfqMutate).toHaveBeenCalledWith(
      { id: 'mr-1', input: {} },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs/rfq-7');
  });

  it('converts to PO via the modal and navigates to the new PO on success', () => {
    convertPoMutate.mockImplementation((_args, opts) =>
      opts.onSuccess({ poId: 'po-3', poNumber: 'PO-3' }),
    );
    mockUseMaterialRequest.mockReturnValue({
      isLoading: false,
      data: detail({ status: 'APPROVED' }),
    });
    render(<MaterialRequestDetailPage />);
    fireEvent.click(screen.getByTestId('mr-convert-po'));
    fireEvent.click(screen.getByText('confirm-po'));
    expect(convertPoMutate).toHaveBeenCalledWith(
      { id: 'mr-1', input: { vendorId: 'vendor-9' } },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-orders/po-3');
  });

  it('renders the decline reason and reviewer for a DECLINED request', () => {
    mockUseMaterialRequest.mockReturnValue({
      isLoading: false,
      data: detail({
        status: 'DECLINED',
        declineReason: 'Out of budget',
        reviewedBy: { id: 'r1', name: 'Reviewer', email: 'r@x.com' },
        reviewedAt: '2026-06-16',
      }),
    });
    render(<MaterialRequestDetailPage />);
    expect(screen.getByText('Out of budget')).toBeInTheDocument();
  });

  it('links to the converted RFQ', () => {
    mockUseMaterialRequest.mockReturnValue({
      isLoading: false,
      data: detail({ status: 'CONVERTED', convertedToRfq: { id: 'rfq-99', rfqNumber: 'RFQ-99' } }),
    });
    render(<MaterialRequestDetailPage />);
    fireEvent.click(screen.getByTestId('mr-converted-rfq-link'));
    expect(mockNavigate).toHaveBeenCalledWith('/rfqs/rfq-99');
  });

  it('back link returns to the list', () => {
    mockUseMaterialRequest.mockReturnValue({ isLoading: false, data: detail({}) });
    render(<MaterialRequestDetailPage />);
    fireEvent.click(screen.getByTestId('mr-detail-back'));
    expect(mockNavigate).toHaveBeenCalledWith('/material-requests');
  });
});
