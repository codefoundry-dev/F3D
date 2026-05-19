import { UserRole } from '@forethread/shared-types';

import { useAuthStore } from '@/features/auth/state/auth.store';

export function useUserRole(): UserRole | null {
  return useAuthStore((s) => (s.currentUser?.role as UserRole | undefined) ?? null);
}
