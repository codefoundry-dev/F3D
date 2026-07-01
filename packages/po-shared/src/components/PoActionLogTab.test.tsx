import type { PoChangeRequest } from '@forethread/api-client';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'name' in opts) return `${key}:${String(opts.name)}`;
      if (opts && 'reason' in opts) return `${key}:${String(opts.reason)}`;
      return key;
    },
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
  Spinner: () => <div data-testid="spinner" />,
  formatDateTime: (v: string) => `dt(${v})`,
  formatAuditAction: (a: string) => (a === 'PO_ISSUED' ? 'PO issued' : a),
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/clock.svg?react', () => ({
  default: () => <span />,
}));

vi.mock('./PoChangeDiff', () => ({
  PoChangeDiff: () => <div data-testid="diff" />,
}));

import { PoActionLogTab } from './PoActionLogTab';

const log = {
  id: 'created',
  action: 'PO_ISSUED',
  description: 'Created by Sarah',
  performedBy: { id: 'u-1', name: 'Sarah' },
  createdAt: '2024-12-12T12:00:00.000Z',
};

function makeCr(overrides: Partial<PoChangeRequest> = {}): PoChangeRequest {
  return {
    id: 'cr-3',
    purchaseOrderId: 'po-1',
    reference: 'CR-003',
    changeType: 'COMMERCIAL',
    changedFields: { fields: { paymentTermsDays: { from: 30, to: 10 } } },
    message: null,
    status: 'APPROVED',
    reason: null,
    requestedByName: 'Sarah Chen',
    requestedByCompanyName: 'Company name',
    resolvedByName: 'Bob Vendor',
    resolvedAt: '2025-11-28T09:30:00.000Z',
    createdAt: '2024-12-12T12:00:00.000Z',
    ...overrides,
  };
}

describe('PoActionLogTab', () => {
  it('renders the empty state when there are no logs or change requests', () => {
    render(<PoActionLogTab logs={[]} changeRequests={[]} />);
    expect(screen.getByText('detailFields.noActivityLogs')).toBeInTheDocument();
  });

  it('renders a resolved CR with reference, Commercial badge, diff, and resolver', () => {
    render(<PoActionLogTab logs={[]} changeRequests={[makeCr()]} />);
    expect(screen.getByText('CR-003')).toBeInTheDocument();
    expect(screen.getByTestId('badge')).toHaveTextContent('actionLogCr.commercial');
    expect(screen.getByTestId('diff')).toBeInTheDocument();
    expect(screen.getByText('actionLogCr.approvedBy:Bob Vendor')).toBeInTheDocument();
  });

  it('renders an Internal badge for INTERNAL change type', () => {
    render(<PoActionLogTab logs={[]} changeRequests={[makeCr({ changeType: 'INTERNAL' })]} />);
    expect(screen.getByTestId('badge')).toHaveTextContent('actionLogCr.internal');
  });

  it('shows the rejection reason for a REJECTED CR', () => {
    render(
      <PoActionLogTab
        logs={[]}
        changeRequests={[makeCr({ status: 'REJECTED', reason: 'too costly' })]}
      />,
    );
    expect(screen.getByText('actionLogCr.rejectedBy:Bob Vendor')).toBeInTheDocument();
    expect(screen.getByText('changeRequest.reason:too costly')).toBeInTheDocument();
  });

  it('excludes PENDING change requests (they live in the Changes request tab)', () => {
    render(<PoActionLogTab logs={[]} changeRequests={[makeCr({ status: 'PENDING' })]} />);
    expect(screen.queryByText('CR-003')).not.toBeInTheDocument();
    expect(screen.getByText('detailFields.noActivityLogs')).toBeInTheDocument();
  });

  it('renders generic audit logs alongside resolved CRs', () => {
    render(<PoActionLogTab logs={[log]} changeRequests={[makeCr()]} />);
    expect(screen.getByText('CR-003')).toBeInTheDocument();
    expect(screen.getByText('PO issued')).toBeInTheDocument();
  });
});
