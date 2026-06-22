import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOnConfirm = vi.hoisted(() => vi.fn());
const mockOnClose = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
vi.mock('@forethread/ui-components', () => ({
  GridModal: ({ icon, title, description, children, actions, onSubmit }: any) =>
    onSubmit ? (
      <form data-testid="modal" onSubmit={onSubmit}>
        {icon}
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
        {actions}
      </form>
    ) : (
      <div data-testid="modal">
        {icon}
        <h2>{title}</h2>
        <p>{description}</p>
        {children}
        {actions}
      </div>
    ),
  Modal: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  ModalHeader: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  ModalBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ModalFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    onClick,
    disabled,
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

import { DeclineReasonModal } from './DeclineReasonModal';

describe('DeclineReasonModal', () => {
  beforeEach(() => vi.clearAllMocks());

  const setup = () =>
    render(<DeclineReasonModal mrNumber="MR-1" onClose={mockOnClose} onConfirm={mockOnConfirm} />);

  it('disables confirm until a non-empty reason is entered', () => {
    setup();
    const confirm = screen.getByTestId('mr-decline-confirm');
    expect(confirm).toBeDisabled();

    // Whitespace-only still disabled.
    fireEvent.change(screen.getByTestId('mr-decline-reason'), { target: { value: '   ' } });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByTestId('mr-decline-reason'), { target: { value: 'No budget' } });
    expect(confirm).not.toBeDisabled();
  });

  it('confirms with the trimmed reason', () => {
    setup();
    fireEvent.change(screen.getByTestId('mr-decline-reason'), {
      target: { value: '  No budget  ' },
    });
    fireEvent.click(screen.getByTestId('mr-decline-confirm'));
    expect(mockOnConfirm).toHaveBeenCalledWith('No budget');
  });

  it('cancel closes the modal', () => {
    setup();
    fireEvent.click(screen.getByText('declineModal.cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
