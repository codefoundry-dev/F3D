import {
  CheckRfqAvailabilityDto,
  ConfirmRfqCoverageDto,
  RfqAvailabilityMatchDto,
  RfqAvailabilityResponseDto,
} from '@forethread/shared-types';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BulkOrderStatus, RfqStatus, UserRole } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

import { RfqsService } from './rfqs.service';

/**
 * True when one of the two strings contains the other, case-insensitively.
 * Mirrors the PO validate-items matching approach (T756): a bulk-order line
 * "matches" a requested material when its description or item reference
 * overlaps the material name in either direction.
 */
function textOverlaps(haystack: string | null | undefined, needle: string): boolean {
  const hay = haystack?.trim().toLowerCase();
  if (!hay) return false;
  return hay.includes(needle) || needle.includes(hay);
}

/**
 * Bulk-order coverage for the RFQ creation flow (US 5.05).
 *
 * Before sending an RFQ, the buyer can check which prospective line items are
 * already covered by ACTIVE bulk orders ("availability check") and then commit
 * drawdowns against those bulk orders, shrinking or deleting the covered RFQ
 * line items ("confirm coverage").
 */
@Injectable()
export class RfqAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rfqsService: RfqsService,
  ) {}

  // ── POST /v1/rfqs/check-availability ──────────────────────────────────────

  async checkAvailability(
    dto: CheckRfqAvailabilityDto,
    user: AuthenticatedUser,
  ): Promise<RfqAvailabilityResponseDto> {
    const companyId = user.companyId;
    if (!companyId) throw new ForbiddenException(ERR.general.accessDenied);

    // Resolve catalog material ids to names for the matching pass.
    const materialIds = [
      ...new Set(
        dto.lineItems.map((li) => li.materialId).filter((id): id is string => Boolean(id)),
      ),
    ];
    const materials =
      materialIds.length > 0
        ? await this.prisma.material.findMany({
            where: { id: { in: materialIds } },
            select: { id: true, name: true },
          })
        : [];
    const materialNameById = new Map(materials.map((m) => [m.id, m.name]));

    // The company's ACTIVE, unexpired bulk orders with their lines + vendor.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const bulkOrders = await this.prisma.bulkOrder.findMany({
      where: {
        companyId,
        status: BulkOrderStatus.ACTIVE,
        OR: [{ endDate: null }, { endDate: { gte: startOfToday } }],
      },
      include: {
        vendor: { select: { id: true, legalName: true } },
        lineItems: true,
      },
    });

    // Candidate lines: anything with stock left to draw down.
    const candidates = bulkOrders.flatMap((bo) =>
      bo.lineItems
        .filter((li) => li.qtyRemaining > 0)
        .map((li) => ({ bulkOrder: bo, lineItem: li })),
    );

    const vendorNameById = new Map<string, string>();

    const items = dto.lineItems.map((reqLine) => {
      const resolvedName =
        (reqLine.materialId ? materialNameById.get(reqLine.materialId) : undefined) ??
        reqLine.materialName;
      const needle = resolvedName?.trim().toLowerCase();
      if (!needle) return { index: reqLine.index, matches: [] as RfqAvailabilityMatchDto[] };

      const matches = candidates
        .filter(
          ({ lineItem }) =>
            textOverlaps(lineItem.description, needle) ||
            textOverlaps(lineItem.itemReference, needle),
        )
        .map(({ bulkOrder, lineItem }) => {
          vendorNameById.set(bulkOrder.vendorId, bulkOrder.vendor.legalName);
          return {
            bulkOrderId: bulkOrder.id,
            bulkOrderNumber: bulkOrder.bulkOrderNumber,
            bulkOrderLineItemId: lineItem.id,
            vendorId: bulkOrder.vendorId,
            qtyRemaining: lineItem.qtyRemaining,
            expirationDate: bulkOrder.endDate?.toISOString() ?? null,
            pricePerUnit: Number(lineItem.pricePerUnit),
          };
        });

      return { index: reqLine.index, matches };
    });

    const vendors = [...vendorNameById.entries()]
      .map(([vendorId, vendorName]) => ({ vendorId, vendorName }))
      .sort((a, b) => a.vendorName.localeCompare(b.vendorName));

    return { vendors, items };
  }

  // ── POST /v1/rfqs/:id/confirm-coverage ─────────────────────────────────────

  async confirmCoverage(rfqId: string, dto: ConfirmRfqCoverageDto, user: AuthenticatedUser) {
    const companyId = user.companyId;
    if (!companyId) throw new ForbiddenException(ERR.general.accessDenied);

    // Company-scoped 404: another company's RFQ is indistinguishable from a
    // missing one (SUPER_ADMIN may reach any RFQ).
    const rfq = await this.prisma.rfq.findFirst({
      where: { id: rfqId, ...(user.role === UserRole.SUPER_ADMIN ? {} : { companyId }) },
      select: { id: true, status: true, companyId: true },
    });
    if (!rfq) throw new NotFoundException(ERR.rfqs.notFound);

    if (rfq.status !== RfqStatus.DRAFT) {
      throw new BadRequestException(ERR.rfqs.coverageOnlyDraft);
    }

    // ── Load + validate the referenced RFQ line items ───────────────────────
    const rfqLineItemIds = [...new Set(dto.allocations.map((a) => a.rfqLineItemId))];
    const rfqLines = await this.prisma.rfqLineItem.findMany({
      where: { id: { in: rfqLineItemIds }, rfqId },
      select: { id: true, quantity: true },
    });
    if (rfqLines.length !== rfqLineItemIds.length) {
      throw new NotFoundException(ERR.rfqs.lineItemNotFound);
    }
    const rfqLineById = new Map(rfqLines.map((li) => [li.id, li]));

    // ── Load + validate the referenced bulk-order lines (company-scoped) ────
    const bulkLineIds = [...new Set(dto.allocations.map((a) => a.bulkOrderLineItemId))];
    const bulkLines = await this.prisma.bulkOrderLineItem.findMany({
      where: {
        id: { in: bulkLineIds },
        bulkOrder: { companyId: rfq.companyId, status: BulkOrderStatus.ACTIVE },
      },
      select: { id: true, bulkOrderId: true, qty: true, ordered: true, qtyRemaining: true },
    });
    if (bulkLines.length !== bulkLineIds.length) {
      throw new NotFoundException(ERR.bulkOrders.lineItemNotFound);
    }
    const bulkLineById = new Map(bulkLines.map((li) => [li.id, li]));

    // ── Pre-validate cumulative quantities ──────────────────────────────────
    const allocatedPerBulkLine = new Map<string, number>();
    const coveredPerRfqLine = new Map<string, number>();
    for (const alloc of dto.allocations) {
      allocatedPerBulkLine.set(
        alloc.bulkOrderLineItemId,
        (allocatedPerBulkLine.get(alloc.bulkOrderLineItemId) ?? 0) + alloc.quantity,
      );
      coveredPerRfqLine.set(
        alloc.rfqLineItemId,
        (coveredPerRfqLine.get(alloc.rfqLineItemId) ?? 0) + alloc.quantity,
      );
    }
    for (const [bulkLineId, allocated] of allocatedPerBulkLine) {
      const line = bulkLineById.get(bulkLineId);
      if (!line || allocated > line.qtyRemaining) {
        throw new ConflictException(ERR.bulkOrders.insufficientQuantity);
      }
    }
    for (const [rfqLineId, covered] of coveredPerRfqLine) {
      const line = rfqLineById.get(rfqLineId);
      if (!line || covered > line.quantity) {
        throw new BadRequestException(ERR.rfqs.coverageExceedsLineQuantity);
      }
    }

    // ── Apply: drawdowns + decrements + line shrink/delete, atomically ──────
    const { drawdownsCreated, remainingLineItems } = await this.prisma.$transaction(async (tx) => {
      const remainingByBulkLine = new Map(bulkLines.map((li) => [li.id, li.qtyRemaining]));
      const orderedByBulkLine = new Map(bulkLines.map((li) => [li.id, li.ordered]));

      let created = 0;
      for (const alloc of dto.allocations) {
        // Both lookups are guaranteed by the validation pass above; the guard
        // keeps the loop type-safe without non-null assertions.
        const bulkLine = bulkLineById.get(alloc.bulkOrderLineItemId);
        if (!bulkLine) continue;
        const before = remainingByBulkLine.get(bulkLine.id) ?? 0;

        // No purchaseOrderId: this drawdown reserves stock for an RFQ being
        // assembled, not for an issued PO.
        await tx.drawdown.create({
          data: {
            bulkOrderId: bulkLine.bulkOrderId,
            lineItemId: bulkLine.id,
            quantity: alloc.quantity,
            qtyBeforeDrawdown: before,
            createdByUserId: user.id,
          },
        });

        const newRemaining = before - alloc.quantity;
        const newOrdered = (orderedByBulkLine.get(bulkLine.id) ?? 0) + alloc.quantity;
        const deliveriesPercent =
          bulkLine.qty > 0 ? Math.round((newOrdered / bulkLine.qty) * 100 * 100) / 100 : 0;
        await tx.bulkOrderLineItem.update({
          where: { id: bulkLine.id },
          data: { qtyRemaining: newRemaining, ordered: newOrdered, deliveriesPercent },
        });
        remainingByBulkLine.set(bulkLine.id, newRemaining);
        orderedByBulkLine.set(bulkLine.id, newOrdered);
        created += 1;
      }

      // Shrink (or delete) the covered RFQ line items.
      for (const [rfqLineId, covered] of coveredPerRfqLine) {
        const line = rfqLineById.get(rfqLineId);
        if (!line) continue;
        const remaining = line.quantity - covered;
        if (remaining <= 0) {
          await tx.rfqLineItem.delete({ where: { id: rfqLineId } });
        } else {
          await tx.rfqLineItem.update({
            where: { id: rfqLineId },
            data: { quantity: remaining },
          });
        }
      }

      // Recompute the RFQ's total requested quantity from what is left.
      const remainingLines = await tx.rfqLineItem.findMany({
        where: { rfqId },
        select: { quantity: true },
      });
      const totalRequestedQty = remainingLines.reduce((sum, li) => sum + li.quantity, 0);
      await tx.rfq.update({ where: { id: rfqId }, data: { totalRequestedQty } });

      return { drawdownsCreated: created, remainingLineItems: remainingLines.length };
    });

    const rfqDetail = await this.rfqsService.getRfq(rfqId, user);
    return { rfq: rfqDetail, drawdownsCreated, remainingLineItems };
  }
}
