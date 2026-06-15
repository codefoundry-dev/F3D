import { BadRequestException } from '@nestjs/common';
import { PoStatus } from '@prisma/client';

/**
 * Single source-of-truth Purchase Order state machine (Week-3 deliverable).
 *
 * Every status-mutating PO operation routes through {@link assertTransition}
 * before it persists, so an illegal status change is rejected uniformly with a
 * 400 instead of each method re-implementing its own `if (status !== X)` guard.
 *
 * The enum values themselves are the source of truth (FOR-231 lifecycle
 * decision) — this map does NOT rename them; it just records which edges are
 * legal. The edges below are derived from what the existing endpoints actually
 * do (po-status.service.ts), then extended to make the delivery/receipt leg
 * reachable.
 *
 * Week-3 target lifecycle → existing enum mapping (documentation only):
 *   Requested          → PENDING_APPROVAL
 *   Ordered            → SENT
 *   Confirmed          → ACKNOWLEDGED / ACCEPTED
 *   Shipped (in transit) ≈ SCHEDULED_FOR_DELIVERY
 *   Partially Shipped  → PARTIALLY_DELIVERED
 *   Delivered          → DELIVERED
 *
 * Pre-delivery states may be cancelled by the contractor (→ CANCELLED) or by
 * the vendor (→ CANCELLED_BY_VENDOR). Terminal states (CANCELLED, CLOSED,
 * CANCELLED_BY_VENDOR, DECLINED, NOT_DELIVERED) have no outgoing edges.
 */
export const PO_TRANSITIONS: Record<PoStatus, PoStatus[]> = {
  // DRAFT can be issued straight to the vendor, or held for internal approval,
  // or approved into the legacy ACKNOWLEDGED path. It can also be cancelled.
  [PoStatus.DRAFT]: [
    PoStatus.SENT,
    PoStatus.PENDING_APPROVAL,
    PoStatus.ACKNOWLEDGED,
    PoStatus.CANCELLED,
  ],

  // Held for internal approval: an approver completes the send (→ SENT), the
  // legacy approve path lands on ACKNOWLEDGED, or it is declined/cancelled.
  [PoStatus.PENDING_APPROVAL]: [
    PoStatus.SENT,
    PoStatus.APPROVED,
    PoStatus.ACKNOWLEDGED,
    PoStatus.CANCELLED,
  ],

  // APPROVED is an internal-approval resting state that still has to go out to
  // the vendor.
  [PoStatus.APPROVED]: [PoStatus.SENT, PoStatus.CANCELLED],

  // Sent to the vendor: they acknowledge it, or decline it; the contractor can
  // still cancel. Delivery can also be scheduled once it is out.
  [PoStatus.SENT]: [
    PoStatus.ACKNOWLEDGED,
    PoStatus.ACCEPTED,
    PoStatus.SCHEDULED_FOR_DELIVERY,
    PoStatus.CANCELLED,
    PoStatus.CANCELLED_BY_VENDOR,
  ],

  // Vendor acknowledged: may accept, schedule delivery, decline, or be cancelled.
  [PoStatus.ACKNOWLEDGED]: [
    PoStatus.ACCEPTED,
    PoStatus.SCHEDULED_FOR_DELIVERY,
    PoStatus.PARTIALLY_DELIVERED,
    PoStatus.DELIVERED,
    PoStatus.CANCELLED,
    PoStatus.CANCELLED_BY_VENDOR,
  ],

  // Vendor accepted: delivery proceeds (scheduled → partial → delivered).
  [PoStatus.ACCEPTED]: [
    PoStatus.SCHEDULED_FOR_DELIVERY,
    PoStatus.PARTIALLY_DELIVERED,
    PoStatus.DELIVERED,
    PoStatus.CANCELLED,
    PoStatus.CANCELLED_BY_VENDOR,
  ],

  // Scheduled for delivery: goods move; can land partial or full, slip late, or
  // fail to arrive.
  [PoStatus.SCHEDULED_FOR_DELIVERY]: [
    PoStatus.PARTIALLY_DELIVERED,
    PoStatus.DELIVERED,
    PoStatus.LATE_FOR_DELIVERY,
    PoStatus.NOT_DELIVERED,
    PoStatus.CANCELLED,
    PoStatus.CANCELLED_BY_VENDOR,
  ],

  // Partially delivered: remaining lines can complete the delivery, or it can
  // run late.
  [PoStatus.PARTIALLY_DELIVERED]: [
    PoStatus.PARTIALLY_DELIVERED,
    PoStatus.DELIVERED,
    PoStatus.LATE_FOR_DELIVERY,
  ],

  // Late: still recoverable to partial/full delivery, or it is never delivered.
  [PoStatus.LATE_FOR_DELIVERY]: [
    PoStatus.PARTIALLY_DELIVERED,
    PoStatus.DELIVERED,
    PoStatus.NOT_DELIVERED,
  ],

  // Delivered: close it out, invoice it, or raise a dispute.
  [PoStatus.DELIVERED]: [PoStatus.INVOICED, PoStatus.CLOSED, PoStatus.DISPUTE],

  // Invoiced: a payment cycle closes it, or a dispute is raised.
  [PoStatus.INVOICED]: [PoStatus.CLOSED, PoStatus.DISPUTE],

  // Dispute: resolves to closed once settled.
  [PoStatus.DISPUTE]: [PoStatus.CLOSED, PoStatus.INVOICED],

  // A revision in flight returns to the acknowledged/accepted line.
  [PoStatus.CHANGE_PENDING]: [PoStatus.ACKNOWLEDGED, PoStatus.ACCEPTED, PoStatus.CANCELLED],

  // ── Terminal states (no outgoing transitions) ──────────────────────────────
  [PoStatus.CLOSED]: [],
  [PoStatus.CANCELLED]: [],
  [PoStatus.CANCELLED_BY_VENDOR]: [],
  [PoStatus.DECLINED]: [],
  [PoStatus.NOT_DELIVERED]: [],
};

/** True when `from → to` is a legal Purchase Order status transition. */
export function canTransition(from: PoStatus, to: PoStatus): boolean {
  if (from === to) return false;
  return (PO_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * Guard a status change against the state machine. Throws a 400
 * {@link BadRequestException} naming the illegal `from → to` pair when the edge
 * is not allowed. The caller is expected to surface its own contextual message
 * for the common "wrong starting status" case (e.g. ERR.purchaseOrders.cannotX)
 * before reaching here; this is the central backstop that keeps the machine
 * authoritative.
 */
export function assertTransition(from: PoStatus, to: PoStatus): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException(`Illegal purchase order status transition: ${from} → ${to}`);
  }
}
