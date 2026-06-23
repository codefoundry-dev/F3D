import type { PoChangeRequest } from '@forethread/api-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApprove = vi.hoisted(() => vi.fn());
const mockReject = vi.hoisted(() => vi.fn());
const mockNotifySuccess = vi.hoisted(() => vi.fn());
const mockNotifyError = vi.hoisted(() => vi.fn());

vi.mock('@forethread/api-client', () => ({
  approvePoChange: mockApprove,
  rejectPoChange: mockReject,
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'defaultValue' in opts) return opts.defaultValue as string;
      if (opts && 'name' in opts) return `${key}:${String(opts.name)}`;
      return key;
    },
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({ children, onClick, isLoading }: any) => (
    <button onClick={onClick} disabled={isLoading}>
      {children}
    </button>
  ),
  GridModal: ({ icon, title, description, children, actions }: any) => (
    <div data-testid="modal">
      {icon}
      <div>{title}</div>
      <div>{description}</div>
      {children}
      {actions}
    </div>
  ),
  Spinner: () => <div data-testid="spinner" />,
  Textarea: (props: any) => <textarea {...props} />,
  formatDateTime: (v: string) => `dt(${v})`,
  notificationService: { success: mockNotifySuccess, error: mockNotifyError },
}));

vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/cross.svg?react', () => ({
  default: () => <span />,
}));

vi.mock('./PoChangeDiff', () => ({
  PoChangeDiff: () => <div data-testid="diff" />,
}));

import { PoChangeRequestTab } from './PoChangeRequestTab';

function makeCr(overrides: Partial<PoChangeRequest> = {}): PoChangeRequest {
  return {
    id: 'cr-1',
    purchaseOrderId: 'po-1',
    reference: 'CR-004',
    changeType: 'COMMERCIAL',
    changedFields: { fields: { paymentTermsDays: { from: 30, to: 10 } } },
    message: 'please review',
    status: 'PENDING',
    reason: null,
    requestedByName: 'Sarah Chen',
    requestedByCompanyName: 'Buildco',
    resolvedByName: null,
    resolvedAt: null,
    createdAt: '2024-12-12T12:00:00.000Z',
    ...overrides,
  };
}

function renderTab(props: Partial<Parameters<typeof PoChangeRequestTab>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PoChangeRequestTab poId="po-1" changeRequest={makeCr()} {...props} />
    </QueryClientProvider>,
  );
}

describe('PoChangeRequestTab', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the CR header (reference, requester) and diff', () => {
    renderTab();
    expect(screen.getByText('CR-004')).toBeInTheDocument();
    expect(screen.getByTestId('diff')).toBeInTheDocument();
    expect(screen.getByText('please review')).toBeInTheDocument();
  });

  it('shows Apply all / Reject when the viewer is not the proposer', () => {
    renderTab({ currentUserName: 'Other Person' });
    expect(screen.getByText('changeRequestTab.applyAll')).toBeInTheDocument();
    expect(screen.getByText('changeRequestTab.reject')).toBeInTheDocument();
  });

  it('hides Apply all / Reject when the viewer is the proposer (self-approve guard)', () => {
    renderTab({ currentUserName: 'Sarah Chen' });
    expect(screen.queryByText('changeRequestTab.applyAll')).not.toBeInTheDocument();
    expect(screen.queryByText('changeRequestTab.reject')).not.toBeInTheDocument();
  });

  it('calls approvePoChange on Apply all', async () => {
    mockApprove.mockResolvedValue(undefined);
    renderTab({ currentUserName: 'Other Person' });
    fireEvent.click(screen.getByText('changeRequestTab.applyAll'));
    await waitFor(() => expect(mockApprove).toHaveBeenCalledWith('po-1', 'cr-1'));
    expect(mockNotifySuccess).toHaveBeenCalledWith('changeRequestTab.applied');
  });

  it('opens the reject modal and calls rejectPoChange with the reason', async () => {
    mockReject.mockResolvedValue(undefined);
    renderTab({ currentUserName: 'Other Person' });
    fireEvent.click(screen.getByText('changeRequestTab.reject'));
    const textarea = screen.getByPlaceholderText('changeRequestTab.rejectReasonPlaceholder');
    fireEvent.change(textarea, { target: { value: 'price too high' } });
    fireEvent.click(screen.getByText('changeRequestTab.rejectConfirm'));
    await waitFor(() => expect(mockReject).toHaveBeenCalledWith('po-1', 'cr-1', 'price too high'));
    expect(mockNotifySuccess).toHaveBeenCalledWith('changeRequestTab.rejected');
  });
});
