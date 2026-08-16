import { getMe } from '@forethread/api-client';
import { useQuery } from '@tanstack/react-query';

/**
 * The current user's profile, including `poApprovalThreshold` and
 * `invoiceApprovalThreshold`, so approval surfaces can show an over-limit state
 * instead of dead-ending in a 403.
 *
 * Shares the `['me']` query key with the other feature-local `useMe` hooks, so
 * every caller reads one cached profile.
 */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => getMe(),
  });
}
