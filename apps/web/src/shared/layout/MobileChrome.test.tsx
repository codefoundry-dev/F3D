import {
  CompactStepper,
  FloatingActionButton,
  MobileActionBarSlot,
  MobileHeaderActionsSlot,
  MobileListToolbar,
  PageActions,
  Sidebar,
  __resetMobileChrome,
  useHideMobileNav,
} from '@forethread/ui-components';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ADR-0019 B7–B9 (FOR-373..375): phone-only chrome driven by useIsPhone, so
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

describe('MobileListToolbar (B9)', () => {
  it('shows search, a Filters count and opens the filter sheet', () => {
    const onSearch = vi.fn();
    render(
      <MobileListToolbar
        search=""
        onSearchChange={onSearch}
        searchPlaceholder="Search RFQs"
        filters={<div>Advanced filters here</div>}
        activeFilterCount={2}
        quickFilters={<button type="button">Open</button>}
        menuActions={[{ key: 'export', label: 'Export CSV', onClick: vi.fn() }]}
      />,
    );
    fireEvent.change(screen.getByLabelText('Search RFQs'), { target: { value: 'pipe' } });
    expect(onSearch).toHaveBeenCalledWith('pipe');
    expect(screen.getByTestId('mobile-filter-count')).toHaveTextContent('2');
    expect(screen.getByTestId('mobile-quick-filters')).toContainElement(
      screen.getByRole('button', { name: 'Open' }),
    );

    expect(screen.queryByText('Advanced filters here')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filters (2)' }));
    expect(screen.getByText('Advanced filters here')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText('Advanced filters here')).not.toBeInTheDocument();
  });

  it('renders the floating Create button only on phones', () => {
    setPhone(false);
    const { unmount } = render(<FloatingActionButton label="Create new" onClick={() => {}} />);
    expect(screen.queryByTestId('mobile-fab')).not.toBeInTheDocument();
    unmount();

    setPhone(true);
    const onClick = vi.fn();
    render(<FloatingActionButton label="Create new" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create new' }));
    expect(onClick).toHaveBeenCalled();
  });
});
