import { useMemo } from 'react';

import { useAuthStore } from '@/features/auth/state/auth.store';

export interface PermissionChecks {
  permissions: ReadonlySet<string>;
  has: (key: string) => boolean;
  hasAll: (keys: readonly string[]) => boolean;
  hasAny: (keys: readonly string[]) => boolean;
}

/**
 * Read the current user's permission grants from the auth store. Mirrors the
 * backend's `PermissionsService.getPermissionsForRole` output that is now
 * embedded on the GET /users/me response.
 *
 * Frontend permission gates are UX-only — the backend `PermissionsGuard` is
 * still the security boundary.
 */
export function usePermissions(): PermissionChecks {
  const permissions = useAuthStore((s) => s.currentUser?.permissions);

  return useMemo(() => {
    const set: ReadonlySet<string> = new Set(permissions ?? []);
    return {
      permissions: set,
      has: (key) => set.has(key),
      hasAll: (keys) => keys.every((k) => set.has(k)),
      hasAny: (keys) => keys.some((k) => set.has(k)),
    };
  }, [permissions]);
}
