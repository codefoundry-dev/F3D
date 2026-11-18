import { UserRole } from '@forethread/shared-types/client';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/features/auth/state/auth.store';

import QuoteResponseDetailRoleSwitch from './QuoteResponseDetailRoleSwitch';

vi.mock('./buyer/pages/QuoteResponseDetailPage', () => ({
  default: () => <div>buyer-quote-page</div>,
}));

function setRole(role: UserRole) {
  useAuthStore.getState().setAuth({
    id: 'u1',
    name: 'Test',
    email: 't@example.com',
    role,
    companyId: 'c1',
  });
}

function VendorRfq() {
  const { pathname, hash } = useLocation();
  return <div>{`vendor-rfq ${pathname}${hash}`}</div>;
}

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={['/rfqs/rfq-5/quotes/quote-7']}>
      <Routes>
        <Route path="/rfqs/:id/quotes/:quoteId" element={<QuoteResponseDetailRoleSwitch />} />
        <Route path="/rfqs/:id" element={<VendorRfq />} />
        <Route path="/forbidden" element={<div>forbidden-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('QuoteResponseDetailRoleSwitch', () => {
  beforeEach(() => useAuthStore.getState().clearAuth());

  it('shows the quote review page to a buyer', async () => {
    setRole(UserRole.PROCUREMENT_OFFICER);
    renderRoute();
    expect(await screen.findByText('buyer-quote-page')).toBeInTheDocument();
  });

  // A "New message" notification deep-links here for both sides; the vendor
  // used to land on /forbidden and never saw the buyer's message.
  it("sends a vendor to their RFQ page's messages instead of /forbidden", async () => {
    setRole(UserRole.VENDOR);
    renderRoute();
    expect(await screen.findByText('vendor-rfq /rfqs/rfq-5#messages')).toBeInTheDocument();
    expect(screen.queryByText('forbidden-page')).not.toBeInTheDocument();
  });
});
