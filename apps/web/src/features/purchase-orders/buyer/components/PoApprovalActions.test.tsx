import type { PoDetail } from '@forethread/api-client';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockApprove = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const mockSuccess = vi.hoisted(() => vi.fn());
const mockError = vi.hoisted(() => vi.fn());
// The viewer's poApprovalThreshold (null = unlimited) — varied per test.
const mockThreshold = vi.hoisted(() => ({ value: null as number | null }));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', () => ({
  approvePurchaseOrder: mockApprove,
}));

vi.mock('@forethread/ui-components', () => ({
  useIsPhone: () => false,
  Button: ({
    children,
    onClick,
    isLoading,
    disabled,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    'data-testid'?: string;
  }) => (
    <button data-loading={isLoading} disabled={disabled} onClick={onClick} data-testid={testId}>
      {children}
    </button>
  ),
  Tooltip: ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) => (
    <div>
      <span data-testid="tooltip-content">{content}</span>
      {children}
    </div>
  ),
  notificationService: { success: mockSuccess, error: mockError },
}));

vi.mock('@tanstack/react-query', () => ({
  // mutate runs the mutationFn then routes the settled promise to onSuccess /
  // onError so both toast paths can be asserted (via waitFor — it settles async)
  useMutation: (opts: {
    mutationFn: () => Promise<unknown>;
    onSuccess?: () => void;
    onError?: (error: unknown) => void;
  }) => ({
    mutate: () => {
      opts.mutationFn().then(
        () => opts.onSuccess?.(),
        (error) => opts.onError?.(error),
      );
    },
    isPending: false,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('../services/purchase-orders.service', () => ({
  useMe: () => ({ data: { poApprovalThreshold: mockThreshold.value } }),
}));

vi.mock('./DeclinePoReasonModal', () => ({
  DeclinePoReasonModal: () => <div data-testid="decline-modal" />,
}));

import { PoApprovalActions } from './PoApprovalActions';

function makePo(overrides: Partial<PoDetail>): PoDetail {
  return {
    id: 'po-1',
    status: 'PENDING_APPROVAL',
    totalAmount: 1500,
    currency: 'AUD',
    ...overrides,
  } as PoDetail;
}

describe('PoApprovalActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockThreshold.value = null;
    mockApprove.mockImplementation(() => Promise.resolve());
  });

  it('renders nothing when the PO is not PENDING_APPROVAL', () => {
    const { container } = render(<PoApprovalActions po={makePo({ status: 'SENT' })} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows Approve and Decline for a PENDING_APPROVAL PO', () => {
    render(<PoApprovalActions po={makePo({})} />);
    expect(screen.getByText('actions.approve')).toBeInTheDocument();
    expect(screen.getByText('actions.decline')).toBeInTheDocument();
  });

  it('approves via the API and toasts on success', async () => {
    render(<PoApprovalActions po={makePo({ id: 'po-9' })} />);
    fireEvent.click(screen.getByText('actions.approve'));
    expect(mockApprove).toHaveBeenCalledWith('po-9');
    await waitFor(() => expect(mockSuccess).toHaveBeenCalledWith('send.approved'));
  });

  it('surfaces the backend message when approval fails', async () => {
    mockApprove.mockImplementation(() =>
      Promise.reject(
        Object.assign(new Error('Forbidden'), {
          isAxiosError: true,
          response: {
            data: { message: 'PO total 1500 AUD exceeds your approval limit of 1000 AUD' },
          },
        }),
      ),
    );
    render(<PoApprovalActions po={makePo({})} />);
    fireEvent.click(screen.getByText('actions.approve'));
    await waitFor(() =>
      expect(mockError).toHaveBeenCalledWith(
        'PO total 1500 AUD exceeds your approval limit of 1000 AUD',
      ),
    );
  });

  it('opens the decline reason modal', () => {
    render(<PoApprovalActions po={makePo({})} />);
    expect(screen.queryByTestId('decline-modal')).toBeNull();
    fireEvent.click(screen.getByText('actions.decline'));
    expect(screen.getByTestId('decline-modal')).toBeInTheDocument();
  });

  describe('over-limit viewer (FOR-286)', () => {
    it('disables Approve with an explanatory tooltip when the PO total is above the cap', () => {
      mockThreshold.value = 1000;
      render(<PoApprovalActions po={makePo({ totalAmount: 1500 })} />);

      expect(screen.getByTestId('po-approve-button')).toBeDisabled();
      expect(screen.getByTestId('po-approve-over-limit')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip-content')).toHaveTextContent('send.overApprovalLimit');
      fireEvent.click(screen.getByTestId('po-approve-button'));
      expect(mockApprove).not.toHaveBeenCalled();
    });

    it('keeps Approve enabled when the cap covers the total (inclusive)', () => {
      mockThreshold.value = 1500;
      render(<PoApprovalActions po={makePo({ totalAmount: 1500 })} />);

      expect(screen.getByTestId('po-approve-button')).not.toBeDisabled();
      expect(screen.queryByTestId('po-approve-over-limit')).toBeNull();
    });

    it('keeps Decline available to an over-limit viewer', () => {
      mockThreshold.value = 0;
      render(<PoApprovalActions po={makePo({})} />);

      fireEvent.click(screen.getByText('actions.decline'));
      expect(screen.getByTestId('decline-modal')).toBeInTheDocument();
    });
  });
});
