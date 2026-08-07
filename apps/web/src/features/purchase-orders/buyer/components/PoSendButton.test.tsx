import type { PoDetail } from '@forethread/api-client';
import { render, screen, fireEvent } from '@testing-library/react';

const mockUseMe = vi.hoisted(() => vi.fn());
const mockMutate = vi.hoisted(() => vi.fn());
const mockSuccess = vi.hoisted(() => vi.fn());
const mockError = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/po-shared', async () => {
  const actual =
    await vi.importActual<typeof import('@forethread/po-shared')>('@forethread/po-shared');
  return { requiresApproval: actual.requiresApproval };
});

// The nomination modal is exercised in its own suite; here it stands in as a
// probe for "did the Submit-for-Approval click open the confirm step, rather
// than firing the submit straight away".
//
// `exceedsApprovalCap` comes from the real ./utils entry point — po-shared's
// `requiresApproval` delegates to it, so stubbing it would stub out the very
// decision under test. The subpath import keeps the package's components (and
// their icon imports) out of this suite.
vi.mock('@forethread/approval-shared', async () => {
  const { exceedsApprovalCap } = await vi.importActual<
    typeof import('@forethread/approval-shared/utils')
  >('@forethread/approval-shared/utils');
  return {
    exceedsApprovalCap,
    NominateApproversModal: ({
      onConfirm,
      onClose,
    }: {
      onConfirm?: (ids: string[]) => void;
      onClose: () => void;
    }) => (
      <div data-testid="nominate-modal">
        <button data-testid="nominate-everyone" onClick={() => onConfirm?.([])}>
          everyone
        </button>
        <button data-testid="nominate-two" onClick={() => onConfirm?.(['u1', 'u2'])}>
          two
        </button>
        <button data-testid="nominate-cancel" onClick={onClose}>
          cancel
        </button>
      </div>
    ),
  };
});

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
    <button data-testid="send-btn" data-loading={isLoading} onClick={onClick}>
      {children}
    </button>
  ),
  notificationService: { success: mockSuccess, error: mockError },
}));

vi.mock('../services/purchase-orders.service', () => ({
  useMe: mockUseMe,
  useIssuePurchaseOrder: () => ({ mutate: mockMutate, isPending: false }),
}));

import { PoSendButton } from './PoSendButton';

function makePo(overrides: Partial<PoDetail>): PoDetail {
  return {
    id: 'po-1',
    status: 'DRAFT',
    totalAmount: 1000,
    ...overrides,
  } as PoDetail;
}

describe('PoSendButton (FOR-210)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing for a non-DRAFT PO', () => {
    mockUseMe.mockReturnValue({ data: { poApprovalThreshold: null } });
    const { container } = render(<PoSendButton po={makePo({ status: 'SENT' })} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows "Send" when the user has unlimited authority (threshold null)', () => {
    mockUseMe.mockReturnValue({ data: { poApprovalThreshold: null } });
    render(<PoSendButton po={makePo({ totalAmount: 99999 })} />);
    expect(screen.getByText('send.send')).toBeInTheDocument();
  });

  it('shows "Send" when total is within the threshold', () => {
    mockUseMe.mockReturnValue({ data: { poApprovalThreshold: 5000 } });
    render(<PoSendButton po={makePo({ totalAmount: 1000 })} />);
    expect(screen.getByText('send.send')).toBeInTheDocument();
  });

  it('shows "Submit for Approval" when total exceeds the threshold', () => {
    mockUseMe.mockReturnValue({ data: { poApprovalThreshold: 500 } });
    render(<PoSendButton po={makePo({ totalAmount: 1000 })} />);
    expect(screen.getByText('send.submitForApproval')).toBeInTheDocument();
  });

  it('shows "Submit for Approval" when threshold is 0 and total is positive', () => {
    mockUseMe.mockReturnValue({ data: { poApprovalThreshold: 0 } });
    render(<PoSendButton po={makePo({ totalAmount: 1 })} />);
    expect(screen.getByText('send.submitForApproval')).toBeInTheDocument();
  });

  describe('direct send (no approval needed)', () => {
    it('calls the issue mutation on click, with no nominees', () => {
      mockUseMe.mockReturnValue({ data: { poApprovalThreshold: null } });
      render(<PoSendButton po={makePo({ id: 'po-9' })} />);
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(mockMutate).toHaveBeenCalledWith(
        { id: 'po-9', nomineeIds: undefined },
        expect.any(Object),
      );
    });

    it('never opens the nomination modal — there is no approver to choose', () => {
      mockUseMe.mockReturnValue({ data: { poApprovalThreshold: null } });
      render(<PoSendButton po={makePo({})} />);
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(screen.queryByTestId('nominate-modal')).not.toBeInTheDocument();
    });

    it('shows the sent toast on success', () => {
      mockUseMe.mockReturnValue({ data: { poApprovalThreshold: null } });
      mockMutate.mockImplementation((_vars, opts) => opts.onSuccess());
      render(<PoSendButton po={makePo({})} />);
      fireEvent.click(screen.getByTestId('send-btn'));
      expect(mockSuccess).toHaveBeenCalledWith('send.sent');
    });
  });

  describe('submit for approval (FOR-306)', () => {
    beforeEach(() => mockUseMe.mockReturnValue({ data: { poApprovalThreshold: 0 } }));

    it('opens the confirm modal instead of submitting straight away', () => {
      render(<PoSendButton po={makePo({ totalAmount: 100 })} />);
      fireEvent.click(screen.getByTestId('send-btn'));

      expect(screen.getByTestId('nominate-modal')).toBeInTheDocument();
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('submits with no nominees when the creator keeps "notify everyone"', () => {
      render(<PoSendButton po={makePo({ id: 'po-9', totalAmount: 100 })} />);
      fireEvent.click(screen.getByTestId('send-btn'));
      fireEvent.click(screen.getByTestId('nominate-everyone'));

      // An empty selection must reproduce the pre-nomination broadcast exactly.
      expect(mockMutate).toHaveBeenCalledWith({ id: 'po-9', nomineeIds: [] }, expect.any(Object));
    });

    it('forwards the chosen nominees', () => {
      render(<PoSendButton po={makePo({ id: 'po-9', totalAmount: 100 })} />);
      fireEvent.click(screen.getByTestId('send-btn'));
      fireEvent.click(screen.getByTestId('nominate-two'));

      expect(mockMutate).toHaveBeenCalledWith(
        { id: 'po-9', nomineeIds: ['u1', 'u2'] },
        expect.any(Object),
      );
    });

    it('submits nothing when the creator cancels', () => {
      render(<PoSendButton po={makePo({ totalAmount: 100 })} />);
      fireEvent.click(screen.getByTestId('send-btn'));
      fireEvent.click(screen.getByTestId('nominate-cancel'));

      expect(screen.queryByTestId('nominate-modal')).not.toBeInTheDocument();
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('shows the approval toast and closes the modal on success', () => {
      mockMutate.mockImplementation((_vars, opts) => opts.onSuccess());
      render(<PoSendButton po={makePo({ totalAmount: 100 })} />);
      fireEvent.click(screen.getByTestId('send-btn'));
      fireEvent.click(screen.getByTestId('nominate-everyone'));

      expect(mockSuccess).toHaveBeenCalledWith('send.submittedForApproval');
      expect(screen.queryByTestId('nominate-modal')).not.toBeInTheDocument();
    });

    it('keeps the modal open and reports the failure on error', () => {
      mockMutate.mockImplementation((_vars, opts) => opts.onError());
      render(<PoSendButton po={makePo({ totalAmount: 100 })} />);
      fireEvent.click(screen.getByTestId('send-btn'));
      fireEvent.click(screen.getByTestId('nominate-everyone'));

      // A rejected nominee comes back as an error; the creator needs the modal
      // still open to change their choice.
      expect(mockError).toHaveBeenCalledWith('send.failed');
      expect(screen.getByTestId('nominate-modal')).toBeInTheDocument();
    });
  });
});
