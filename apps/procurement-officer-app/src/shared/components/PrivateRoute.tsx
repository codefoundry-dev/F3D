import { PrivateRoute as SharedPrivateRoute } from '@forethread/ui-components';

import { useCheckAuth } from '@/features/auth/services/auth.service';
import { useAuthStore } from '@/features/auth/state/auth.store';

export function PrivateRoute() {
  useCheckAuth();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isAuthLoading);

  return <SharedPrivateRoute isAuthenticated={isAuthenticated} isAuthLoading={isAuthLoading} />;
}
