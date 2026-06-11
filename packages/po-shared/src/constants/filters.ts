/** Quick filter keys for Procurement Officer & Company Admin */
export const PO_CA_QUICK_FILTERS = [
  'allOpen',
  'pendingIntApproval',
  'pendingExtApproval',
  'approvedByVendor',
  'partiallyDelivered',
  'closed',
  'dueSoon',
  'openRevision',
  'withUnreadMessages',
  'recentlyUpdated',
] as const;

/** Quick filter keys for Vendor (matches the US 3.08 PO Management design) */
export const VENDOR_QUICK_FILTERS = [
  'allOpen',
  'pendingIntApproval',
  'pendingExtApproval',
  'approvedByVendor',
  'partiallyDelivered',
  'closed',
  'dueSoon',
  'openRevision',
  'withUnreadMessages',
  'recentlyUpdated',
] as const;

/** Group options for Procurement Officer & Company Admin */
export const GROUP_OPTIONS = ['groupByProject', 'groupByStatus'] as const;

/** Vendor can group by project and status */
export const VENDOR_GROUP_OPTIONS = ['groupByProject', 'groupByStatus'] as const;

export const PAGE_SIZE_OPTIONS = [10, 25, 50];

export const PO_STATUS_KEYS = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SENT',
  'ACKNOWLEDGED',
  'ACCEPTED',
  'DECLINED',
  'SCHEDULED_FOR_DELIVERY',
  'PARTIALLY_DELIVERED',
  'DELIVERED',
  'LATE_FOR_DELIVERY',
  'INVOICED',
  'CLOSED',
  'CANCELLED',
  'CANCELLED_BY_VENDOR',
  'DISPUTE',
  'NOT_DELIVERED',
  'CHANGE_PENDING',
] as const;

export const PO_TYPE_KEYS = ['STANDARD', 'BULK', 'HOLD_FOR_RELEASE', 'DRAWDOWN', 'SPLIT'] as const;

/** Group-option key → PoListItem field for CA/Procurement Officer */
export const GROUP_FIELD_MAP: Record<string, keyof import('@forethread/api-client').PoListItem> = {
  groupByStatus: 'status',
  groupByProject: 'projectName',
};
