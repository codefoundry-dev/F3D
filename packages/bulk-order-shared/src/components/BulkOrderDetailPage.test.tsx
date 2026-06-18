/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BulkOrderChangeRequest, BulkOrderDetail } from '@forethread/api-client';

const mockNavigate = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
  detail: undefined as BulkOrderDetail | undefined,
  changeRequests: [] as BulkOrderChangeRequest[],
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: any) => selector({ setTitle: vi.fn() }),
}));

vi.mock('../services/bulk-orders.service', () => ({
  useBulkOrder: () => ({ data: state.detail, isLoading: false, isError: false }),
  useChangeRequests: () => ({ data: state.changeRequests, isLoading: false }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'bo-1' }),
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock('@forethread/ui-components', () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  Button: ({ children, onClick, leftIcon }: any) => (
    <button onClick={onClick}>
      {leftIcon}
      {children}
    </button>
  ),
  Spinner: () => <span data-testid="spinner" />,
  formatDate: (d: string) => d,
  notificationService: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('./BulkOrderDetailTabs', () => ({
  BulkOrderDetailTabs: () => <div data-testid="tabs" />,
}));
vi.mock('./BulkOrderLineItemsTable', () => ({
  BulkOrderLineItemsTable: () => <div data-testid="line-items" />,
}));
vi.mock('./CancelBulkOrderModal', () => ({ CancelBulkOrderModal: () => <div /> }));
vi.mock('./ChangeHistoryTab', () => ({ ChangeHistoryTab: () => <div /> }));
vi.mock('./DetailField', () => ({ DetailField: () => <div /> }));
vi.mock('./DrawdownHistoryTab', () => ({ DrawdownHistoryTab: () => <div /> }));
vi.mock('./InlineExtensionReview', () => ({
  InlineExtensionReview: () => <div data-testid="inline-extension-review" />,
}));
vi.mock('./ProposeExtensionModal', () => ({
  ProposeExtensionModal: () => <div data-testid="propose-extension-modal" />,
}));

vi.mock('@forethread/ui-components/assets/icons/date.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/clock-icon.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit-without-line.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/letter.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/mark-with-cyrcle.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/plus.svg?react', () => ({
  default: () => <span />,
}));

import { fireEvent, render, screen } from '@testing-library/react';

import { BulkOrderDetailPage } from './BulkOrderDetailPage';

function makeDetail(overrides: Partial<BulkOrderDetail> = {}): BulkOrderDetail {
  return {
    id: 'bo-1',
    bulkId: 'BULK-2025-011',
    rfqReference: 'RFQ-2025-011',
    contractorName: 'Acme',
    vendorName: 'Vendor name',
    projectName: 'Riverside Park Development',
    createdDate: '2025-01-15T00:00:00Z',
    endDate: '2025-01-15T00:00:00Z',
    createdBy: 'Sarah Chen',
    status: 'ACTIVE',
    lineItems: [],
    drawdowns: [],
    ...overrides,
  };
}

function makeCr(overrides: Partial<BulkOrderChangeRequest> = {}): BulkOrderChangeRequest {
  return {
    id: 'cr-1',
    bulkOrderId: 'bo-1',
    requestedBy: { id: 'u-proposer', name: 'Sarah Chen' },
    changes: { endDate: '2025-03-01T00:00:00Z' },
    message: 'note',
    status: 'PENDING',
    reason: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockNavigate.mockReset();
  state.detail = makeDetail();
  state.changeRequests = [];
});

describe('BulkOrderDetailPage action buttons', () => {
  it('renders Create drawdown and Change when there is no pending change (Figma US 2.11)', () => {
    render(<BulkOrderDetailPage />);
    expect(screen.getByText('detail.createDrawdown')).toBeInTheDocument();
    expect(screen.getByText('detail.change')).toBeInTheDocument();
    // Propose extension was consolidated into the Change flow per the Figma design.
    expect(screen.queryByText('detail.proposeExtension')).not.toBeInTheDocument();
  });

  it('navigates to the drawdown route from Create drawdown', () => {
    render(<BulkOrderDetailPage />);
    fireEvent.click(screen.getByText('detail.createDrawdown'));
    expect(mockNavigate).toHaveBeenCalledWith('/bulk-orders/bo-1/drawdown');
  });

  it('navigates to the change route from Change', () => {
    render(<BulkOrderDetailPage />);
    fireEvent.click(screen.getByText('detail.change'));
    expect(mockNavigate).toHaveBeenCalledWith('/bulk-orders/bo-1/change');
  });
});

describe('BulkOrderDetailPage extension review', () => {
  it('renders the inline extension review for an end-date-only pending change as the approver', () => {
    state.changeRequests = [makeCr()];
    // currentUserId differs from the proposer => current user is the approver.
    render(<BulkOrderDetailPage currentUserId="u-approver" />);
    expect(screen.getByTestId('inline-extension-review')).toBeInTheDocument();
    // The change/drawdown action bar is hidden while reviewing an extension.
    expect(screen.queryByText('detail.change')).not.toBeInTheDocument();
  });

  it('does not render the inline review for the proposer (shows generic pending alert)', () => {
    state.changeRequests = [makeCr({ requestedBy: { id: 'u-me', name: 'Me' } })];
    render(<BulkOrderDetailPage currentUserId="u-me" />);
    expect(screen.queryByTestId('inline-extension-review')).not.toBeInTheDocument();
    expect(screen.getByTestId('alert')).toBeInTheDocument();
  });

  it('does not render the inline review for a line-item change request', () => {
    state.changeRequests = [
      makeCr({ changes: { lineItems: [{ action: 'update', lineItemId: 'li-1', quantity: 5 }] } }),
    ];
    render(<BulkOrderDetailPage currentUserId="u-approver" />);
    expect(screen.queryByTestId('inline-extension-review')).not.toBeInTheDocument();
  });
});
