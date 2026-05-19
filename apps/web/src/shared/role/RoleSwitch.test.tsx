import { UserRole } from '@forethread/shared-types';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, beforeEach } from 'vitest';

import { useAuthStore } from '@/features/auth/state/auth.store';

import { RoleSwitch } from './RoleSwitch';

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

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/rfqs/:id"
          element={
            <RoleSwitch
              byRole={{
                [UserRole.VENDOR]: <div>vendor-rfq</div>,
                [UserRole.COMPANY_ADMIN]: <div>company-admin-rfq</div>,
              }}
            />
          }
        />
        <Route path="/forbidden" element={<div>forbidden-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoleSwitch', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('renders the vendor element for VENDOR', () => {
    setUser(UserRole.VENDOR);
    renderAt('/rfqs/1');
    expect(screen.getByText('vendor-rfq')).toBeInTheDocument();
  });

  it('renders the company-admin element for COMPANY_ADMIN', () => {
    setUser(UserRole.COMPANY_ADMIN);
    renderAt('/rfqs/1');
    expect(screen.getByText('company-admin-rfq')).toBeInTheDocument();
  });

  it('redirects to /forbidden when the role has no mapping', () => {
    setUser(UserRole.FINANCIAL_OFFICER);
    renderAt('/rfqs/1');
    expect(screen.getByText('forbidden-page')).toBeInTheDocument();
  });
});
