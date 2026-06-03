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
  const actual = await vi.importActual<typeof import('@forethread/po-shared')>('@forethread/po-shared');
  return { requiresApproval: actual.requiresApproval };
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

  it('calls issue mutation on click', () => {
    mockUseMe.mockReturnValue({ data: { poApprovalThreshold: null } });
    render(<PoSendButton po={makePo({ id: 'po-9' })} />);
    fireEvent.click(screen.getByTestId('send-btn'));
    expect(mockMutate).toHaveBeenCalledWith('po-9', expect.any(Object));
  });

  it('shows the sent toast on success when no approval is required', () => {
    mockUseMe.mockReturnValue({ data: { poApprovalThreshold: null } });
    mockMutate.mockImplementation((_id, opts) => opts.onSuccess());
    render(<PoSendButton po={makePo({})} />);
    fireEvent.click(screen.getByTestId('send-btn'));
    expect(mockSuccess).toHaveBeenCalledWith('send.sent');
  });

  it('shows the approval toast on success when approval is required', () => {
    mockUseMe.mockReturnValue({ data: { poApprovalThreshold: 0 } });
    mockMutate.mockImplementation((_id, opts) => opts.onSuccess());
    render(<PoSendButton po={makePo({ totalAmount: 100 })} />);
    fireEvent.click(screen.getByTestId('send-btn'));
    expect(mockSuccess).toHaveBeenCalledWith('send.submittedForApproval');
  });
});
