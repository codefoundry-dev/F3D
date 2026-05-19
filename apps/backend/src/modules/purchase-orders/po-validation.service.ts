import { ValidatePoItemsDto } from '@forethread/shared-types';
import { Injectable } from '@nestjs/common';
import { Prisma, QuoteResponseStatus } from '@prisma/client';

import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PoValidationService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Validate PO Line Items ──────────────────────────────────────────────

  async validateItems(dto: ValidatePoItemsDto, user: AuthenticatedUser) {
    const materialIds = dto.lineItems
      .map((li) => li.materialId)
      .filter((id): id is string => Boolean(id));
    const materialNames = dto.lineItems
      .map((li) => li.materialName)
      .filter((name): name is string => Boolean(name));

    // ── Check approved RFQ quotes ──────────────────────────────────────────
    const rfqWhere: Prisma.RfqLineItemWhereInput = {
      rfq: {
        companyId: user.companyId ?? '',
        quoteResponses: {
          some: { status: QuoteResponseStatus.APPROVED },
        },
      },
      OR: [
        ...(materialIds.length > 0 ? [{ materialId: { in: materialIds } }] : []),
        ...(materialNames.length > 0
          ? [
              {
                material: {
                  name: {
                    in: materialNames,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              },
            ]
          : []),
      ],
    };

    // Only query if we have something to match
    const rfqMatches =
      materialIds.length > 0 || materialNames.length > 0
        ? await this.prisma.rfqLineItem.findMany({
            where: rfqWhere,
            include: {
              material: { select: { id: true, name: true } },
              rfq: {
                select: {
                  id: true,
                  rfqNumber: true,
                  quoteResponses: {
                    where: { status: QuoteResponseStatus.APPROVED },
                    select: {
                      id: true,
                      vendorId: true,
                      totalCost: true,
                      vendor: { select: { legalName: true } },
                    },
                  },
                },
              },
            },
          })
        : [];

    // ── Check bulk orders ──────────────────────────────────────────────────
    const boWhere: Prisma.BulkOrderLineItemWhereInput = {
      qtyRemaining: { gt: 0 },
      bulkOrder: {
        companyId: user.companyId ?? '',
        status: 'ACTIVE',
      },
      OR: [
        ...(materialNames.length > 0
          ? [
              {
                description: {
                  in: materialNames,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                itemReference: {
                  in: materialNames,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ]
          : []),
      ],
    };

    const bulkOrderMatches =
      materialNames.length > 0
        ? await this.prisma.bulkOrderLineItem.findMany({
            where: boWhere,
            include: {
              bulkOrder: {
                select: {
                  id: true,
                  vendor: { select: { legalName: true } },
                  vendorId: true,
                },
              },
            },
          })
        : [];

    // ── Build suggestions per line item ────────────────────────────────────
    const suggestions = dto.lineItems.map((li, index) => {
      // RFQ match: by materialId or by material name
      const rfqMatch = rfqMatches.find(
        (m) =>
          (li.materialId !== null &&
            li.materialId !== undefined &&
            m.materialId === li.materialId) ||
          li.materialName?.toLowerCase() === m.material.name.toLowerCase(),
      );
      const approvedQuote = rfqMatch?.rfq.quoteResponses[0];

      // Bulk order match: by description or itemReference
      const boMatch = bulkOrderMatches.find(
        (m) =>
          li.materialName &&
          (m.description.toLowerCase() === li.materialName.toLowerCase() ||
            m.itemReference.toLowerCase() === li.materialName.toLowerCase()),
      );

      return {
        lineItemIndex: index,
        materialId: li.materialId ?? null,
        materialName: li.materialName ?? null,
        bulkOrderMatch: boMatch
          ? {
              bulkOrderId: boMatch.bulkOrder.id,
              remainingQty: boMatch.qtyRemaining,
              agreedPrice: Number(boMatch.pricePerUnit),
              vendorId: boMatch.bulkOrder.vendorId,
              vendorName: boMatch.bulkOrder.vendor.legalName,
            }
          : null,
        rfqMatch:
          rfqMatch && approvedQuote
            ? {
                rfqId: rfqMatch.rfq.id,
                rfqNumber: rfqMatch.rfq.rfqNumber,
                quoteId: approvedQuote.id,
                vendorId: approvedQuote.vendorId,
                vendorName: approvedQuote.vendor.legalName,
                agreedPrice: Number(approvedQuote.totalCost) / (rfqMatch.quantity || 1),
              }
            : null,
      };
    });

    return { suggestions };
  }
}
