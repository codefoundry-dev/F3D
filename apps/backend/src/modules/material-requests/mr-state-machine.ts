import { BadRequestException } from '@nestjs/common';
import { MaterialRequestStatus } from '@prisma/client';

/**
 * Single source-of-truth Material Request state machine (Epic 6), modelled on
 * the Purchase Order one (po-state-machine.ts).
 *
 * Every status-mutating MR operation routes through {@link assertTransition}
 * before it persists, so an illegal status change is rejected uniformly with a
 * 400 instead of each method re-implementing its own `if (status !== X)` guard.
 *
 * Lifecycle:
 *   DRAFT      → SUBMITTED | CANCELLED
 *   SUBMITTED  → APPROVED  | DECLINED  | CANCELLED
 *   APPROVED   → CONVERTED | CANCELLED
 *   CONVERTED / DECLINED / CANCELLED → (terminal, no outgoing edges)
 */
export const MR_TRANSITIONS: Record<MaterialRequestStatus, MaterialRequestStatus[]> = {
  [MaterialRequestStatus.DRAFT]: [MaterialRequestStatus.SUBMITTED, MaterialRequestStatus.CANCELLED],
  [MaterialRequestStatus.SUBMITTED]: [
    MaterialRequestStatus.APPROVED,
    MaterialRequestStatus.DECLINED,
    MaterialRequestStatus.CANCELLED,
  ],
  [MaterialRequestStatus.APPROVED]: [
    MaterialRequestStatus.CONVERTED,
    MaterialRequestStatus.CANCELLED,
  ],

  // ── Terminal states (no outgoing transitions) ───────────────────────────────
  [MaterialRequestStatus.CONVERTED]: [],
  [MaterialRequestStatus.DECLINED]: [],
  [MaterialRequestStatus.CANCELLED]: [],
};

/** True when `from → to` is a legal Material Request status transition. */
export function canTransition(from: MaterialRequestStatus, to: MaterialRequestStatus): boolean {
  if (from === to) return false;
  return (MR_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * Guard a status change against the state machine. Throws a 400
 * {@link BadRequestException} naming the illegal `from → to` pair when the edge
 * is not allowed. Callers may surface their own contextual message for the
 * common "wrong starting status" case before reaching here; this is the central
 * backstop that keeps the machine authoritative.
 */
export function assertTransition(from: MaterialRequestStatus, to: MaterialRequestStatus): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException(`Illegal material request status transition: ${from} → ${to}`);
  }
}
