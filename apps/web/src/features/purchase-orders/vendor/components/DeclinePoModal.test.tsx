const mockMutate = vi.hoisted(() => vi.fn());
const mockMutationState = vi.hoisted(() => ({ isPending: false }));

vi.mock('@forethread/api-client', () => ({
  vendorDeclinePurchaseOrder: vi.fn(),
  declinePublicPurchaseOrder: vi.fn(),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  Modal: ({ children, onClose: _onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <div data-testid="modal">{children}</div>
  ),
  ModalHeader: ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <div data-testid="modal-header">
      {children}
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
      data-testid="reason-textarea"
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
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({
    mutate: mockMutate,
    isPending: mockMutationState.isPending,
  }),
}));

import { render, screen, fireEvent } from '@testing-library/react';

import { DeclinePoModal } from './DeclinePoModal';

describe('DeclinePoModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockMutationState.isPending = false;
  });

  it('renders modal with title and description', () => {
    render(<DeclinePoModal poId="po-1" onClose={onClose} />);
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('decline.title')).toBeInTheDocument();
    expect(screen.getByText('decline.description')).toBeInTheDocument();
  });

  it('renders textarea for reason input', () => {
    render(<DeclinePoModal poId="po-1" onClose={onClose} />);
    expect(screen.getByTestId('reason-textarea')).toBeInTheDocument();
  });

  it('renders cancel and confirm buttons', () => {
    render(<DeclinePoModal poId="po-1" onClose={onClose} />);
    expect(screen.getByText('decline.cancel')).toBeInTheDocument();
    expect(screen.getByText('decline.confirm')).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    render(<DeclinePoModal poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByText('decline.cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('updates reason text on input change', () => {
    render(<DeclinePoModal poId="po-1" onClose={onClose} />);
    const textarea = screen.getByTestId('reason-textarea');
    fireEvent.change(textarea, { target: { value: 'Price too high' } });
    expect(textarea).toHaveValue('Price too high');
  });

  it('calls mutate when confirm is clicked', () => {
    render(<DeclinePoModal poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByText('decline.confirm'));
    expect(mockMutate).toHaveBeenCalled();
  });

  it('calls onClose via header close button', () => {
    render(<DeclinePoModal poId="po-1" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('header-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
