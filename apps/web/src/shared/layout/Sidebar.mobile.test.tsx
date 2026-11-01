import { UserRole } from '@forethread/shared-types/client';
import { Sidebar, splitMobileNav, type SidebarNavItem } from '@forethread/ui-components';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ROUTES } from '@/app/route-config';

import { getMobilePrimaryHrefs } from './sidebarConfig';

// FOR-369: phone bottom bar = up to 4 labelled sections + "More".
const item = (href: string, extra: Partial<SidebarNavItem> = {}): SidebarNavItem => ({
  icon: null,
  label: href.slice(1),
  href,
  isActive: false,
  ...extra,
});

const BUYER_ITEMS = [
  ROUTES.projects,
  ROUTES.materialRequests,
  ROUTES.rfqs,
  ROUTES.purchaseOrders,
  ROUTES.bulkOrders,
  ROUTES.deliveries,
  ROUTES.invoices,
  ROUTES.vendors,
  ROUTES.materialCatalogue,
  ROUTES.settings,
].map((h) => item(h));

describe('splitMobileNav', () => {
  it('shows every item when the role has 4 or fewer', () => {
    const items = [item('/a'), item('/b')];
    expect(splitMobileNav(items, ['/b'])).toEqual({ bar: items, more: [] });
  });

  it('puts the configured primaries in the bar, in order, and the rest in More', () => {
    const { bar, more } = splitMobileNav(
      BUYER_ITEMS,
      getMobilePrimaryHrefs(UserRole.PROCUREMENT_OFFICER),
    );
    expect(bar.map((i) => i.href)).toEqual([
      ROUTES.rfqs,
      ROUTES.purchaseOrders,
      ROUTES.invoices,
      ROUTES.projects,
    ]);
    expect(more).toHaveLength(6);
    expect(more.map((i) => i.href)).not.toContain(ROUTES.rfqs);
  });

  it('falls back to the first 4 items when a role has no primaries configured', () => {
    const { bar, more } = splitMobileNav(BUYER_ITEMS, []);
    expect(bar).toEqual(BUYER_ITEMS.slice(0, 4));
    expect(more).toHaveLength(6);
  });
});

describe('Sidebar phone bar', () => {
  it('uses short labels and opens More with the remaining sections + extras', () => {
    const onNavigate = vi.fn();
    const items = BUYER_ITEMS.map((i) =>
      i.href === ROUTES.rfqs ? { ...i, label: 'RFQ Management', shortLabel: 'RFQs' } : i,
    );
    render(
      <Sidebar
        items={items}
        onNavigate={onNavigate}
        mobilePrimaryHrefs={getMobilePrimaryHrefs(UserRole.COMPANY_ADMIN)}
        moreExtras={<button type="button">My profile</button>}
      />,
    );
    const bar = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(bar).getByText('RFQs')).toBeInTheDocument();
    expect(within(bar).getAllByRole('button')).toHaveLength(5);

    fireEvent.click(within(bar).getByText('More'));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('vendors')).toBeInTheDocument();
    expect(within(sheet).getByText('My profile')).toBeInTheDocument();

    fireEvent.click(within(sheet).getByText('vendors'));
    expect(onNavigate).toHaveBeenCalledWith(ROUTES.vendors);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('marks More active when the current page lives in it', () => {
    const items = BUYER_ITEMS.map((i) =>
      i.href === ROUTES.vendors ? { ...i, isActive: true } : i,
    );
    render(
      <Sidebar
        items={items}
        onNavigate={() => {}}
        mobilePrimaryHrefs={getMobilePrimaryHrefs(UserRole.COMPANY_ADMIN)}
      />,
    );
    const bar = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(bar).getByText('More').closest('button')).toHaveAttribute('aria-current', 'page');
  });

  it('has no More tab for a role with 4 or fewer sections', () => {
    render(<Sidebar items={[item('/invoices'), item('/deliveries')]} onNavigate={() => {}} />);
    const bar = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(bar).queryByText('More')).not.toBeInTheDocument();
    expect(within(bar).getAllByRole('button')).toHaveLength(2);
  });
});
