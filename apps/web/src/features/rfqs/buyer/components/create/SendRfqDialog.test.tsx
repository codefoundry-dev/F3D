import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/ui-components', () => ({
  GridModal: ({
    title,
    description,
    children,
    actions,
  }: {
    title: React.ReactNode;
    description?: React.ReactNode;
    children?: React.ReactNode;
    actions?: React.ReactNode;
    icon?: React.ReactNode;
    onClose?: () => void;
  }) => (
    <div role="dialog">
      <span>{title}</span>
      <span>{description}</span>
      {children}
      {actions}
    </div>
  ),
  Alert: ({ children }: any) => <div role="alert">{children}</div>,
  Button: (props: any) => (
    <button
      type="button"
      disabled={props.disabled ?? props.isLoading}
      onClick={props.onClick}
      data-testid={props['data-testid']}
    >
      {props.children}
    </button>
  ),
}));

vi.mock('@forethread/ui-components/assets/icons/paper-plane.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/checkmark.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/chevron-down.svg?react', () => ({
  default: () => <span />,
}));

const mockUseRfqCcCandidates = vi.hoisted(() => vi.fn());
vi.mock('../../services/rfqs.service', () => ({
  useRfqCcCandidates: mockUseRfqCcCandidates,
}));

import { SendRfqDialog } from './SendRfqDialog';

const baseProps = {
  vendorCount: 3,
  isSending: false,
  isError: false,
  onCancel: vi.fn(),
  onSend: vi.fn(),
};

const candidates = [
  { id: 'u-1', name: 'Ama Mensah', email: 'ama@acme.com' },
  { id: 'u-2', name: 'Kofi Boateng', email: 'kofi@acme.com' },
  { id: 'u-3', name: 'Yaa Owusu', email: 'yaa@acme.com' },
];

describe('SendRfqDialog', () => {
  beforeEach(() => {
    mockUseRfqCcCandidates.mockReturnValue({ data: candidates, isLoading: false });
  });

  it('pluralises the vendor count in the confirmation copy', () => {
    const { rerender } = render(<SendRfqDialog {...baseProps} vendorCount={3} />);
    expect(screen.getByText(/3 vendors will be emailed/i)).toBeInTheDocument();

    rerender(<SendRfqDialog {...baseProps} vendorCount={1} />);
    expect(screen.getByText(/1 vendor will be emailed/i)).toBeInTheDocument();
  });

  it('sends the emails of the colleagues picked from the dropdown', () => {
    const onSend = vi.fn();
    render(<SendRfqDialog {...baseProps} onSend={onSend} />);

    fireEvent.click(screen.getByTestId('send-rfq-cc'));
    fireEvent.click(screen.getByTestId('send-rfq-cc-option-u-1'));
    fireEvent.click(screen.getByTestId('send-rfq-cc-option-u-3'));
    // The panel stays open while picking, and the trigger names who is selected.
    expect(screen.getByTestId('send-rfq-cc')).toHaveTextContent('Ama Mensah, Yaa Owusu');

    fireEvent.click(screen.getByTestId('confirm-send-rfq'));

    expect(onSend).toHaveBeenCalledWith(['ama@acme.com', 'yaa@acme.com']);
  });

  it('unpicks a colleague when their row is clicked again', () => {
    const onSend = vi.fn();
    render(<SendRfqDialog {...baseProps} onSend={onSend} />);

    fireEvent.click(screen.getByTestId('send-rfq-cc'));
    fireEvent.click(screen.getByTestId('send-rfq-cc-option-u-1'));
    fireEvent.click(screen.getByTestId('send-rfq-cc-option-u-2'));
    fireEvent.click(screen.getByTestId('send-rfq-cc-option-u-1'));
    fireEvent.click(screen.getByTestId('confirm-send-rfq'));

    expect(onSend).toHaveBeenCalledWith(['kofi@acme.com']);
  });

  it('filters the list by name or email', () => {
    render(<SendRfqDialog {...baseProps} />);

    fireEvent.click(screen.getByTestId('send-rfq-cc'));
    fireEvent.change(screen.getByLabelText('Search people'), { target: { value: 'kofi@' } });

    expect(screen.getByTestId('send-rfq-cc-option-u-2')).toBeInTheDocument();
    expect(screen.queryByTestId('send-rfq-cc-option-u-1')).not.toBeInTheDocument();
  });

  it('summarises with a count once more than two colleagues are picked', () => {
    render(<SendRfqDialog {...baseProps} />);

    fireEvent.click(screen.getByTestId('send-rfq-cc'));
    for (const id of ['u-1', 'u-2', 'u-3']) {
      fireEvent.click(screen.getByTestId(`send-rfq-cc-option-${id}`));
    }

    expect(screen.getByTestId('send-rfq-cc')).toHaveTextContent('3 people selected');
  });

  it('sends an empty CC list when nobody is picked', () => {
    const onSend = vi.fn();
    render(<SendRfqDialog {...baseProps} onSend={onSend} />);

    fireEvent.click(screen.getByTestId('confirm-send-rfq'));

    expect(onSend).toHaveBeenCalledWith([]);
  });

  it('shows the error alert when isError is set', () => {
    render(<SendRfqDialog {...baseProps} isError />);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn’t send this RFQ/i);
  });

  it('disables the confirm button while sending', () => {
    render(<SendRfqDialog {...baseProps} isSending />);
    expect(screen.getByTestId('confirm-send-rfq')).toBeDisabled();
  });
});
