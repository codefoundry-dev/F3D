// Dependency-free PO delivery types (no class-validator / @nestjs/swagger).
// Safe to ship to the browser via the client barrel.

/**
 * A header-level delivery row on a purchase order (FOR-210).
 * Returned as part of the PO detail response (`deliveries[]`).
 */
export interface PoDeliveryResponse {
  id: string;
  deliveryLocationId: string | null;
  /** Resolved label ?? address of the linked ProjectLocation, or null. */
  deliveryLocationName: string | null;
  /** ISO-8601 string, or null when no date was supplied. */
  deliveryDate: string | null;
  notes: string | null;
  /** Ordering index within the PO's delivery rows. */
  sequence: number;
}

/**
 * Request shape for a single delivery row when creating/updating a PO.
 * Mirrors `CreatePoDeliveryDto` without the class-validator decorators so it
 * can be consumed by the frontend. At least one of `deliveryLocationId` or
 * `deliveryDate` must be provided (enforced server-side).
 */
export interface PoDeliveryInput {
  deliveryLocationId?: string;
  /** ISO-8601 date string. */
  deliveryDate?: string;
  notes?: string;
}
