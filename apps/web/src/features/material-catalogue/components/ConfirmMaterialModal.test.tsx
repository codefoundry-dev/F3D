import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmMaterialModal } from './ConfirmMaterialModal';

describe('ConfirmMaterialModal', () => {
  it('renders archive copy and calls onConfirm', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ConfirmMaterialModal action="archive" onConfirm={onConfirm} onClose={onClose} />);

    expect(screen.getByText('Archive Material')).toBeInTheDocument();
    expect(screen.getByText(/removed from active use/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-material-action'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders delete copy with a destructive confirm button', () => {
    render(<ConfirmMaterialModal action="delete" onConfirm={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText('Delete Material')).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    expect(screen.getByTestId('confirm-material-action')).toHaveTextContent('Delete material');
  });

  it('calls onClose from Cancel', () => {
    const onClose = vi.fn();
    render(<ConfirmMaterialModal action="restore" onConfirm={vi.fn()} onClose={onClose} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
