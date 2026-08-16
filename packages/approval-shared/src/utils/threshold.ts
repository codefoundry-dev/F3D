// Threshold arithmetic shared by the Purchase Order and Invoice approval paths.
//
// The current user's cap on a threshold-aware approval permission
// (`poApprovalThreshold` / `invoiceApprovalThreshold`, both from GET /users/me)
// decides whether an action they take needs a higher-tier approver:
//   - null   → unlimited authority
//   - 0      → no authority at all; any positive total needs approval
//   - number → the maximum total they may action themselves
//
// These helpers only drive button labels and disabled states so the user knows
// what will happen. The backend re-decides authoritatively on the action path
// via `ApprovalAuthorizationService.evaluate`.

import type { ApprovalEntityType } from '@forethread/api-client';

/**
 * True when this entity's Approver Pool is derived from monetary caps.
 *
 * Material requests are the exception (FOR-347): an MR carries no amount, so
 * its Pool is grant membership and every amount-flavoured copy string ("covers
 * this amount", "raise a limit") has a no-cap variant instead.
 */
export function hasMonetaryCap(entityType: ApprovalEntityType): boolean {
  return entityType !== 'MATERIAL_REQUEST';
}

/**
 * True when `total` is outside the cap, i.e. the actor cannot action it
 * themselves and it must go to the Approver Pool.
 *
 * @param threshold the actor's cap for the permission (null = unlimited)
 * @param total     the document total (null/undefined → 0)
 */
export function exceedsApprovalCap(
  threshold: number | null | undefined,
  total: number | null | undefined,
): boolean {
  // Unlimited authority — nothing ever exceeds it.
  if (threshold === null || threshold === undefined) return false;

  const amount = total ?? 0;

  // No positive amount can trip the gate.
  if (amount <= 0) return false;

  // threshold === 0 → any positive total exceeds it.
  // threshold > 0   → only totals strictly above it do (the cap is inclusive).
  return amount > threshold;
}
