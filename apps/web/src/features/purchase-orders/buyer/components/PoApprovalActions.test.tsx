import type { PoDetail } from '@forethread/api-client';
import { render, screen, fireEvent } from '@testing-library/react';

const mockApprove = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const mockSuccess = vi.hoisted(() => vi.fn());
const mockError = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', () => ({
  approvePurchaseOrder: mockApprove,
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({
    children,
    onClick,
    isLoading,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    isLoading?: boolean;
  }) => (
    <button data-loading={isLoading} onClick={onClick}>
      {children}
    </button>
  ),
  notificationService: { success: mockSuccess, error: mockError },
}));

vi.mock('@tanstack/react-query', () => ({
  // mutate runs the mutationFn then its onSuccess so we can assert the wiring
  useMutation: (opts: { mutationFn: () => unknown; onSuccess?: () => void }) => ({
    mutate: () => {
      opts.mutationFn();
      opts.onSuccess?.();
    },
    isPending: false,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('./DeclinePoReasonModal', () => ({
  DeclinePoReasonModal: () => <div data-testid="decline-modal" />,
}));

import { PoApprovalActions } from './PoApprovalActions';

function makePo(overrides: Partial<PoDetail>): PoDetail {
  return { id: 'po-1', status: 'PENDING_APPROVAL', totalAmount: 1500, ...overrides } as PoDetail;
}

describe('PoApprovalActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing when the PO is not PENDING_APPROVAL', () => {
    const { container } = render(<PoApprovalActions po={makePo({ status: 'SENT' })} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows Approve and Decline for a PENDING_APPROVAL PO', () => {
    render(<PoApprovalActions po={makePo({})} />);
    expect(screen.getByText('actions.approve')).toBeInTheDocument();
    expect(screen.getByText('actions.decline')).toBeInTheDocument();
  });

  it('approves via the API and toasts on success', () => {
    render(<PoApprovalActions po={makePo({ id: 'po-9' })} />);
    fireEvent.click(screen.getByText('actions.approve'));
    expect(mockApprove).toHaveBeenCalledWith('po-9');
    expect(mockSuccess).toHaveBeenCalledWith('send.approved');
  });

  it('opens the decline reason modal', () => {
    render(<PoApprovalActions po={makePo({})} />);
    expect(screen.queryByTestId('decline-modal')).toBeNull();
    fireEvent.click(screen.getByText('actions.decline'));
    expect(screen.getByTestId('decline-modal')).toBeInTheDocument();
  });
});
