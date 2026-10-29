import type { Prisma } from '@prisma/client';

/**
 * When a PO is expected to be delivered (FOR-356), shared by the Expected
 * Deliveries list, the daily scheduled/late job (FOR-396) and the overdue
 * reminders (FOR-394), so all three agree on what "overdue" means.
 *
 * The date is the first one set of: the PO's planned delivery date, its delivery
 * deadline, the earliest scheduled delivery row, the earliest line date.
 */

/** The PO fields {@link expectedDeliveryDateOf} reads. */
export const EXPECTED_DELIVERY_SELECT = {
  plannedDeliveryDate: true,
  deadlineEnd: true,
  deliveries: { select: { deliveryDate: true } },
  lineItems: { select: { expectedDeliveryDate: true } },
} as const satisfies Prisma.PurchaseOrderSelect;

export function expectedDeliveryDateOf(po: {
  plannedDeliveryDate: Date | null;
  deadlineEnd: Date | null;
  deliveries: { deliveryDate: Date | null }[];
  lineItems: { expectedDeliveryDate: Date | null }[];
}): Date | null {
  const earliest = (dates: (Date | null)[]) =>
    dates.reduce<Date | null>((acc, d) => (d && (!acc || d < acc) ? d : acc), null);
  return (
    po.plannedDeliveryDate ??
    po.deadlineEnd ??
    earliest(po.deliveries.map((d) => d.deliveryDate)) ??
    earliest(po.lineItems.map((li) => li.expectedDeliveryDate))
  );
}

/**
 * SQL form of `expectedDeliveryDateOf(po) < before`, one OR branch per coalesce
 * level (an earlier level being null is what admits the next). "Earliest date <
 * before" is equivalent to "some date < before", which keeps the schedule-row
 * and line-level branches expressible as `some`.
 */
export function expectedDeliveryBefore(before: Date): Prisma.PurchaseOrderWhereInput {
  const noScheduleDate = { deliveries: { none: { deliveryDate: { not: null } } } } as const;
  return {
    OR: [
      { plannedDeliveryDate: { lt: before } },
      { plannedDeliveryDate: null, deadlineEnd: { lt: before } },
      {
        plannedDeliveryDate: null,
        deadlineEnd: null,
        deliveries: { some: { deliveryDate: { lt: before } } },
      },
      {
        plannedDeliveryDate: null,
        deadlineEnd: null,
        ...noScheduleDate,
        lineItems: { some: { expectedDeliveryDate: { lt: before } } },
      },
    ],
  };
}

/** Local midnight today. A delivery expected today is not overdue until tomorrow. */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
