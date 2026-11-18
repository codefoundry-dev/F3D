import { PoStatus } from '@prisma/client';

/** Lifetime of a public QR delivery-submission link (DELIVERY_SUBMIT token). */
export const DELIVERY_LINK_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * PO statuses a delivery can be logged against — the only ones a delivery link
 * (and so the QR on the PO printout) is issued for.
 */
export const DELIVERABLE_PO_STATUSES: readonly PoStatus[] = [
  PoStatus.SENT,
  PoStatus.ACKNOWLEDGED,
  PoStatus.ACCEPTED,
  PoStatus.SCHEDULED_FOR_DELIVERY,
  PoStatus.PARTIALLY_DELIVERED,
  PoStatus.LATE_FOR_DELIVERY,
];
