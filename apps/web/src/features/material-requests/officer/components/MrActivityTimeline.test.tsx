import type { MrAuditEntry } from '@forethread/api-client';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
  formatDateTime: (d: string) => d,
}));
vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/clock.svg?react', () => ({
  default: () => <svg />,
}));

import { MrActivityTimeline } from './MrActivityTimeline';

const entry = (overrides: Partial<MrAuditEntry>): MrAuditEntry => ({
  id: 'a1',
  action: 'MATERIAL_REQUEST_SUBMITTED',
  metadata: null,
  performedBy: { id: 'u1', name: 'Jane', email: 'j@x.com' },
  createdAt: '2026-06-15T10:00:00.000Z',
  ...overrides,
});

describe('MrActivityTimeline', () => {
  it('shows the spinner while loading', () => {
    render(<MrActivityTimeline entries={[]} isLoading />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows the empty state when there are no recognised entries', () => {
    render(<MrActivityTimeline entries={[]} />);
    expect(screen.getByText('detail.noActivity')).toBeInTheDocument();
  });

  it('renders humanized entries with performer', () => {
    render(<MrActivityTimeline entries={[entry({})]} />);
    expect(screen.getByTestId('mr-activity')).toBeInTheDocument();
    // i18n mock returns the key for the fallback path, so the label is the
    // auditActions key. Performer suffix is rendered too.
    expect(screen.getByText('auditActions.performedBy:{"name":"Jane"}')).toBeInTheDocument();
  });

  it('drops unrecognised actions', () => {
    render(<MrActivityTimeline entries={[entry({ id: 'x', action: 'NOPE' })]} />);
    expect(screen.getByText('detail.noActivity')).toBeInTheDocument();
  });
});
