export const DEFAULT_STATUS_COLOR = 'bg-muted text-muted-foreground';

/** Neutral gray chip used for statuses on vendor-facing screens (design #E4E4E4 / #262626) */
export const NEUTRAL_STATUS_COLOR =
  'bg-[hsl(var(--badge-neutral))] text-[hsl(var(--badge-neutral-text))]';

export const RFQ_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  OPEN: 'bg-[hsl(var(--badge-blue))] text-[hsl(var(--badge-blue-text))]',
  AWAITING_RESPONSE: 'bg-[hsl(var(--badge-orange))] text-[hsl(var(--badge-orange-text))]',
  QUOTED: 'bg-[hsl(var(--badge-teal))] text-[hsl(var(--badge-teal-text))]',
  AWARDED: 'bg-success/10 text-success',
  CLOSED: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

export const VENDOR_RFQ_STATUS_COLORS: Record<string, string> = {
  INCOMING: 'bg-[hsl(var(--badge-blue))] text-[hsl(var(--badge-blue-text))]',
  RESPONDED: 'bg-[hsl(var(--badge-orange))] text-[hsl(var(--badge-orange-text))]',
  APPROVED: 'bg-success/10 text-success',
  REJECTED: 'bg-destructive/10 text-destructive',
  CLOSED: 'bg-muted text-muted-foreground',
};

export const PO_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PENDING_APPROVAL: 'bg-[hsl(var(--badge-orange))] text-[hsl(var(--badge-orange-text))]',
  APPROVED: 'bg-[hsl(var(--badge-teal))] text-[hsl(var(--badge-teal-text))]',
  SENT: 'bg-[hsl(var(--badge-blue))] text-[hsl(var(--badge-blue-text))]',
  ACKNOWLEDGED: 'bg-[hsl(var(--badge-teal))] text-[hsl(var(--badge-teal-text))]',
  ACCEPTED: 'bg-success/10 text-success',
  DECLINED: 'bg-destructive/10 text-destructive',
  SCHEDULED_FOR_DELIVERY: 'bg-[hsl(var(--badge-blue))] text-[hsl(var(--badge-blue-text))]',
  CANCELLED: 'bg-destructive/10 text-destructive',
  CLOSED: 'bg-muted text-muted-foreground',
  PARTIALLY_DELIVERED: 'bg-[hsl(var(--badge-orange))] text-[hsl(var(--badge-orange-text))]',
  DELIVERED: 'bg-success/10 text-success',
  LATE_FOR_DELIVERY: 'bg-destructive/10 text-destructive',
  CANCELLED_BY_VENDOR: 'bg-destructive/10 text-destructive',
  INVOICED: 'bg-[hsl(var(--badge-blue))] text-[hsl(var(--badge-blue-text))]',
  DISPUTE: 'bg-destructive/10 text-destructive',
  NOT_DELIVERED: 'bg-destructive/10 text-destructive',
  CHANGE_PENDING: 'bg-[hsl(var(--badge-orange))] text-[hsl(var(--badge-orange-text))]',
};

export const BULK_ORDER_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-success/10 text-success',
  EXPIRED: 'bg-destructive/10 text-destructive',
  COMPLETED: 'bg-[hsl(var(--badge-blue))] text-[hsl(var(--badge-blue-text))]',
  CANCELLED: 'bg-muted text-muted-foreground',
  CHANGE_PENDING: 'bg-[hsl(var(--badge-orange))] text-[hsl(var(--badge-orange-text))]',
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-[hsl(var(--badge-orange))] text-[hsl(var(--badge-orange-text))]',
  APPROVED: 'bg-success/10 text-success',
  DISPUTED: 'bg-destructive/10 text-destructive',
  PAID: 'bg-[hsl(var(--badge-blue))] text-[hsl(var(--badge-blue-text))]',
  REJECTED: 'bg-destructive/10 text-destructive',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PENDING: 'bg-[hsl(var(--badge-orange))] text-[hsl(var(--badge-orange-text))]',
  ACTIVE: 'bg-success/10 text-success',
  COMPLETED: 'bg-[hsl(var(--badge-blue))] text-[hsl(var(--badge-blue-text))]',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

export const CHANGE_REQUEST_STATUS_COLORS: Record<string, { badge: string; dot: string }> = {
  PENDING: {
    badge: 'bg-[hsl(var(--badge-orange))] text-[hsl(var(--badge-orange-text))]',
    dot: 'bg-[hsl(var(--badge-orange-text))]',
  },
  APPROVED: {
    badge: 'bg-success/10 text-success',
    dot: 'bg-success',
  },
  REJECTED: {
    badge: 'bg-destructive/10 text-destructive',
    dot: 'bg-destructive',
  },
};

export function getStatusColor(
  colorMap: Record<string, string>,
  status: string | null | undefined,
): string {
  if (!status) return DEFAULT_STATUS_COLOR;
  return colorMap[status] ?? colorMap[status.toUpperCase()] ?? DEFAULT_STATUS_COLOR;
}
