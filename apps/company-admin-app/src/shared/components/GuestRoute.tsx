import { GuestRoute as SharedGuestRoute } from '@forethread/ui-components';

import { useCheckAuth } from '@/features/auth/services/auth.service';
import { useAuthStore } from '@/features/auth/state/auth.store';

export function GuestRoute() {
  useCheckAuth();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isAuthLoading);

  return <SharedGuestRoute isAuthenticated={isAuthenticated} isAuthLoading={isAuthLoading} />;
}
