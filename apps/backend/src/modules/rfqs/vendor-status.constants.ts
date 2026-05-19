import { VendorRfqStatus } from '@forethread/shared-types';
import { RfqStatus } from '@prisma/client';

/** Map backend RfqStatus → VendorRfqStatus (fallback when no quote response) */
export const VENDOR_STATUS_MAP: Record<string, VendorRfqStatus> = {
  [RfqStatus.OPEN]: VendorRfqStatus.INCOMING,
  [RfqStatus.AWAITING_RESPONSE]: VendorRfqStatus.INCOMING,
  [RfqStatus.QUOTED]: VendorRfqStatus.RESPONDED,
  [RfqStatus.AWARDED]: VendorRfqStatus.APPROVED,
  [RfqStatus.CANCELLED]: VendorRfqStatus.REJECTED,
  [RfqStatus.CLOSED]: VendorRfqStatus.CLOSED,
  [RfqStatus.DRAFT]: VendorRfqStatus.INCOMING,
};

/** Reverse: VendorRfqStatus → Prisma RfqStatus values (for filtering) */
export const VENDOR_STATUS_TO_RFQ: Record<string, RfqStatus[]> = {
  [VendorRfqStatus.INCOMING]: [RfqStatus.OPEN, RfqStatus.AWAITING_RESPONSE],
  [VendorRfqStatus.RESPONDED]: [RfqStatus.QUOTED, RfqStatus.AWAITING_RESPONSE],
  [VendorRfqStatus.APPROVED]: [RfqStatus.AWARDED],
  [VendorRfqStatus.REJECTED]: [RfqStatus.CANCELLED],
  [VendorRfqStatus.CLOSED]: [RfqStatus.CLOSED],
};
