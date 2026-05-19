import {
  BulkOrderListQueryDto,
  CreateBulkOrderDto,
  CreateDrawdownDto,
  UpdateBulkOrderDto,
  UpdateBulkOrderLineItemDto,
  buildPaginationMeta,
} from '@forethread/shared-types';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BulkOrderStatus, Prisma } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/decorators/roles.decorator';
import { nextSequentialNumber } from '../../common/utils/sequential-number.util';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BulkOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List Bulk Orders ───────────────────────────────────────────────────────

  async listBulkOrders(query: BulkOrderListQueryDto, user: AuthenticatedUser) {
    const sortBy = query.sortBy ?? 'date';
    const sortDir = query.sortDir ?? 'desc';

    const where: Prisma.BulkOrderWhereInput = {};

    // Role-based scoping
    if (user.role === UserRole.VENDOR) {
      if (user.companyId) where.vendorId = user.companyId;
    } else if (user.role !== UserRole.SUPER_ADMIN) {
      if (user.companyId) where.companyId = user.companyId;
    }

    // Project filter
    if (query.projectId) {
      where.projectId = query.projectId;
    }

    // Vendor filter
    if (query.vendorId) {
      where.vendorId = query.vendorId;
    }

    // Search
    if (query.search) {
      where.OR = [
        { id: { contains: query.search, mode: 'insensitive' } },
        { project: { name: { contains: query.search, mode: 'insensitive' } } },
        { vendor: { legalName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    // Status filter
    if (query.status) {
      const now = new Date();
      switch (query.status) {
        case 'ACTIVE': {
          where.status = BulkOrderStatus.ACTIVE;
          const endDateCondition = { OR: [{ endDate: null }, { endDate: { gte: now } }] };
          if (where.OR) {
            // Search already set OR, wrap both in AND
            const searchCondition = { OR: where.OR };
            delete where.OR;
            where.AND = [searchCondition, endDateCondition];
          } else {
            where.OR = endDateCondition.OR;
          }
          break;
        }
        case 'EXPIRED':
          where.endDate = { lt: now };
          break;
        case 'FULLY_DRAWN':
          where.lineItems = { every: { qtyRemaining: 0 } };
          break;
      }
    }

    // Sorting
    const orderBy: Prisma.BulkOrderOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'id':
        orderBy.id = sortDir;
        break;
      case 'projectName':
        orderBy.project = { name: sortDir };
        break;
      case 'vendorName':
        orderBy.vendor = { legalName: sortDir };
        break;
      case 'totalAmount':
        orderBy.totalAmount = sortDir;
        break;
      default:
        orderBy.createdAt = sortDir;
    }

    const [items, total] = await Promise.all([
      this.prisma.bulkOrder.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy,
        include: {
          project: { select: { name: true } },
          company: { select: { legalName: true } },
          vendor: { select: { legalName: true } },
          _count: { select: { lineItems: true } },
          lineItems: {
            select: {
              deliveriesPercent: true,
              totalLineInc: true,
              qty: true,
              qtyRemaining: true,
              ordered: true,
              itemReference: true,
            },
          },
        },
      }),
      this.prisma.bulkOrder.count({ where }),
    ]);

    return {
      items: items.map((bo) => {
        const avgDeliveries =
          bo.lineItems.length > 0
            ? bo.lineItems.reduce((sum, li) => sum + Number(li.deliveriesPercent), 0) /
              bo.lineItems.length
            : 0;
        const totalLineAmount = bo.lineItems.reduce((sum, li) => sum + Number(li.totalLineInc), 0);

        const totalQtyOrdered = bo.lineItems.reduce((sum, li) => sum + li.qty, 0);
        const totalQtyRemaining = bo.lineItems.reduce((sum, li) => sum + li.qtyRemaining, 0);

        const lineConsumptions = bo.lineItems.map((li) =>
          li.qty > 0 ? Math.min(Math.round((li.ordered / li.qty) * 100 * 100) / 100, 100) : 0,
        );
        const consumptionPercent =
          lineConsumptions.length > 0
            ? Math.round(
                (lineConsumptions.reduce((sum, c) => sum + c, 0) / lineConsumptions.length) * 100,
              ) / 100
            : 0;

        return {
          id: bo.id,
          bulkOrderNumber: bo.bulkOrderNumber ?? bo.id,
          projectName: bo.project.name,
          projectId: bo.projectId,
          companyId: bo.companyId,
          contractorName: bo.company.legalName,
          vendorId: bo.vendorId,
          vendorName: bo.vendor.legalName,
          status: bo.status,
          brands: bo.brands,
          lineItems: bo._count.lineItems,
          deliveriesPercent: Math.round(avgDeliveries * 100) / 100,
          amountCount: bo._count.lineItems,
          totalAmount: bo.totalAmount ? Number(bo.totalAmount) : totalLineAmount,
          solidGold: null,
          date: bo.createdAt.toISOString(),
          validUntil: bo.endDate ? bo.endDate.toISOString() : null,
          totalQtyOrdered,
          totalQtyRemaining,
          consumptionPercent,
        };
      }),
      meta: buildPaginationMeta(query.page ?? 1, query.take, total),
    };
  }

  // ── Create Bulk Order ──────────────────────────────────────────────────────

  async createBulkOrder(dto: CreateBulkOrderDto, user: AuthenticatedUser) {
    const totalAmount = dto.lineItems.reduce((sum, li) => sum + li.qty * li.pricePerUnit, 0);

    const bulkOrderNumber = await nextSequentialNumber(
      this.prisma,
      'bulkOrder',
      'BULK',
      user.companyId ?? '',
    );
    const bo = await this.prisma.bulkOrder.create({
      data: {
        bulkOrderNumber,
        projectId: dto.projectId,
        companyId: user.companyId ?? '',
        vendorId: dto.vendorId,
        rfqId: dto.rfqId,
        brands: dto.brands,
        totalAmount,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        createdByUserId: user.id,
        lineItems: {
          create: dto.lineItems.map((li) => ({
            itemReference: li.itemReference,
            description: li.description,
            qty: li.qty,
            unit: li.unit,
            ordered: 0,
            qtyRemaining: li.qty,
            pricePerUnit: li.pricePerUnit,
            totalLineInc: li.qty * li.pricePerUnit,
          })),
        },
      },
    });

    return this.getBulkOrder(bo.id, user);
  }

  // ── Update Bulk Order ──────────────────────────────────────────────────────

  async updateBulkOrder(id: string, dto: UpdateBulkOrderDto, user: AuthenticatedUser) {
    const existing = await this.prisma.bulkOrder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(ERR.bulkOrders.notFound);

    if (
      existing.status === BulkOrderStatus.COMPLETED ||
      existing.status === BulkOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(
        ERR.bulkOrders.cannotModifyClosed.replace('{{status}}', existing.status),
      );
    }

    await this.prisma.bulkOrder.update({
      where: { id },
      data: {
        ...(dto.brands !== undefined && { brands: dto.brands }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.status !== undefined && { status: dto.status as BulkOrderStatus }),
        ...(dto.projectId !== undefined && { projectId: dto.projectId }),
      },
    });

    return this.getBulkOrder(id, user);
  }

  // ── Delete Bulk Order ──────────────────────────────────────────────────────

  async deleteBulkOrder(id: string, _user: AuthenticatedUser) {
    const existing = await this.prisma.bulkOrder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(ERR.bulkOrders.notFound);

    await this.prisma.bulkOrder.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Update Line Item ───────────────────────────────────────────────────────

  async updateLineItem(
    bulkOrderId: string,
    lineItemId: string,
    dto: UpdateBulkOrderLineItemDto,
    user: AuthenticatedUser,
  ) {
    const bo = await this.prisma.bulkOrder.findUnique({ where: { id: bulkOrderId } });
    if (!bo) throw new NotFoundException(ERR.bulkOrders.notFound);

    if (bo.status === BulkOrderStatus.COMPLETED || bo.status === BulkOrderStatus.CANCELLED) {
      throw new BadRequestException(
        ERR.bulkOrders.cannotModifyClosed.replace('{{status}}', bo.status),
      );
    }

    const lineItem = await this.prisma.bulkOrderLineItem.findFirst({
      where: { id: lineItemId, bulkOrderId },
    });
    if (!lineItem) throw new NotFoundException(ERR.bulkOrders.lineItemNotFound);

    const newQty = dto.qty ?? lineItem.qty;
    const newPrice = dto.pricePerUnit ?? Number(lineItem.pricePerUnit);
    const qtyDiff = newQty - lineItem.qty;

    await this.prisma.bulkOrderLineItem.update({
      where: { id: lineItemId },
      data: {
        ...(dto.itemReference !== undefined && { itemReference: dto.itemReference }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.qty !== undefined && {
          qty: newQty,
          qtyRemaining: lineItem.qtyRemaining + qtyDiff,
        }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.pricePerUnit !== undefined && { pricePerUnit: dto.pricePerUnit }),
        totalLineInc: newQty * newPrice,
      },
    });

    // Recalculate total amount
    const allItems = await this.prisma.bulkOrderLineItem.findMany({
      where: { bulkOrderId },
    });
    const newTotal = allItems.reduce((sum, li) => sum + Number(li.totalLineInc), 0);
    await this.prisma.bulkOrder.update({
      where: { id: bulkOrderId },
      data: { totalAmount: newTotal },
    });

    return this.getBulkOrder(bulkOrderId, user);
  }

  // ── Create Drawdown ────────────────────────────────────────────────────────

  async createDrawdown(bulkOrderId: string, dto: CreateDrawdownDto, user: AuthenticatedUser) {
    const bo = await this.prisma.bulkOrder.findUnique({ where: { id: bulkOrderId } });
    if (!bo) throw new NotFoundException(ERR.bulkOrders.notFound);

    if (bo.status !== BulkOrderStatus.ACTIVE) {
      throw new BadRequestException(
        ERR.bulkOrders.cannotModifyClosed.replace('{{status}}', bo.status),
      );
    }

    const lineItem = await this.prisma.bulkOrderLineItem.findFirst({
      where: { id: dto.lineItemId, bulkOrderId },
    });
    if (!lineItem) throw new NotFoundException(ERR.bulkOrders.lineItemNotFound);

    if (dto.quantity > lineItem.qtyRemaining) {
      throw new BadRequestException(ERR.bulkOrders.insufficientQuantity);
    }

    const drawdown = await this.prisma.drawdown.create({
      data: {
        bulkOrderId,
        lineItemId: dto.lineItemId,
        purchaseOrderId: dto.purchaseOrderId,
        quantity: dto.quantity,
        qtyBeforeDrawdown: lineItem.qtyRemaining,
        createdByUserId: user.id,
      },
    });

    // Update line item remaining quantity and utilization
    const newRemaining = lineItem.qtyRemaining - dto.quantity;
    const newOrdered = lineItem.ordered + dto.quantity;
    const deliveriesPercent = lineItem.qty > 0 ? (newOrdered / lineItem.qty) * 100 : 0;

    await this.prisma.bulkOrderLineItem.update({
      where: { id: dto.lineItemId },
      data: {
        qtyRemaining: newRemaining,
        ordered: newOrdered,
        deliveriesPercent: Math.round(deliveriesPercent * 100) / 100,
      },
    });

    return {
      id: drawdown.id,
      bulkOrderId: drawdown.bulkOrderId,
      lineItemId: dto.lineItemId,
      quantity: drawdown.quantity,
      createdAt: drawdown.createdAt.toISOString(),
    };
  }

  // ── Get single Bulk Order ──────────────────────────────────────────────────

  async getBulkOrder(id: string, _user: AuthenticatedUser) {
    const bo = await this.prisma.bulkOrder.findUnique({
      where: { id },
      include: {
        project: { select: { name: true } },
        company: { select: { legalName: true } },
        vendor: { select: { legalName: true } },
        rfq: { select: { id: true } },
        createdBy: { select: { name: true } },
        lineItems: true,
        drawdowns: {
          include: {
            lineItem: { select: { itemReference: true, description: true } },
            purchaseOrder: { select: { poNumber: true } },
            createdBy: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!bo) throw new NotFoundException(ERR.bulkOrders.notFound);

    const mappedLineItems = bo.lineItems.map((li) => ({
      lineItemId: li.id,
      itemReference: li.itemReference,
      description: li.description,
      qty: li.qty,
      unit: li.unit,
      ordered: li.ordered,
      qtyRemaining: li.qtyRemaining,
      deliveriesPercent: Number(li.deliveriesPercent),
      pricePerUnit: Number(li.pricePerUnit),
      totalLineInc: Number(li.totalLineInc),
      consumptionPercent:
        li.qty > 0 ? Math.min(Math.round((li.ordered / li.qty) * 100 * 100) / 100, 100) : 0,
    }));

    const overallConsumptionPercent =
      mappedLineItems.length > 0
        ? Math.round(
            (mappedLineItems.reduce((sum, li) => sum + li.consumptionPercent, 0) /
              mappedLineItems.length) *
              100,
          ) / 100
        : 0;

    const mappedDrawdowns = bo.drawdowns.map((d) => ({
      id: d.id,
      purchaseOrderId: d.purchaseOrderId,
      poNumber: d.purchaseOrder?.poNumber ?? null,
      material: d.lineItem?.itemReference ?? d.lineItem?.description ?? null,
      quantity: d.quantity,
      qtyBeforeDrawdown: d.qtyBeforeDrawdown ?? null,
      remainingQty: d.qtyBeforeDrawdown !== null ? d.qtyBeforeDrawdown - d.quantity : null,
      date: d.createdAt.toISOString(),
    }));

    return {
      bulkId: bo.bulkOrderNumber ?? bo.id,
      rfqReference: bo.rfq?.id ?? null,
      contractorName: bo.company.legalName,
      vendorName: bo.vendor.legalName,
      projectName: bo.project.name,
      createdDate: bo.createdAt.toISOString(),
      endDate: bo.endDate?.toISOString() ?? null,
      createdBy: bo.createdBy.name,
      status: bo.status,
      overallConsumptionPercent,
      lineItems: mappedLineItems,
      drawdowns: mappedDrawdowns,
    };
  }
}
