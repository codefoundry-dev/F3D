import { UserRole } from '@forethread/shared-types/client';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/features/auth/state/auth.store';

import { usePermissions } from './usePermissions';

function setUserWithPermissions(permissions: string[] | undefined) {
  useAuthStore.getState().setAuth({
    id: 'u1',
    name: 'Test',
    email: 't@example.com',
    role: UserRole.COMPANY_ADMIN,
    companyId: 'c1',
    permissions,
  });
}

describe('usePermissions', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('returns an empty set when there is no signed-in user', () => {
    const { result } = renderHook(() => usePermissions());
    expect(result.current.permissions.size).toBe(0);
    expect(result.current.has('rfq.create')).toBe(false);
  });

  it('exposes the permission set granted to the current user', () => {
    setUserWithPermissions(['rfq.create', 'po.approve']);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.has('rfq.create')).toBe(true);
    expect(result.current.has('po.approve')).toBe(true);
    expect(result.current.has('invoice.export')).toBe(false);
  });

  it('hasAll only matches when every key is present', () => {
    setUserWithPermissions(['rfq.create', 'po.approve']);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.hasAll(['rfq.create', 'po.approve'])).toBe(true);
    expect(result.current.hasAll(['rfq.create', 'invoice.export'])).toBe(false);
  });

  it('hasAny matches when at least one key is present', () => {
    setUserWithPermissions(['rfq.create']);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.hasAny(['rfq.create', 'invoice.export'])).toBe(true);
    expect(result.current.hasAny(['po.approve', 'invoice.export'])).toBe(false);
  });

  it('treats a user without permissions field as having none', () => {
    setUserWithPermissions(undefined);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.permissions.size).toBe(0);
    expect(result.current.has('rfq.create')).toBe(false);
  });
});
