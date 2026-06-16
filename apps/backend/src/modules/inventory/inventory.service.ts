import { Injectable } from '@nestjs/common';
import {
  Prisma,
  StockMovement,
  StockMovementSource,
  StockMovementType,
  UserRole,
} from '@prisma/client';

import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

import { ListStockBalanceQueryDto, ListStockMovementQueryDto } from './inventory.dto';

/** Default page size for the movement ledger when the caller does not specify. */
const DEFAULT_MOVEMENT_LIMIT = 100;

/** Inputs for the push-in (PO receipt) hook. */
export interface ApplyInParams {
  companyId: string;
  materialId: string;
  locationId: string;
  /** Quantity to add — caller guarantees > 0. */
  quantity: number;
  /** Originating document type, e.g. 'PURCHASE_ORDER'. */
  sourceType: string;
  sourceId: string;
  sourceLineId?: string;
  createdById?: string;
  note?: string;
}

/** Inputs for the push-out (MR issue) hook. */
export interface IssueOutParams {
  companyId: string;
  materialId: string;
  locationId: string;
  /** Quantity the caller would like to issue; the actual issued amount is clamped at on-hand. */
  requestedQuantity: number;
  /** Originating document type, e.g. 'MATERIAL_REQUEST'. */
  sourceType: string;
  sourceId: string;
  sourceLineId?: string;
  createdById?: string;
  note?: string;
}

/** Prisma row shape produced by the balance+material+location read. */
type BalanceWithRelations = Prisma.StockBalanceGetPayload<{
  include: {
    material: { select: { id: true; name: true; uom: true } };
    location: { select: { id: true; label: true; address: true } };
  };
}>;

/** Prisma row shape produced by the movement+material+location read. */
type MovementWithRelations = Prisma.StockMovementGetPayload<{
  include: {
    material: { select: { id: true; name: true; uom: true } };
    location: { select: { id: true; label: true; address: true } };
  };
}>;

/**
 * Basic inventory movement engine (Epic 7). Maintains a running on-hand balance
 * per (material, location) and an append-only movement ledger.
 *
 * The mutation hooks (`applyIn` / `issueOut`) take a `Prisma.TransactionClient`
 * so callers run them inside their own `$transaction` alongside the PO/MR write
 * — the stock change and the document state change commit atomically together.
 * The read methods (`getBalances` / `listMovements`) are company-scoped exactly
 * like the MR service: SUPER_ADMIN sees everything, everyone else is scoped to
 * their own company.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Push-in: record received stock (PO receipt hook) ─────────────────────────

  /**
   * Add `quantity` to the (material, location) balance and append an IN movement
   * whose `balanceAfter` is the new on-hand. Upserts the balance row so the very
   * first receipt creates it. `quantity` must be > 0 (the caller guarantees this
   * — only positive deltas are pushed in).
   */
  async applyIn(tx: Prisma.TransactionClient, p: ApplyInParams): Promise<StockMovement> {
    const balance = await tx.stockBalance.upsert({
      where: { materialId_locationId: { materialId: p.materialId, locationId: p.locationId } },
      create: {
        companyId: p.companyId,
        materialId: p.materialId,
        locationId: p.locationId,
        onHand: p.quantity,
      },
      update: { onHand: { increment: p.quantity } },
      select: { onHand: true },
    });

    return tx.stockMovement.create({
      data: {
        companyId: p.companyId,
        materialId: p.materialId,
        locationId: p.locationId,
        type: StockMovementType.IN,
        source: StockMovementSource.PO_RECEIPT,
        quantity: p.quantity,
        balanceAfter: balance.onHand,
        sourceType: p.sourceType,
        sourceId: p.sourceId,
        sourceLineId: p.sourceLineId ?? null,
        note: p.note ?? null,
        createdById: p.createdById ?? null,
      },
    });
  }

  // ── Push-out: issue stock against demand (MR approval hook) ──────────────────

  /**
   * Issue up to `requestedQuantity` from the (material, location) balance,
   * clamping at the current on-hand: `issued = min(requested, onHand)`. When
   * nothing can be issued (no balance row, or on-hand ≤ 0) returns
   * `{ issued: 0, movement: null }` and writes NO ledger row. Otherwise decrements
   * the balance and appends an OUT movement. The balance is read inside the tx so
   * the read-modify-write is consistent under the surrounding transaction.
   */
  async issueOut(
    tx: Prisma.TransactionClient,
    p: IssueOutParams,
  ): Promise<{ issued: number; movement: StockMovement | null }> {
    const balance = await tx.stockBalance.findUnique({
      where: { materialId_locationId: { materialId: p.materialId, locationId: p.locationId } },
      select: { onHand: true },
    });

    const currentOnHand = balance?.onHand ?? 0;
    const issued = Math.min(p.requestedQuantity, currentOnHand);

    // Nothing in stock (or nothing requested): no movement, no balance change.
    if (issued <= 0) {
      return { issued: 0, movement: null };
    }

    const updated = await tx.stockBalance.update({
      where: { materialId_locationId: { materialId: p.materialId, locationId: p.locationId } },
      data: { onHand: { decrement: issued } },
      select: { onHand: true },
    });

    const movement = await tx.stockMovement.create({
      data: {
        companyId: p.companyId,
        materialId: p.materialId,
        locationId: p.locationId,
        type: StockMovementType.OUT,
        source: StockMovementSource.MR_ISSUE,
        quantity: issued,
        balanceAfter: updated.onHand,
        sourceType: p.sourceType,
        sourceId: p.sourceId,
        sourceLineId: p.sourceLineId ?? null,
        note: p.note ?? null,
        createdById: p.createdById ?? null,
      },
    });

    return { issued, movement };
  }

  // ── Read: on-hand balances ───────────────────────────────────────────────────

  /**
   * Company-scoped on-hand balances, joined with the material name/uom and the
   * location label. Zero/negative balances are INCLUDED — a 0 row means stock was
   * received then fully issued, which is meaningful. Ordered by material name then
   * location for a stable, readable list.
   */
  async getBalances(
    user: AuthenticatedUser,
    query: ListStockBalanceQueryDto,
  ): Promise<{ items: ReturnType<InventoryService['toBalanceDto']>[] }> {
    const where: Prisma.StockBalanceWhereInput = {};

    if (user.role !== UserRole.SUPER_ADMIN) {
      if (!user.companyId) return { items: [] };
      where.companyId = user.companyId;
    }

    if (query.materialId) where.materialId = query.materialId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.projectId) where.location = { projectId: query.projectId };

    const rows = await this.prisma.stockBalance.findMany({
      where,
      include: {
        material: { select: { id: true, name: true, uom: true } },
        location: { select: { id: true, label: true, address: true } },
      },
      orderBy: [{ material: { name: 'asc' } }, { locationId: 'asc' }],
    });

    return { items: rows.map((row) => this.toBalanceDto(row)) };
  }

  // ── Read: movement ledger ────────────────────────────────────────────────────

  /**
   * Company-scoped movement ledger, newest first, joined with the material and
   * location. Capped at `limit` (default 100). Filterable by project/location/
   * material, by the `source` enum, and by the originating `sourceType`.
   */
  async listMovements(
    user: AuthenticatedUser,
    query: ListStockMovementQueryDto,
  ): Promise<{ items: ReturnType<InventoryService['toMovementDto']>[] }> {
    const where: Prisma.StockMovementWhereInput = {};

    if (user.role !== UserRole.SUPER_ADMIN) {
      if (!user.companyId) return { items: [] };
      where.companyId = user.companyId;
    }

    if (query.materialId) where.materialId = query.materialId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.projectId) where.location = { projectId: query.projectId };
    if (query.source) where.source = query.source;
    if (query.sourceType) where.sourceType = query.sourceType;

    const rows = await this.prisma.stockMovement.findMany({
      where,
      include: {
        material: { select: { id: true, name: true, uom: true } },
        location: { select: { id: true, label: true, address: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? DEFAULT_MOVEMENT_LIMIT,
    });

    return { items: rows.map((row) => this.toMovementDto(row)) };
  }

  // ── Serialisers ──────────────────────────────────────────────────────────────

  private toBalanceDto(row: BalanceWithRelations) {
    return {
      id: row.id,
      materialId: row.materialId,
      materialName: row.material?.name ?? row.materialId,
      uom: row.material?.uom ?? '',
      locationId: row.locationId,
      locationName: row.location ? (row.location.label ?? row.location.address) : null,
      onHand: row.onHand,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toMovementDto(row: MovementWithRelations) {
    return {
      id: row.id,
      materialId: row.materialId,
      materialName: row.material?.name ?? row.materialId,
      uom: row.material?.uom ?? '',
      locationId: row.locationId,
      locationName: row.location ? (row.location.label ?? row.location.address) : null,
      type: row.type,
      source: row.source,
      quantity: row.quantity,
      balanceAfter: row.balanceAfter,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      sourceLineId: row.sourceLineId,
      note: row.note,
      createdById: row.createdById,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
