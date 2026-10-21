import {
  MobileActionBarSlot,
  MobileHeaderActionsSlot,
  PageActions,
  __resetMobileChrome,
} from '@forethread/ui-components';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ADR-0019 B7 (FOR-373): phone-only chrome driven by useIsPhone, so
// these tests flip window.matchMedia to a phone viewport.
const realMatchMedia = window.matchMedia;

function setPhone(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header>
        <MobileHeaderActionsSlot />
      </header>
      <main>
        {children}
        <MobileActionBarSlot />
      </main>
    </>
  );
}

beforeEach(() => __resetMobileChrome());
afterEach(() => {
  window.matchMedia = realMatchMedia;
});

describe('PageActions (B7)', () => {
  const secondary = [{ key: 'edit', label: 'Edit', onClick: vi.fn() }];

  it('renders every action inline on desktop', () => {
    setPhone(false);
    render(
      <Shell>
        <PageActions primary={<button type="button">Approve</button>} secondary={secondary} />
      </Shell>,
    );
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-action-bar')).not.toBeInTheDocument();
  });

  it('moves the main action into the footer bar and the rest into ⋯ on phones', () => {
    setPhone(true);
    render(
      <Shell>
        <PageActions
          primary={
            <>
              <button type="button">Reject</button>
              <button type="button">Approve</button>
            </>
          }
          secondary={secondary}
          moreLabel="More actions"
        />
      </Shell>,
    );
    const bar = screen.getByTestId('mobile-action-bar');
    expect(within(bar).getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    // The bar lives in the shell slot, not inline in the page.
    expect(screen.getByTestId('mobile-action-bar-slot')).toContainElement(bar);
    // Secondary actions are behind the top-bar ⋯ trigger, not buttons in the page.
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getByTestId('mobile-header-slot')).toContainElement(
      screen.getByRole('button', { name: 'More actions' }),
    );
  });
});
