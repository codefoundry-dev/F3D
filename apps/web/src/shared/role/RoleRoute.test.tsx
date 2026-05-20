import { UserRole } from '@forethread/shared-types/client';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, beforeEach } from 'vitest';

import { useAuthStore } from '@/features/auth/state/auth.store';

import { RoleRoute } from './RoleRoute';

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
        <Route element={<RoleRoute allow={[UserRole.SUPER_ADMIN]} />}>
          <Route path="/admin" element={<div>admin-only</div>} />
        </Route>
        <Route path="/forbidden" element={<div>forbidden-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoleRoute', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('renders the child when the user role is in `allow`', () => {
    setUser(UserRole.SUPER_ADMIN);
    renderAt('/admin');
    expect(screen.getByText('admin-only')).toBeInTheDocument();
  });

  it('redirects to /forbidden when the role is not allowed', () => {
    setUser(UserRole.VENDOR);
    renderAt('/admin');
    expect(screen.getByText('forbidden-page')).toBeInTheDocument();
  });

  it('redirects when there is no user role at all', () => {
    setUser(null);
    renderAt('/admin');
    expect(screen.getByText('forbidden-page')).toBeInTheDocument();
  });
});
