/** Quick filter keys for Procurement Officer & Company Admin */
export const PO_CA_QUICK_FILTERS = [
  'myRfqs',
  'openRfqs',
  'awaitingResponses',
  'noQuotes',
  'awardedRfqs',
  'closedRfqs',
] as const;

/**
 * Quick filter keys for Vendor. Mirrors the US 2.06 "RFQ dashboard (Vendor)"
 * Figma (the 4-chip set shown in the grouped-status + advanced-filters frames,
 * which is the dominant variant): My RFQs / Open RFQs / Approved for a vendor /
 * Closed RFQs. `approvedForMe` is kept as the key (the backend already scopes
 * APPROVED quotes to the current vendor under that key) — only its label reads
 * "Approved for a vendor".
 */
export const VENDOR_QUICK_FILTERS = ['myRfqs', 'openRfqs', 'approvedForMe', 'closedRfqs'] as const;

export const GROUP_OPTIONS = ['groupByProject', 'groupByStatus', 'groupByVendor'] as const;

/** Vendor can only group by status */
export const VENDOR_GROUP_OPTIONS = ['groupByStatus'] as const;

export const PAGE_SIZE_OPTIONS = [25, 50, 100];

export const RFQ_STATUS_KEYS = [
  'DRAFT',
  'OPEN',
  'AWAITING_RESPONSE',
  'QUOTED',
  'AWARDED',
  'CLOSED',
  'CANCELLED',
] as const;

/** Vendor sees a different set of statuses */
export const VENDOR_RFQ_STATUS_KEYS = [
  'INCOMING',
  'RESPONDED',
  'APPROVED',
  'REJECTED',
  'CLOSED',
] as const;

/** Group-option key → RfqListItem field for CA/Procurement Officer */
export const GROUP_FIELD_MAP: Record<string, keyof import('@forethread/api-client').RfqListItem> = {
  groupByStatus: 'status',
  groupByProject: 'projectName',
  groupByVendor: 'createdBy',
};

/** Group-option key → RfqListItem field for Vendor */
export const VENDOR_GROUP_FIELD_MAP: Record<
  string,
  keyof import('@forethread/api-client').RfqListItem
> = {
  groupByStatus: 'status',
};
