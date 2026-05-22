import { UserRole } from '@forethread/shared-types/client';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/features/auth/state/auth.store';

import { PermissionRoute } from './PermissionRoute';

function setUserWithPermissions(permissions: string[]) {
  useAuthStore.getState().setAuth({
    id: 'u1',
    name: 'Test',
    email: 't@example.com',
    role: UserRole.COMPANY_ADMIN,
    companyId: 'c1',
    permissions,
  });
}

function renderAt(path: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={element}>
          <Route path="/rfqs/new" element={<div>create-rfq</div>} />
        </Route>
        <Route path="/forbidden" element={<div>forbidden-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PermissionRoute', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('renders the child when the user holds every required permission', () => {
    setUserWithPermissions(['rfq.create', 'rfq.update']);
    renderAt('/rfqs/new', <PermissionRoute require={['rfq.create', 'rfq.update']} />);
    expect(screen.getByText('create-rfq')).toBeInTheDocument();
  });

  it('redirects to /forbidden when a required permission is missing in `all` mode', () => {
    setUserWithPermissions(['rfq.create']);
    renderAt('/rfqs/new', <PermissionRoute require={['rfq.create', 'rfq.update']} />);
    expect(screen.getByText('forbidden-page')).toBeInTheDocument();
  });

  it('allows access when any one permission matches in `any` mode', () => {
    setUserWithPermissions(['rfq.read']);
    renderAt('/rfqs/new', <PermissionRoute require={['rfq.create', 'rfq.read']} mode="any" />);
    expect(screen.getByText('create-rfq')).toBeInTheDocument();
  });

  it('redirects in `any` mode when no permission matches', () => {
    setUserWithPermissions(['po.approve']);
    renderAt('/rfqs/new', <PermissionRoute require={['rfq.create', 'rfq.read']} mode="any" />);
    expect(screen.getByText('forbidden-page')).toBeInTheDocument();
  });

  it('renders the child when `require` is empty (no extra check)', () => {
    setUserWithPermissions([]);
    renderAt('/rfqs/new', <PermissionRoute require={[]} />);
    expect(screen.getByText('create-rfq')).toBeInTheDocument();
  });

  it('redirects when the user has no permissions at all', () => {
    setUserWithPermissions([]);
    renderAt('/rfqs/new', <PermissionRoute require={['rfq.create']} />);
    expect(screen.getByText('forbidden-page')).toBeInTheDocument();
  });

  it('honors a custom fallback path', () => {
    setUserWithPermissions([]);
    render(
      <MemoryRouter initialEntries={['/rfqs/new']}>
        <Routes>
          <Route element={<PermissionRoute require={['rfq.create']} fallback="/" />}>
            <Route path="/rfqs/new" element={<div>create-rfq</div>} />
          </Route>
          <Route path="/" element={<div>home-page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('home-page')).toBeInTheDocument();
  });
});
