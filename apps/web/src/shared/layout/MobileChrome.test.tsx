import {
  CompactStepper,
  MobileActionBarSlot,
  MobileHeaderActionsSlot,
  PageActions,
  Sidebar,
  __resetMobileChrome,
  useHideMobileNav,
} from '@forethread/ui-components';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ADR-0019 B7–B8 (FOR-373/374): phone-only chrome driven by useIsPhone, so
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

describe('useHideMobileNav (B8)', () => {
  function Wizard() {
    useHideMobileNav();
    return null;
  }

  it('hides the phone bottom nav while a wizard is mounted', () => {
    setPhone(true);
    const items = [{ icon: <span />, label: 'RFQs', href: '/rfqs', isActive: true }];
    const { rerender } = render(<Sidebar items={items} onNavigate={() => {}} />);
    const nav = () => screen.getByRole('navigation', { name: 'Primary', hidden: true });
    expect(nav()).toHaveClass('flex');

    rerender(
      <>
        <Sidebar items={items} onNavigate={() => {}} />
        <Wizard />
      </>,
    );
    expect(nav()).toHaveClass('hidden');

    act(() => rerender(<Sidebar items={items} onNavigate={() => {}} />));
    expect(nav()).toHaveClass('flex');
  });
});

describe('CompactStepper (B8)', () => {
  it('reads "Step n of N · label" with a progress bar', () => {
    render(<CompactStepper current={2} total={3} label="Add line items" />);
    expect(screen.getByTestId('compact-stepper')).toHaveTextContent('Step 2 of 3 · Add line items');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  });
});
