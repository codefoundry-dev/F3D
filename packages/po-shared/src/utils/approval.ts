// FOR-210: approval-gating decision logic for sending a PO.
//
// The current user's `poApprovalThreshold` (from GET /users/me) decides whether
// issuing a DRAFT PO will send it directly or route it for approval:
//   - null   → unlimited approval authority (can always send directly)
//   - 0      → no self-approval authority (any positive total requires approval)
//   - number → the max PO total the user may send without approval
//
// The backend makes the authoritative decision on POST /:id/issue; this helper
// only drives the button label/UX so the user knows what will happen.

/**
 * Returns true when issuing a PO with the given total will require approval for
 * the current user (i.e. the Send button should read "Submit for Approval").
 *
 * @param threshold the user's `poApprovalThreshold` (null = unlimited)
 * @param total     the PO's total amount in PO currency (null/undefined → 0)
 */
export function requiresApproval(
  threshold: number | null | undefined,
  total: number | null | undefined,
): boolean {
  // Unlimited authority — never requires approval.
  if (threshold === null || threshold === undefined) return false;

  const amount = total ?? 0;

  // No positive amount can never trip the gate.
  if (amount <= 0) return false;

  // threshold === 0 → any positive total requires approval.
  // threshold > 0   → only totals strictly above the threshold require approval.
  return amount > threshold;
}
