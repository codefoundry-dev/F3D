// Dependency-free inventory response types (no class-validator / @nestjs/swagger).
// Safe to ship to the browser via the client barrel.

import type { StockMovementSource, StockMovementType } from '../enums/index';

/**
 * A single running on-hand balance: the current quantity of one material at one
 * project location (Epic 7). Returned by `GET /inventory/balances`. A zero
 * `onHand` row is meaningful (stock was received then fully issued) and is
 * therefore included in the list.
 */
export interface StockBalanceDto {
  id: string;
  materialId: string;
  /** Resolved catalogue material name (falls back to the id when unresolved). */
  materialName: string;
  /** Unit of measure of the material (e.g. pcs, m, kg). */
  uom: string;
  locationId: string;
  /** Resolved label ?? address of the project location, or null. */
  locationName: string | null;
  onHand: number;
  /** ISO-8601 timestamp of the last movement that touched this balance. */
  updatedAt: string;
}

/**
 * A single immutable inventory ledger row (Epic 7). Returned by
 * `GET /inventory/movements`, newest first. `quantity` is always positive;
 * `type` carries the direction and `balanceAfter` is the on-hand left after the
 * movement was applied.
 */
export interface StockMovementDto {
  id: string;
  materialId: string;
  materialName: string;
  uom: string;
  locationId: string;
  locationName: string | null;
  type: StockMovementType;
  source: StockMovementSource;
  quantity: number;
  balanceAfter: number;
  /** Originating document type, e.g. 'PURCHASE_ORDER' | 'MATERIAL_REQUEST'. */
  sourceType: string | null;
  sourceId: string | null;
  sourceLineId: string | null;
  note: string | null;
  createdById: string | null;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}
