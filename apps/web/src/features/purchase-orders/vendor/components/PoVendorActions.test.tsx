const mockMutateFns = vi.hoisted(() => ({
  acknowledge: vi.fn(),
  accept: vi.fn(),
}));

const mockMutationState = vi.hoisted(() => ({
  acknowledgePending: false,
  acceptPending: false,
}));

let mutationCallCount = 0;

vi.mock('@forethread/api-client', () => ({
  confirmPurchaseOrder: vi.fn(),
  acceptPurchaseOrder: vi.fn(),
  confirmPublicPurchaseOrder: vi.fn(),
  acceptPublicPurchaseOrder: vi.fn(),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div data-testid="alert">{children}</div>,
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
}));

vi.mock('@forethread/ui-components/assets/icons/clock-icon.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/eye-opened.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/mark-with-cyrcle.svg?react', () => ({
  default: () => <span />,
}));

vi.mock('./DeclinePoModal', () => ({
  DeclinePoModal: ({
    poId,
    token,
    onClose,
  }: {
    poId: string;
    token?: string;
    onClose: () => void;
  }) => (
    <div data-testid="decline-modal" data-po-id={poId} data-token={token ?? ''}>
      <button onClick={onClose}>close-modal</button>
    </div>
  ),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => {
    mutationCallCount++;
    // First call = acknowledge, second = accept
    const isAccept = mutationCallCount % 2 === 0;
    return {
      mutate: isAccept ? mockMutateFns.accept : mockMutateFns.acknowledge,
      isPending: isAccept ? mockMutationState.acceptPending : mockMutationState.acknowledgePending,
    };
  },
}));

import { render, screen, fireEvent } from '@testing-library/react';

import { PoVendorActions } from './PoVendorActions';

const makePo = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'po-1',
    poNumber: 'PO-001',
    projectName: 'Test',
    status: 'SENT',
    lineItems: [],
    documents: [],
    ...overrides,
  }) as never;

describe('PoVendorActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutationCallCount = 0;
    mockMutationState.acknowledgePending = false;
    mockMutationState.acceptPending = false;
  });

  it('returns null for non-actionable status', () => {
    const { container } = render(<PoVendorActions po={makePo({ status: 'ACCEPTED' })} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null for DECLINED status', () => {
    const { container } = render(<PoVendorActions po={makePo({ status: 'DECLINED' })} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders action buttons for SENT status', () => {
    render(<PoVendorActions po={makePo({ status: 'SENT' })} />);
    expect(screen.getByText('actions.acknowledge')).toBeInTheDocument();
    expect(screen.getByText('actions.approve')).toBeInTheDocument();
    expect(screen.getByText('actions.decline')).toBeInTheDocument();
  });

  it('renders action buttons for ACKNOWLEDGED status', () => {
    render(<PoVendorActions po={makePo({ status: 'ACKNOWLEDGED' })} />);
    expect(screen.getByText('actions.acknowledge')).toBeInTheDocument();
    expect(screen.getByText('actions.approve')).toBeInTheDocument();
  });

  it('renders alert info message', () => {
    render(<PoVendorActions po={makePo({ status: 'SENT' })} />);
    expect(screen.getByTestId('alert')).toHaveTextContent('actions.acknowledgeAlert');
  });

  it('acknowledge button is disabled when status is ACKNOWLEDGED', () => {
    render(<PoVendorActions po={makePo({ status: 'ACKNOWLEDGED' })} />);
    expect(screen.getByText('actions.acknowledge')).toBeDisabled();
  });

  it('approve button is disabled when status is SENT (not yet acknowledged)', () => {
    render(<PoVendorActions po={makePo({ status: 'SENT' })} />);
    expect(screen.getByText('actions.approve')).toBeDisabled();
  });

  it('approve button is enabled when status is ACKNOWLEDGED', () => {
    render(<PoVendorActions po={makePo({ status: 'ACKNOWLEDGED' })} />);
    expect(screen.getByText('actions.approve')).not.toBeDisabled();
  });

  it('calls acknowledge mutate on acknowledge click', () => {
    render(<PoVendorActions po={makePo({ status: 'SENT' })} />);
    fireEvent.click(screen.getByText('actions.acknowledge'));
    expect(mockMutateFns.acknowledge).toHaveBeenCalled();
  });

  it('calls accept mutate on approve click', () => {
    render(<PoVendorActions po={makePo({ status: 'ACKNOWLEDGED' })} />);
    fireEvent.click(screen.getByText('actions.approve'));
    expect(mockMutateFns.accept).toHaveBeenCalled();
  });

  it('shows DeclinePoModal when decline is clicked', () => {
    render(<PoVendorActions po={makePo({ status: 'SENT' })} />);
    expect(screen.queryByTestId('decline-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('actions.decline'));
    expect(screen.getByTestId('decline-modal')).toBeInTheDocument();
    expect(screen.getByTestId('decline-modal')).toHaveAttribute('data-po-id', 'po-1');
  });

  it('closes DeclinePoModal when onClose is called', () => {
    render(<PoVendorActions po={makePo({ status: 'SENT' })} />);
    fireEvent.click(screen.getByText('actions.decline'));
    expect(screen.getByTestId('decline-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('close-modal'));
    expect(screen.queryByTestId('decline-modal')).not.toBeInTheDocument();
  });

  it('applies compact layout when compact prop is true', () => {
    render(<PoVendorActions po={makePo({ status: 'SENT' })} compact />);
    expect(screen.getByText('actions.acknowledge')).toBeInTheDocument();
  });

  it('forwards the guest portal token to the decline modal (FOR-247)', () => {
    render(<PoVendorActions po={makePo({ status: 'SENT' })} token="po-token-123" />);
    fireEvent.click(screen.getByText('actions.decline'));
    expect(screen.getByTestId('decline-modal')).toHaveAttribute('data-token', 'po-token-123');
  });
});
