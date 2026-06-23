const mockMutate = vi.hoisted(() => vi.fn());
const mockMutationState = vi.hoisted(() => ({ isPending: false }));
const mockQueryResult = vi.hoisted(() => ({
  value: {
    data: undefined as unknown[] | undefined,
    isLoading: false,
  },
}));

vi.mock('@forethread/api-client', () => ({
  proposePoChange: vi.fn(),
  listPoChangeRequests: vi.fn(),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Modal: ({ children }: { children: React.ReactNode }) => <div data-testid="modal">{children}</div>,
  ModalGridBackground: () => null,
  ModalIconHeader: ({
    title,
    subtitle,
    onClose,
  }: {
    title: string;
    subtitle: string;
    onClose: () => void;
    [k: string]: unknown;
  }) => (
    <div data-testid="modal-icon-header">
      <span>{title}</span>
      <span>{subtitle}</span>
      <button onClick={onClose} data-testid="header-close">
        X
      </button>
    </div>
  ),
  ModalBody: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="modal-body">{children}</div>
  ),
  ModalFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="modal-footer">{children}</div>
  ),
  Textarea: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (e: { target: { value: string } }) => void;
    placeholder?: string;
  }) => (
    <textarea
      data-testid="message-textarea"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  ),
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [k: string]: unknown;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Spinner: () => <div data-testid="spinner" />,
  Badge: ({
    children,
    className: _className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <span data-testid="badge">{children}</span>,
  formatDateTime: (d: string) => d,
  CHANGE_REQUEST_STATUS_COLORS: {
    PENDING: { dot: 'bg-yellow-500', badge: 'bg-yellow-100' },
    APPROVED: { dot: 'bg-green-500', badge: 'bg-green-100' },
    REJECTED: { dot: 'bg-red-500', badge: 'bg-red-100' },
  },
}));

vi.mock('@forethread/ui-components/assets/icons/clock.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit-without-line.svg?react', () => ({
  default: () => <span />,
}));

vi.mock('@forethread/po-shared', () => ({
  PoChangeDiff: () => <div data-testid="po-change-diff" />,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({
    mutate: mockMutate,
    isPending: mockMutationState.isPending,
  }),
  useQuery: () => mockQueryResult.value,
}));

import { render, screen, fireEvent } from '@testing-library/react';

import { ChangeRequestModal } from './ChangeRequestModal';

describe('ChangeRequestModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockMutationState.isPending = false;
    mockQueryResult.value = { data: undefined, isLoading: false };
  });

  it('renders modal with title and subtitle', () => {
    render(<ChangeRequestModal poId="po-1" onClose={onClose} />);
    expect(screen.getByText('changeRequest.title')).toBeInTheDocument();
    expect(screen.getByText('changeRequest.subtitle')).toBeInTheDocument();
  });

  it('renders new request tab by default', () => {
    render(<ChangeRequestModal poId="po-1" onClose={onClose} />);
    expect(screen.getByText('changeRequest.description')).toBeInTheDocument();
    expect(screen.getByTestId('message-textarea')).toBeInTheDocument();
  });

  it('renders cancel and submit buttons on new tab', () => {
    render(<ChangeRequestModal poId="po-1" onClose={onClose} />);
    expect(screen.getByText('changeRequest.cancel')).toBeInTheDocument();
    expect(screen.getByText('changeRequest.submit')).toBeInTheDocument();
  });

  it('submit button is disabled when message is empty', () => {
    render(<ChangeRequestModal poId="po-1" onClose={onClose} />);
    expect(screen.getByText('changeRequest.submit')).toBeDisabled();
  });

  it('submit button is enabled when message has content', () => {
    render(<ChangeRequestModal poId="po-1" onClose={onClose} />);
    fireEvent.change(screen.getByTestId('message-textarea'), {
      target: { value: 'Need price change' },
    });
    expect(screen.getByText('changeRequest.submit')).not.toBeDisabled();
  });

  it('calls mutate when submit is clicked with a message', () => {
    render(<ChangeRequestModal poId="po-1" onClose={onClose} />);
    fireEvent.change(screen.getByTestId('message-textarea'), {
      target: { value: 'Need price change' },
    });
    fireEvent.click(screen.getByText('changeRequest.submit'));
    expect(mockMutate).toHaveBeenCalled();
  });

  it('does not call mutate when message is only whitespace', () => {
    render(<ChangeRequestModal poId="po-1" onClose={onClose} />);
    fireEvent.change(screen.getByTestId('message-textarea'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByText('changeRequest.submit'));
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<ChangeRequestModal poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByText('changeRequest.cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose via header close button', () => {
    render(<ChangeRequestModal poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('header-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('switches to history tab', () => {
    render(<ChangeRequestModal poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByText('changeRequest.historyTab'));
    // New tab content should be hidden, no textarea visible
    expect(screen.queryByTestId('message-textarea')).not.toBeInTheDocument();
    // Footer should be hidden on history tab
    expect(screen.queryByTestId('modal-footer')).not.toBeInTheDocument();
  });

  it('shows empty history message when no change requests', () => {
    mockQueryResult.value = { data: [], isLoading: false };
    render(<ChangeRequestModal poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByText('changeRequest.historyTab'));
    expect(screen.getByText('changeRequest.noHistory')).toBeInTheDocument();
  });

  it('shows empty history when data is undefined', () => {
    mockQueryResult.value = { data: undefined, isLoading: false };
    render(<ChangeRequestModal poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByText('changeRequest.historyTab'));
    expect(screen.getByText('changeRequest.noHistory')).toBeInTheDocument();
  });

  it('shows spinner when loading history', () => {
    mockQueryResult.value = { data: undefined, isLoading: true };
    render(<ChangeRequestModal poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByText('changeRequest.historyTab'));
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders change request cards in history', () => {
    mockQueryResult.value = {
      data: [
        {
          id: 'cr-1',
          reference: 'CR-001',
          changeType: 'INTERNAL',
          changedFields: {},
          status: 'PENDING',
          message: 'Please change unit price',
          createdAt: '2026-01-01',
          requestedByName: 'John Doe',
          requestedByCompanyName: 'Buildco',
          resolvedByName: null,
          resolvedAt: null,
          reason: null,
        },
      ],
      isLoading: false,
    };
    render(<ChangeRequestModal poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByText('changeRequest.historyTab'));
    expect(screen.getByText('Please change unit price')).toBeInTheDocument();
    expect(screen.getByText('CR-001')).toBeInTheDocument();
    expect(screen.getByText('changeRequest.requestedBy')).toBeInTheDocument();
    expect(screen.getByTestId('badge')).toHaveTextContent('PENDING');
  });

  it('renders rejected change request with reason', () => {
    mockQueryResult.value = {
      data: [
        {
          id: 'cr-2',
          reference: 'CR-002',
          changeType: 'COMMERCIAL',
          changedFields: { fields: { paymentTermsDays: { from: 30, to: 10 } } },
          status: 'REJECTED',
          message: 'Change delivery date',
          reason: 'Not feasible',
          createdAt: '2026-01-02',
          requestedByName: 'Jane Smith',
          requestedByCompanyName: 'Buildco',
          resolvedByName: 'Admin User',
          resolvedAt: '2026-01-03',
        },
      ],
      isLoading: false,
    };
    render(<ChangeRequestModal poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByText('changeRequest.historyTab'));
    // The diff is delegated to PoChangeDiff (mocked); reason + resolver use i18n keys.
    expect(screen.getByTestId('po-change-diff')).toBeInTheDocument();
    expect(screen.getByText('changeRequest.reason')).toBeInTheDocument();
    expect(screen.getByText('changeRequest.resolvedBy')).toBeInTheDocument();
  });

  it('shows count badge on history tab when there are change requests', () => {
    mockQueryResult.value = {
      data: [
        {
          id: 'cr-1',
          status: 'PENDING',
          message: 'msg',
          createdAt: '2026-01-01',
          requestedBy: { name: 'A' },
          resolvedBy: null,
          resolvedAt: null,
          reason: null,
        },
        {
          id: 'cr-2',
          status: 'APPROVED',
          message: 'msg2',
          createdAt: '2026-01-02',
          requestedBy: { name: 'B' },
          resolvedBy: null,
          resolvedAt: null,
          reason: null,
        },
      ],
      isLoading: false,
    };
    render(<ChangeRequestModal poId="po-1" onClose={onClose} />);
    // The count badge "2" should appear next to the history tab
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('can switch back from history to new tab', () => {
    render(<ChangeRequestModal poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByText('changeRequest.historyTab'));
    expect(screen.queryByTestId('message-textarea')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('changeRequest.newTab'));
    expect(screen.getByTestId('message-textarea')).toBeInTheDocument();
  });
});
