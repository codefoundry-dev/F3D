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
  Input: (props: any) => <input {...props} />,
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

import { SendRfqDialog } from './SendRfqDialog';

const baseProps = {
  vendorCount: 3,
  isSending: false,
  isError: false,
  onCancel: vi.fn(),
  onSend: vi.fn(),
};

describe('SendRfqDialog', () => {
  it('pluralises the vendor count in the confirmation copy', () => {
    const { rerender } = render(<SendRfqDialog {...baseProps} vendorCount={3} />);
    expect(screen.getByText(/3 vendors will be emailed/i)).toBeInTheDocument();

    rerender(<SendRfqDialog {...baseProps} vendorCount={1} />);
    expect(screen.getByText(/1 vendor will be emailed/i)).toBeInTheDocument();
  });

  it('parses and trims CC addresses before sending', () => {
    const onSend = vi.fn();
    render(<SendRfqDialog {...baseProps} onSend={onSend} />);

    fireEvent.change(screen.getByTestId('send-rfq-cc'), {
      target: { value: '  a@x.com ,, b@y.com,  ' },
    });
    fireEvent.click(screen.getByTestId('confirm-send-rfq'));

    expect(onSend).toHaveBeenCalledWith(['a@x.com', 'b@y.com']);
  });

  it('sends an empty CC list when the field is blank', () => {
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
