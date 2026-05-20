import type { UserResponse } from '@forethread/api-client';
import { renderHook } from '@testing-library/react';

import { useGroupedUsers } from './useGroupedUsers';

function makeUser(overrides: Partial<UserResponse> & { id: string }): UserResponse {
  return {
    email: `${overrides.id}@test.com`,
    name: overrides.id,
    position: null,
    phone: null,
    workStatus: null,
    department: null,
    avatarUrl: null,
    role: 'COMPANY_ADMIN' as unknown as UserResponse['role'],
    status: 'ACTIVE' as unknown as UserResponse['status'],
    companyId: overrides.company?.id ?? '',
    lastLoginAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    company: null,
    ...overrides,
  };
}

describe('useGroupedUsers', () => {
  it('returns an empty array for undefined input', () => {
    const { result } = renderHook(() => useGroupedUsers(undefined));
    expect(result.current).toEqual([]);
  });

  it('returns an empty array for an empty array input', () => {
    const { result } = renderHook(() => useGroupedUsers([]));
    expect(result.current).toEqual([]);
  });

  it('groups users by company', () => {
    const users = [
      makeUser({
        id: 'u1',
        company: { id: 'c1', legalName: 'Alpha Corp', type: 'CONTRACTOR' },
      }),
      makeUser({
        id: 'u2',
        company: { id: 'c2', legalName: 'Beta Inc', type: 'VENDOR' },
      }),
    ];

    const { result } = renderHook(() => useGroupedUsers(users));

    expect(result.current).toHaveLength(2);
    expect(result.current[0].companyId).toBe('c1');
    expect(result.current[0].users).toHaveLength(1);
    expect(result.current[1].companyId).toBe('c2');
    expect(result.current[1].users).toHaveLength(1);
  });

  it('sorts groups alphabetically by company name', () => {
    const users = [
      makeUser({
        id: 'u1',
        company: { id: 'c2', legalName: 'Zebra LLC', type: 'CONTRACTOR' },
      }),
      makeUser({
        id: 'u2',
        company: { id: 'c1', legalName: 'Alpha Corp', type: 'VENDOR' },
      }),
    ];

    const { result } = renderHook(() => useGroupedUsers(users));

    expect(result.current[0].companyName).toBe('Alpha Corp');
    expect(result.current[1].companyName).toBe('Zebra LLC');
  });

  it('places unassigned users (no company) last', () => {
    const users = [
      makeUser({ id: 'u1', company: null }),
      makeUser({
        id: 'u2',
        company: { id: 'c1', legalName: 'Alpha Corp', type: 'CONTRACTOR' },
      }),
    ];

    const { result } = renderHook(() => useGroupedUsers(users));

    expect(result.current).toHaveLength(2);
    expect(result.current[0].companyName).toBe('Alpha Corp');
    expect(result.current[1].companyId).toBe('__unassigned__');
    expect(result.current[1].companyName).toBe('Unassigned');
  });

  it('groups multiple users in the same company together', () => {
    const users = [
      makeUser({
        id: 'u1',
        company: { id: 'c1', legalName: 'Alpha Corp', type: 'CONTRACTOR' },
      }),
      makeUser({
        id: 'u2',
        company: { id: 'c1', legalName: 'Alpha Corp', type: 'CONTRACTOR' },
      }),
      makeUser({
        id: 'u3',
        company: { id: 'c1', legalName: 'Alpha Corp', type: 'CONTRACTOR' },
      }),
    ];

    const { result } = renderHook(() => useGroupedUsers(users));

    expect(result.current).toHaveLength(1);
    expect(result.current[0].companyId).toBe('c1');
    expect(result.current[0].users).toHaveLength(3);
    expect(result.current[0].users.map((u) => u.id)).toEqual(['u1', 'u2', 'u3']);
  });

  it('includes companies with no users when allCompanies is provided', () => {
    const users = [
      makeUser({
        id: 'u1',
        company: { id: 'c1', legalName: 'Alpha Corp', type: 'CONTRACTOR' },
      }),
    ];
    const allCompanies = [
      { id: 'c1', legalName: 'Alpha Corp' },
      { id: 'c2', legalName: 'Beta Inc' },
    ];

    const { result } = renderHook(() => useGroupedUsers(users, allCompanies));

    expect(result.current).toHaveLength(2);
    expect(result.current[0].companyId).toBe('c1');
    expect(result.current[0].users).toHaveLength(1);
    expect(result.current[1].companyId).toBe('c2');
    expect(result.current[1].users).toHaveLength(0);
  });

  it('shows all companies even when users list is empty', () => {
    const allCompanies = [
      { id: 'c1', legalName: 'Alpha Corp' },
      { id: 'c2', legalName: 'Beta Inc' },
    ];

    const { result } = renderHook(() => useGroupedUsers([], allCompanies));

    expect(result.current).toHaveLength(2);
    expect(result.current[0].users).toHaveLength(0);
    expect(result.current[1].users).toHaveLength(0);
  });

  it('works without allCompanies parameter (backwards compatible)', () => {
    const users = [
      makeUser({
        id: 'u1',
        company: { id: 'c1', legalName: 'Alpha Corp', type: 'CONTRACTOR' },
      }),
    ];

    const { result } = renderHook(() => useGroupedUsers(users));

    expect(result.current).toHaveLength(1);
    expect(result.current[0].companyId).toBe('c1');
  });
});
