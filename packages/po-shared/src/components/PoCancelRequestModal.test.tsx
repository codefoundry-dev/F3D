import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'poNumber' in opts) return `${key}:${String(opts.poNumber)}`;
      return key;
    },
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({ children, onClick, isLoading, disabled }: any) => (
    <button onClick={onClick} disabled={isLoading || disabled}>
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
  Textarea: (props: any) => <textarea {...props} />,
}));

vi.mock('@forethread/ui-components/assets/icons/cross.svg?react', () => ({
  default: () => <span />,
}));

import { PoCancelRequestModal } from './PoCancelRequestModal';

describe('PoCancelRequestModal (FOR-352)', () => {
  it('renders the PO number in the copy and submits the trimmed reason', () => {
    const onConfirm = vi.fn();
    render(<PoCancelRequestModal poNumber="PO-0042" onClose={vi.fn()} onConfirm={onConfirm} />);

    expect(screen.getByText('cancelRequest.description:PO-0042')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('cancelRequest.reasonPlaceholder'), {
      target: { value: '  Project descoped  ' },
    });
    fireEvent.click(screen.getByText('cancelRequest.confirm'));

    expect(onConfirm).toHaveBeenCalledWith('Project descoped');
  });

  it('closes without submitting via the back button', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<PoCancelRequestModal poNumber="PO-0042" onClose={onClose} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText('cancelRequest.back'));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('submits an empty reason when none is entered', () => {
    const onConfirm = vi.fn();
    render(<PoCancelRequestModal poNumber="PO-0042" onClose={vi.fn()} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText('cancelRequest.confirm'));
    expect(onConfirm).toHaveBeenCalledWith('');
  });
});
