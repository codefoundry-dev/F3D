import {
  CreatePoLineItemDto,
  CreatePurchaseOrderDto,
  PoListQueryDto,
  PoQuickFilter,
  UpdatePurchaseOrderDto,
  buildPaginationMeta,
} from '@forethread/shared-types';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  PoStatus as PrismaPoStatus,
  PoType as PrismaPoType,
  Prisma,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/decorators/roles.decorator';
import { nextSequentialNumber } from '../../common/utils/sequential-number.util';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // ── List Purchase Orders ───────────────────────────────────────────────────

  async listPurchaseOrders(query: PoListQueryDto, user: AuthenticatedUser) {
    const sortBy = query.sortBy ?? 'createdDate';
    const sortDir = query.sortDir ?? 'desc';

    const where: Prisma.PurchaseOrderWhereInput = {};

    // Role-based scoping
    if (user.role === UserRole.VENDOR) {
      // Vendor sees POs where they are the vendor
      if (user.companyId) where.vendorId = user.companyId;
    } else if (user.role !== UserRole.SUPER_ADMIN) {
      // PO/CA/FO see company POs
      if (user.companyId) where.companyId = user.companyId;
    }

    // Quick filter
    if (query.quickFilter) {
      this.applyQuickFilter(where, query.quickFilter);
    }

    // Status filter
    if (query.status) {
      where.status = query.status as PrismaPoStatus;
    }

    // Project filter
    if (query.projectId) {
      where.projectId = query.projectId;
    }

    // Search by ID, PO number, or project name
    if (query.search) {
      const searchCondition: Prisma.PurchaseOrderWhereInput = {
        OR: [
          { id: { contains: query.search, mode: 'insensitive' } },
          { poNumber: { contains: query.search, mode: 'insensitive' } },
          { project: { name: { contains: query.search, mode: 'insensitive' } } },
        ],
      };
      // If quick filter already set OR (e.g. splitedPos), combine via AND
      if (where.OR) {
        where.AND = [...(Array.isArray(where.AND) ? where.AND : []), searchCondition];
      } else {
        where.OR = searchCondition.OR;
      }
    }

    // Sorting
    const orderBy: Prisma.PurchaseOrderOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'id':
        orderBy.id = sortDir;
        break;
      case 'poNumber':
        orderBy.poNumber = sortDir;
        break;
      case 'projectName':
        orderBy.project = { name: sortDir };
        break;
      case 'status':
        orderBy.status = sortDir;
        break;
      case 'totalAmount':
        orderBy.totalAmount = sortDir;
        break;
      default:
        orderBy.createdAt = sortDir;
    }

    const [items, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy,
        include: {
          project: { select: { name: true } },
          vendor: { select: { legalName: true } },
          company: { select: { legalName: true } },
          deliveryLocation: { select: { label: true, address: true } },
          createdBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          lastModifiedBy: { select: { id: true, name: true } },
          _count: { select: { documents: true } },
          lineItems: {
            select: { quantityOrdered: true, quantityDelivered: true },
          },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    // Batch-fetch linked RFQ average prices for POs that have an rfqId
    const rfqIds = [...new Set(items.map((po) => po.rfqId).filter(Boolean))] as string[];
    const rfqAvgMap = new Map<string, number>();
    if (rfqIds.length > 0) {
      const avgResults = await this.prisma.quoteResponse.groupBy({
        by: ['rfqId'],
        where: { rfqId: { in: rfqIds } },
        _avg: { totalCost: true },
      });
      for (const row of avgResults) {
        if (row._avg.totalCost !== null && row._avg.totalCost !== undefined) {
          rfqAvgMap.set(row.rfqId, Number(row._avg.totalCost));
        }
      }
    }

    return {
      items: items.map((po) => {
        const lineItemsDelivered = po.lineItems.filter((li) => li.quantityDelivered > 0).length;
        const quantityDelivered = po.lineItems.reduce((sum, li) => sum + li.quantityDelivered, 0);

        return {
          id: po.id,
          poNumber: po.poNumber,
          projectName: po.project.name,
          projectId: po.projectId,
          status: po.status,
          poType: po.poType,
          revision: po.revision,
          pickUp: po.pickUp,
          deliveryLocationId: po.deliveryLocationId,
          deliveryLocationName: po.deliveryLocation?.label ?? po.deliveryLocation?.address ?? null,
          pickUpLocation: po.pickUpLocation,
          holdForRelease: po.holdForRelease,
          paymentTermsDays: po.paymentTermsDays,
          currency: po.currency,
          subtotal: po.subtotal ? Number(po.subtotal) : null,
          discountAmount: po.discountAmount ? Number(po.discountAmount) : null,
          taxAmount: po.taxAmount ? Number(po.taxAmount) : null,
          totalAmount: po.totalAmount ? Number(po.totalAmount) : null,
          lineItemCount: po.lineItemCount,
          totalRequestedQty: po.totalRequestedQty,
          lineItemsDelivered,
          quantityDelivered,
          deadlineStart: po.deadlineStart?.toISOString() ?? null,
          deadlineEnd: po.deadlineEnd?.toISOString() ?? null,
          plannedDeliveryDate: po.plannedDeliveryDate?.toISOString() ?? null,
          issuedAt: po.issuedAt?.toISOString() ?? null,
          approvalStatus: po.approvalStatus,
          approvedBy: po.approvedBy?.name ?? null,
          createdDate: po.createdAt.toISOString(),
          createdBy: po.createdBy.name,
          lastModifiedBy: po.lastModifiedBy?.name ?? null,
          updatedAt: po.updatedAt.toISOString(),
          sourceOfCreation: po.sourceOfCreation,
          contractorName: po.company.legalName,
          vendorName: po.vendor?.legalName ?? null,
          priority: po.priority,
          linkedRfqAvgPrice: po.rfqId ? (rfqAvgMap.get(po.rfqId) ?? null) : null,
          attachmentsCount: po._count.documents,
          hasMessages: false, // Messaging system not yet implemented
        };
      }),
      meta: buildPaginationMeta(query.page ?? 1, query.take, total),
    };
  }

  // ── Get single Purchase Order ──────────────────────────────────────────────

  async getPurchaseOrder(id: string, _user: AuthenticatedUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        project: { select: { name: true } },
        vendor: { select: { id: true, legalName: true } },
        company: { select: { id: true, legalName: true } },
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        lastModifiedBy: { select: { id: true, name: true } },
        deliveryLocation: { select: { label: true, address: true } },
        lineItems: { include: { material: { select: { name: true } } } },
        documents: {
          include: {
            file: { include: { uploadedBy: { select: { id: true, name: true, email: true } } } },
          },
        },
        invoices: { select: { id: true, status: true, totalAmount: true } },
      },
    });

    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    return {
      id: po.id,
      poNumber: po.poNumber,
      documentName: po.documentName,
      projectName: po.project.name,
      projectId: po.projectId,
      status: po.status,
      poType: po.poType,
      approvalStatus: po.approvalStatus,
      sourceOfCreation: po.sourceOfCreation,
      revision: po.revision,
      priority: po.priority,
      pickUp: po.pickUp,
      holdForRelease: po.holdForRelease,
      deliveryLocationId: po.deliveryLocationId,
      deliveryLocationName: po.deliveryLocation?.label ?? po.deliveryLocation?.address ?? null,
      pickUpLocation: po.pickUpLocation,
      pickUpTimeExpectation: po.pickUpTimeExpectation,
      pickUpPersonName: po.pickUpPersonName,
      pickUpPersonPhone: po.pickUpPersonPhone,
      currency: po.currency,
      subtotal: po.subtotal ? Number(po.subtotal) : null,
      discountAmount: po.discountAmount ? Number(po.discountAmount) : null,
      taxAmount: po.taxAmount ? Number(po.taxAmount) : null,
      totalAmount: po.totalAmount ? Number(po.totalAmount) : null,
      paymentTermsDays: po.paymentTermsDays,
      costCode: po.costCode,
      lineItemCount: po.lineItemCount,
      totalRequestedQty: po.totalRequestedQty,
      deadlineStart: po.deadlineStart?.toISOString() ?? null,
      deadlineEnd: po.deadlineEnd?.toISOString() ?? null,
      plannedDeliveryDate: po.plannedDeliveryDate?.toISOString() ?? null,
      deliveryNotes: po.deliveryNotes,
      message: po.message,
      deliveryResponsibleName: po.deliveryResponsibleName,
      deliveryResponsibleEmail: po.deliveryResponsibleEmail,
      issuedAt: po.issuedAt?.toISOString() ?? null,
      parentPoId: po.parentPoId,
      rfqId: po.rfqId,
      approvedBy: po.approvedBy ? { id: po.approvedBy.id, name: po.approvedBy.name } : null,
      createdBy: { id: po.createdBy.id, name: po.createdBy.name },
      lastModifiedBy: po.lastModifiedBy
        ? { id: po.lastModifiedBy.id, name: po.lastModifiedBy.name }
        : null,
      vendor: po.vendor ? { id: po.vendor.id, name: po.vendor.legalName } : null,
      company: { id: po.company.id, name: po.company.legalName },
      lineItems: po.lineItems.map((li) => ({
        id: li.id,
        lineNumber: li.lineNumber,
        materialId: li.materialId,
        materialName: li.material?.name ?? null,
        materialCode: li.materialCode,
        description: li.description,
        quantityOrdered: li.quantityOrdered,
        quantityDelivered: li.quantityDelivered,
        unitOfMeasure: li.unitOfMeasure,
        unitPrice: Number(li.unitPrice),
        lineTotal: Number(li.lineTotal),
        costCode: li.costCode,
        expectedDeliveryDate: li.expectedDeliveryDate?.toISOString() ?? null,
        deliveryLocation: li.deliveryLocationId,
        notes: li.notes,
        pickUp: li.pickUp,
      })),
      documents: po.documents.map((d) => ({
        id: d.id,
        name: d.file.filename,
        fileId: d.fileId,
        uploadedBy: {
          name: d.file.uploadedBy?.name ?? '',
          email: d.file.uploadedBy?.email ?? '',
          avatarUrl: null,
        },
        uploadedAt: d.createdAt.toISOString(),
      })),
      invoices: po.invoices.map((inv) => ({
        id: inv.id,
        status: inv.status,
        totalAmount: Number(inv.totalAmount),
      })),
      createdAt: po.createdAt.toISOString(),
      updatedAt: po.updatedAt.toISOString(),
    };
  }

  // ── Quick Filter Logic ────────────────────────────────────────────────────

  private applyQuickFilter(
    where: Prisma.PurchaseOrderWhereInput,
    quickFilter: PoQuickFilter,
  ): void {
    const now = new Date();

    switch (quickFilter) {
      case PoQuickFilter.ALL_OPEN:
        where.status = {
          notIn: [
            PrismaPoStatus.CLOSED,
            PrismaPoStatus.CANCELLED,
            PrismaPoStatus.CANCELLED_BY_VENDOR,
          ],
        };
        break;

      case PoQuickFilter.PENDING_INT_APPROVAL:
        where.approvalStatus = ApprovalStatus.PENDING;
        break;

      case PoQuickFilter.PENDING_EXT_APPROVAL:
        where.status = PrismaPoStatus.SENT;
        break;

      case PoQuickFilter.APPROVED_BY_VENDOR:
        where.status = { in: [PrismaPoStatus.ACCEPTED, PrismaPoStatus.ACKNOWLEDGED] };
        break;

      case PoQuickFilter.PARTIALLY_DELIVERED:
        where.status = PrismaPoStatus.PARTIALLY_DELIVERED;
        break;

      case PoQuickFilter.CLOSED:
        where.status = PrismaPoStatus.CLOSED;
        break;

      case PoQuickFilter.DUE_SOON: {
        const sevenDaysFromNow = new Date(now);
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        where.plannedDeliveryDate = { gte: now, lte: sevenDaysFromNow };
        where.status = {
          notIn: [PrismaPoStatus.CLOSED, PrismaPoStatus.CANCELLED, PrismaPoStatus.DELIVERED],
        };
        break;
      }

      case PoQuickFilter.OPEN_REVISION:
        where.changeRequests = { some: { resolvedById: null } };
        break;

      case PoQuickFilter.WITH_UNREAD_MESSAGES:
        // Messaging system not yet implemented — filter POs with any documents as placeholder
        where.documents = { some: {} };
        break;

      case PoQuickFilter.RECENTLY_UPDATED: {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        where.updatedAt = { gte: sevenDaysAgo };
        break;
      }

      case PoQuickFilter.SPLITED_POS:
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : []),
          { OR: [{ poType: PrismaPoType.SPLIT }, { parentPoId: { not: null } }] },
        ];
        break;
    }
  }

  // ── Create Purchase Order ───────────────────────────────────────────────

  async createPurchaseOrder(dto: CreatePurchaseOrderDto, user: AuthenticatedUser) {
    // Validate project exists and user has access
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true, companyId: true },
    });
    if (!project) throw new NotFoundException(ERR.purchaseOrders.projectNotFound);
    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== project.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    // Validate vendor exists (if provided)
    if (dto.vendorId) {
      const vendor = await this.prisma.company.findUnique({
        where: { id: dto.vendorId },
        select: { id: true },
      });
      if (!vendor) throw new NotFoundException(ERR.purchaseOrders.vendorNotFound);
    }

    // Validate deliveryLocationId belongs to project
    const location = await this.prisma.projectLocation.findUnique({
      where: { id: dto.deliveryLocationId },
    });
    if (!location || location?.projectId !== dto.projectId) {
      throw new BadRequestException(ERR.purchaseOrders.invalidDeliveryLocation);
    }

    // Hold-for-release requires earliest delivery date (FRD US 5.07 AC 5)
    if (dto.holdForRelease && !dto.deadlineStart) {
      throw new BadRequestException(ERR.purchaseOrders.holdForReleaseRequiresDeadline);
    }

    // Calculate line totals
    const lineItems = dto.lineItems.map((li: CreatePoLineItemDto, idx: number) => {
      const lineTotal = li.quantityOrdered * li.unitPrice;
      return {
        lineNumber: idx + 1,
        materialId: li.materialId ?? null,
        materialCode: li.materialCode,
        description: li.description,
        quantityOrdered: li.quantityOrdered,
        unitOfMeasure: li.unitOfMeasure,
        unitPrice: li.unitPrice,
        lineTotal,
        costCode: li.costCode,
        notes: li.notes,
        expectedDeliveryDate: li.expectedDeliveryDate ? new Date(li.expectedDeliveryDate) : null,
        deliveryLocationId: li.deliveryLocationId,
        pickUp: li.pickUp ?? false,
      };
    });

    const subtotal = lineItems.reduce((sum, li) => sum + li.lineTotal, 0);
    const poNumber = await nextSequentialNumber(
      this.prisma,
      'purchaseOrder',
      'PO',
      user.companyId ?? '',
    );

    const po = await this.prisma.purchaseOrder.create({
      data: {
        poNumber,
        documentName: dto.documentName ?? null,
        companyId: user.companyId ?? '',
        projectId: dto.projectId,
        vendorId: dto.vendorId ?? null,
        createdByUserId: user.id,
        status: PrismaPoStatus.DRAFT,
        poType: (dto.poType as unknown as PrismaPoType) ?? PrismaPoType.STANDARD,
        sourceOfCreation:
          dto.sourceOfCreation as unknown as Prisma.PurchaseOrderCreateInput['sourceOfCreation'],
        priority: dto.priority as unknown as Prisma.PurchaseOrderCreateInput['priority'],
        currency: dto.currency ?? 'AUD',
        deliveryLocationId: dto.deliveryLocationId,
        pickUp: dto.pickUp ?? false,
        pickUpLocation: dto.pickUpLocation,
        pickUpTimeExpectation:
          dto.pickUpTimeExpectation as unknown as Prisma.PurchaseOrderCreateInput['pickUpTimeExpectation'],
        pickUpPersonName: dto.pickUpPersonName,
        pickUpPersonPhone: dto.pickUpPersonPhone,
        holdForRelease: dto.holdForRelease ?? false,
        deadlineStart: dto.deadlineStart ? new Date(dto.deadlineStart) : null,
        deadlineEnd: dto.deadlineEnd ? new Date(dto.deadlineEnd) : null,
        plannedDeliveryDate: dto.plannedDeliveryDate ? new Date(dto.plannedDeliveryDate) : null,
        deliveryNotes: dto.deliveryNotes,
        message: dto.message,
        deliveryResponsibleName: dto.deliveryResponsibleName,
        deliveryResponsibleEmail: dto.deliveryResponsibleEmail,
        paymentTermsDays: dto.paymentTermsDays,
        costCode: dto.costCode,
        rfqId: dto.rfqId,
        subtotal,
        totalAmount: subtotal,
        lineItemCount: lineItems.length,
        totalRequestedQty: lineItems.reduce((sum, li) => sum + li.quantityOrdered, 0),
        lineItems: { create: lineItems },
      },
    });

    return this.getPurchaseOrder(po.id, user);
  }

  // ── Update Purchase Order ──────────────────────────────────────────────

  async updatePurchaseOrder(id: string, dto: UpdatePurchaseOrderDto, user: AuthenticatedUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true, projectId: true },
    });

    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== po.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (po.status !== PrismaPoStatus.DRAFT) {
      throw new BadRequestException(ERR.purchaseOrders.cannotEditNonDraft);
    }

    // Validate deliveryLocationId if provided
    if (dto.deliveryLocationId) {
      const location = await this.prisma.projectLocation.findUnique({
        where: { id: dto.deliveryLocationId },
      });
      if (!location || location?.projectId !== po.projectId) {
        throw new BadRequestException(ERR.purchaseOrders.invalidDeliveryLocation);
      }
    }

    // Hold-for-release requires earliest delivery date (FRD US 5.07 AC 5)
    if (dto.holdForRelease === true && !dto.deadlineStart) {
      // Check if deadlineStart already exists on the PO
      const existing = await this.prisma.purchaseOrder.findUnique({
        where: { id },
        select: { deadlineStart: true },
      });
      if (!existing?.deadlineStart) {
        throw new BadRequestException(ERR.purchaseOrders.holdForReleaseRequiresDeadline);
      }
    }

    if (dto.lineItems) {
      // Delete old and create new line items in a transaction
      const lineItems = dto.lineItems.map((li: CreatePoLineItemDto, idx: number) => {
        const lineTotal = li.quantityOrdered * li.unitPrice;
        return {
          lineNumber: idx + 1,
          materialId: li.materialId ?? null,
          materialCode: li.materialCode,
          description: li.description,
          quantityOrdered: li.quantityOrdered,
          unitOfMeasure: li.unitOfMeasure,
          unitPrice: li.unitPrice,
          lineTotal,
          costCode: li.costCode,
          notes: li.notes,
          expectedDeliveryDate: li.expectedDeliveryDate ? new Date(li.expectedDeliveryDate) : null,
          deliveryLocationId: li.deliveryLocationId,
          pickUp: li.pickUp ?? false,
        };
      });

      const subtotal = lineItems.reduce((sum, li) => sum + li.lineTotal, 0);

      await this.prisma.$transaction([
        this.prisma.poLineItem.deleteMany({ where: { purchaseOrderId: id } }),
        this.prisma.purchaseOrder.update({
          where: { id },
          data: {
            ...(dto.documentName !== undefined && { documentName: dto.documentName }),
            ...(dto.vendorId && { vendorId: dto.vendorId }),
            ...(dto.deliveryLocationId && { deliveryLocationId: dto.deliveryLocationId }),
            ...(dto.plannedDeliveryDate && {
              plannedDeliveryDate: new Date(dto.plannedDeliveryDate),
            }),
            ...(dto.poType && { poType: dto.poType as unknown as PrismaPoType }),
            ...(dto.priority !== undefined && {
              priority: dto.priority as unknown as Prisma.PurchaseOrderUpdateInput['priority'],
            }),
            ...(dto.holdForRelease !== undefined && { holdForRelease: dto.holdForRelease }),
            ...(dto.deadlineStart !== undefined && {
              deadlineStart: dto.deadlineStart ? new Date(dto.deadlineStart) : null,
            }),
            ...(dto.deadlineEnd !== undefined && {
              deadlineEnd: dto.deadlineEnd ? new Date(dto.deadlineEnd) : null,
            }),
            ...(dto.pickUp !== undefined && { pickUp: dto.pickUp }),
            ...(dto.pickUpLocation !== undefined && { pickUpLocation: dto.pickUpLocation }),
            ...(dto.pickUpTimeExpectation !== undefined && {
              pickUpTimeExpectation:
                dto.pickUpTimeExpectation as unknown as Prisma.PurchaseOrderUpdateInput['pickUpTimeExpectation'],
            }),
            ...(dto.pickUpPersonName !== undefined && { pickUpPersonName: dto.pickUpPersonName }),
            ...(dto.pickUpPersonPhone !== undefined && {
              pickUpPersonPhone: dto.pickUpPersonPhone,
            }),
            ...(dto.currency && { currency: dto.currency }),
            ...(dto.paymentTermsDays !== undefined && { paymentTermsDays: dto.paymentTermsDays }),
            ...(dto.costCode !== undefined && { costCode: dto.costCode }),
            ...(dto.rfqId !== undefined && { rfqId: dto.rfqId }),
            ...(dto.deliveryNotes !== undefined && { deliveryNotes: dto.deliveryNotes }),
            ...(dto.message !== undefined && { message: dto.message }),
            ...(dto.deliveryResponsibleName !== undefined && {
              deliveryResponsibleName: dto.deliveryResponsibleName,
            }),
            ...(dto.deliveryResponsibleEmail !== undefined && {
              deliveryResponsibleEmail: dto.deliveryResponsibleEmail,
            }),
            subtotal,
            totalAmount: subtotal,
            lineItemCount: lineItems.length,
            totalRequestedQty: lineItems.reduce((sum, li) => sum + li.quantityOrdered, 0),
            lastModifiedById: user.id,
            lineItems: { create: lineItems },
          },
        }),
      ]);
    } else {
      await this.prisma.purchaseOrder.update({
        where: { id },
        data: {
          ...(dto.documentName !== undefined && { documentName: dto.documentName }),
          ...(dto.vendorId && { vendorId: dto.vendorId }),
          ...(dto.deliveryLocationId && { deliveryLocationId: dto.deliveryLocationId }),
          ...(dto.plannedDeliveryDate && {
            plannedDeliveryDate: new Date(dto.plannedDeliveryDate),
          }),
          ...(dto.poType && { poType: dto.poType as unknown as PrismaPoType }),
          ...(dto.priority !== undefined && {
            priority: dto.priority as unknown as Prisma.PurchaseOrderUpdateInput['priority'],
          }),
          ...(dto.holdForRelease !== undefined && { holdForRelease: dto.holdForRelease }),
          ...(dto.deadlineStart !== undefined && {
            deadlineStart: dto.deadlineStart ? new Date(dto.deadlineStart) : null,
          }),
          ...(dto.deadlineEnd !== undefined && {
            deadlineEnd: dto.deadlineEnd ? new Date(dto.deadlineEnd) : null,
          }),
          ...(dto.pickUp !== undefined && { pickUp: dto.pickUp }),
          ...(dto.pickUpLocation !== undefined && { pickUpLocation: dto.pickUpLocation }),
          ...(dto.pickUpTimeExpectation !== undefined && {
            pickUpTimeExpectation:
              dto.pickUpTimeExpectation as unknown as Prisma.PurchaseOrderUpdateInput['pickUpTimeExpectation'],
          }),
          ...(dto.pickUpPersonName !== undefined && { pickUpPersonName: dto.pickUpPersonName }),
          ...(dto.pickUpPersonPhone !== undefined && { pickUpPersonPhone: dto.pickUpPersonPhone }),
          ...(dto.currency && { currency: dto.currency }),
          ...(dto.paymentTermsDays !== undefined && { paymentTermsDays: dto.paymentTermsDays }),
          ...(dto.costCode !== undefined && { costCode: dto.costCode }),
          ...(dto.rfqId !== undefined && { rfqId: dto.rfqId }),
          ...(dto.deliveryNotes !== undefined && { deliveryNotes: dto.deliveryNotes }),
          ...(dto.message !== undefined && { message: dto.message }),
          ...(dto.deliveryResponsibleName !== undefined && {
            deliveryResponsibleName: dto.deliveryResponsibleName,
          }),
          ...(dto.deliveryResponsibleEmail !== undefined && {
            deliveryResponsibleEmail: dto.deliveryResponsibleEmail,
          }),
          lastModifiedById: user.id,
        },
      });
    }

    return this.getPurchaseOrder(id, user);
  }

  // ── Copy Purchase Order ─────────────────────────────────────────────────

  async copyPurchaseOrder(id: string, user: AuthenticatedUser) {
    const source = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lineItems: true },
    });

    if (!source) throw new NotFoundException(ERR.purchaseOrders.notFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== source.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    const poNumber = await nextSequentialNumber(
      this.prisma,
      'purchaseOrder',
      'PO',
      source.companyId,
    );
    const copy = await this.prisma.purchaseOrder.create({
      data: {
        poNumber,
        companyId: source.companyId,
        projectId: source.projectId,
        vendorId: source.vendorId,
        createdByUserId: user.id,
        status: PrismaPoStatus.DRAFT,
        poType: source.poType,
        currency: source.currency,
        deliveryLocationId: source.deliveryLocationId,
        pickUp: source.pickUp,
        pickUpLocation: source.pickUpLocation,
        pickUpTimeExpectation: source.pickUpTimeExpectation,
        pickUpPersonName: source.pickUpPersonName,
        pickUpPersonPhone: source.pickUpPersonPhone,
        holdForRelease: source.holdForRelease,
        deliveryNotes: source.deliveryNotes,
        message: source.message,
        deliveryResponsibleName: source.deliveryResponsibleName,
        deliveryResponsibleEmail: source.deliveryResponsibleEmail,
        paymentTermsDays: source.paymentTermsDays,
        costCode: source.costCode,
        deadlineStart: source.deadlineStart,
        deadlineEnd: source.deadlineEnd,
        plannedDeliveryDate: source.plannedDeliveryDate,
        subtotal: source.subtotal,
        discountAmount: source.discountAmount,
        taxAmount: source.taxAmount,
        totalAmount: source.totalAmount,
        lineItemCount: source.lineItemCount,
        totalRequestedQty: source.totalRequestedQty,
        lineItems: {
          create: source.lineItems.map((li) => ({
            lineNumber: li.lineNumber,
            materialId: li.materialId,
            materialCode: li.materialCode,
            description: li.description,
            quantityOrdered: li.quantityOrdered,
            unitOfMeasure: li.unitOfMeasure,
            unitPrice: li.unitPrice,
            lineTotal: li.lineTotal,
            costCode: li.costCode,
            expectedDeliveryDate: li.expectedDeliveryDate,
            deliveryLocationId: li.deliveryLocationId,
            notes: li.notes,
            pickUp: li.pickUp,
          })),
        },
      },
    });

    return { id: copy.id };
  }
}
