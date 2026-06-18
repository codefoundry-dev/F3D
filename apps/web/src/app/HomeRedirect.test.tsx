import { UserRole } from '@forethread/shared-types/client';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/features/auth/state/auth.store';

import { HomeRedirect } from './HomeRedirect';

vi.mock('@/features/dashboard/DashboardRoleSwitch', () => ({
  DashboardRoleSwitch: () => <div>dashboard-role-switch</div>,
}));

function setUser(role: UserRole | null) {
  if (role === null) {
    useAuthStore.getState().clearAuth();
    return;
  }
  useAuthStore.getState().setAuth({
    id: 'u1',
    name: 'Test',
    email: 't@example.com',
    role,
    companyId: null,
  });
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/admin-panel" element={<div>admin-panel-page</div>} />
        <Route path="/invoices" element={<div>invoices-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HomeRedirect', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('renders the role-switched dashboard for SUPER_ADMIN (home is /)', () => {
    setUser(UserRole.SUPER_ADMIN);
    renderHome();
    expect(screen.getByText('dashboard-role-switch')).toBeInTheDocument();
  });

  it('renders the role-switched dashboard for FINANCIAL_OFFICER (home is /)', () => {
    setUser(UserRole.FINANCIAL_OFFICER);
    renderHome();
    expect(screen.getByText('dashboard-role-switch')).toBeInTheDocument();
  });

  it('renders the role-switched dashboard for COMPANY_ADMIN (home is /)', () => {
    setUser(UserRole.COMPANY_ADMIN);
    renderHome();
    expect(screen.getByText('dashboard-role-switch')).toBeInTheDocument();
  });

  it('renders the role-switched dashboard when there is no user yet', () => {
    setUser(null);
    renderHome();
    expect(screen.getByText('dashboard-role-switch')).toBeInTheDocument();
  });
});
