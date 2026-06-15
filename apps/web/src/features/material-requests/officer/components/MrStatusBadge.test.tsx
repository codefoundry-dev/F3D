import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@forethread/ui-components', () => ({
  Badge: ({ children, className }: { children: ReactNode; className?: string }) => (
    <span data-classname={className}>{children}</span>
  ),
}));

import { MrPriorityBadge, MrStatusBadge } from './MrStatusBadge';

describe('MrStatusBadge / MrPriorityBadge', () => {
  it('renders the translated status label', () => {
    render(<MrStatusBadge status="APPROVED" />);
    expect(screen.getByText('status.APPROVED')).toBeInTheDocument();
  });

  it('applies a distinct tone per status', () => {
    const { rerender } = render(<MrStatusBadge status="DECLINED" />);
    const declined = screen.getByText('status.DECLINED').getAttribute('data-classname');
    rerender(<MrStatusBadge status="APPROVED" />);
    const approved = screen.getByText('status.APPROVED').getAttribute('data-classname');
    expect(declined).not.toBe(approved);
  });

  it('falls back to the DRAFT tone for an unknown status', () => {
    render(<MrStatusBadge status="WHATEVER" />);
    expect(screen.getByText('status.WHATEVER')).toBeInTheDocument();
  });

  it('renders the translated priority label', () => {
    render(<MrPriorityBadge priority="URGENT" />);
    expect(screen.getByText('priority.URGENT')).toBeInTheDocument();
  });
});
