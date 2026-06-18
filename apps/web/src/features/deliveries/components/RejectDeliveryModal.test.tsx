import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOnConfirm = vi.hoisted(() => vi.fn());
const mockOnClose = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@forethread/ui-components', () => ({
  Modal: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  ModalIconHeader: ({ title, subtitle }: { title: ReactNode; subtitle: ReactNode }) => (
    <div>
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  ),
  Button: ({
    children,
    onClick,
    disabled,
    isLoading: _isLoading,
    variant: _variant,
    size: _size,
    ...props
  }: Record<string, unknown>) => (
    <button onClick={onClick as () => void} disabled={disabled as boolean} {...props}>
      {children as ReactNode}
    </button>
  ),
  Textarea: (props: Record<string, unknown>) => <textarea {...props} />,
}));
vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <svg />,
}));

import { RejectDeliveryModal } from './RejectDeliveryModal';

describe('RejectDeliveryModal', () => {
  beforeEach(() => vi.clearAllMocks());

  const setup = () =>
    render(<RejectDeliveryModal onClose={mockOnClose} onConfirm={mockOnConfirm} />);

  it('renders the title and PO-untouched copy', () => {
    setup();
    expect(screen.getByText('review.rejectTitle')).toBeInTheDocument();
    expect(screen.getByText('review.rejectDescription')).toBeInTheDocument();
  });

  it('disables confirm until a non-empty reason is entered', () => {
    setup();
    const confirm = screen.getByTestId('delivery-reject-confirm');
    expect(confirm).toBeDisabled();

    // Whitespace-only stays disabled.
    fireEvent.change(screen.getByTestId('delivery-reject-reason'), { target: { value: '   ' } });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByTestId('delivery-reject-reason'), {
      target: { value: 'Damaged on arrival' },
    });
    expect(confirm).not.toBeDisabled();
  });

  it('confirms with the trimmed reason', () => {
    setup();
    fireEvent.change(screen.getByTestId('delivery-reject-reason'), {
      target: { value: '  Wrong items  ' },
    });
    fireEvent.click(screen.getByTestId('delivery-reject-confirm'));
    expect(mockOnConfirm).toHaveBeenCalledWith('Wrong items');
  });

  it('cancel closes the modal', () => {
    setup();
    fireEvent.click(screen.getByText('review.cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
