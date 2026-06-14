/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BulkOrderChangeRequest } from '@forethread/api-client';

const mockApprove = vi.hoisted(() => vi.fn());
const mockReject = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../services/bulk-orders.service', () => ({
  useApproveChange: () => ({ mutate: mockApprove, isPending: false }),
  useRejectChange: () => ({ mutate: mockReject, isPending: false }),
}));

vi.mock('@forethread/ui-components', () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  Button: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  formatDate: (d: string) => `formatted(${d})`,
  notificationService: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@forethread/ui-components/assets/icons/checkmark.svg?react', () => ({
  default: () => <span data-testid="check-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/clock-icon.svg?react', () => ({
  default: () => <span data-testid="clock-icon" />,
}));
vi.mock('@forethread/ui-components/assets/icons/cross.svg?react', () => ({
  default: () => <span data-testid="cross-icon" />,
}));

import { fireEvent, render, screen } from '@testing-library/react';

import { InlineExtensionReview } from './InlineExtensionReview';

function makeCr(overrides: Partial<BulkOrderChangeRequest> = {}): BulkOrderChangeRequest {
  return {
    id: 'cr-1',
    bulkOrderId: 'bo-1',
    requestedBy: { id: 'u-proposer', name: 'Sarah Chen' },
    changes: { endDate: '2025-03-01T00:00:00Z' },
    message: 'Lorem ipsum note',
    status: 'PENDING',
    reason: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockApprove.mockReset();
  mockReject.mockReset();
});

describe('InlineExtensionReview', () => {
  it('renders the banner, the proposed end date and the note', () => {
    render(<InlineExtensionReview bulkOrderId="bo-1" changeRequest={makeCr()} />);
    expect(screen.getByText('extension.review.banner')).toBeInTheDocument();
    expect(screen.getByText('formatted(2025-03-01T00:00:00Z)')).toBeInTheDocument();
    expect(screen.getByText('Lorem ipsum note')).toBeInTheDocument();
  });

  it('approves the change request when Submit is clicked', () => {
    render(<InlineExtensionReview bulkOrderId="bo-1" changeRequest={makeCr()} />);
    fireEvent.click(screen.getByText('extension.review.submit'));
    expect(mockApprove).toHaveBeenCalledTimes(1);
    expect(mockApprove.mock.calls[0][0]).toEqual({ bulkOrderId: 'bo-1', changeRequestId: 'cr-1' });
  });

  it('rejects the change request when Cancel is clicked', () => {
    render(<InlineExtensionReview bulkOrderId="bo-1" changeRequest={makeCr()} />);
    fireEvent.click(screen.getByText('extension.review.cancel'));
    expect(mockReject).toHaveBeenCalledTimes(1);
    expect(mockReject.mock.calls[0][0]).toEqual({ bulkOrderId: 'bo-1', changeRequestId: 'cr-1' });
  });
});
