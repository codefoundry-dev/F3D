import {
  CreatePoDeliveryDto,
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
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  AuditAction,
  BulkOrderStatus,
  PoSourceOfCreation,
  PoStatus as PrismaPoStatus,
  PoType as PrismaPoType,
  Prisma,
  QuoteLineItemStatus,
  QuoteResponseStatus,
  UserRole,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  loadMaterialSnapshots,
  resolveMaterialSnapshot,
} from '../../common/utils/material-snapshot.util';
import { nextSequentialNumber } from '../../common/utils/sequential-number.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertVendorUsableOnProject } from '../vendors/vendor-access.util';

import { loadCompanyPoTerms, normalisePoTerms } from './po-terms.util';

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Best-effort audit of a PO create/edit (FOR-353). Never throws — a logging
   * failure must not fail the (already persisted) change, matching the
   * fire-and-forget convention in po-status.service.ts.
   */
  private async auditPoEvent(
    action: AuditAction,
    poId: string,
    user: AuthenticatedUser,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.auditService.log({
        action,
        performedById: user.id,
        targetType: 'PurchaseOrder',
        targetId: poId,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      });
    } catch (err) {
      this.logger.debug(
        `Failed to audit PO event ${action}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

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

    // Split POs: a SPLIT parent represents its group on the flat internal list,
    // so per-vendor child POs (parentPoId set) are hidden by default and only
    // surfaced via the "split POs" quick filter (US 5.19). Vendors are untouched
    // — they only ever match their own child through vendorId scoping above.
    if (user.role !== UserRole.VENDOR && query.quickFilter !== PoQuickFilter.SPLITED_POS) {
      where.parentPoId = null;
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
      case 'projectCode':
        orderBy.project = { code: sortDir };
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
          project: { select: { name: true, code: true } },
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
          /** Human-readable project code (PRJ-YYYY-NNN) — matches the Projects table. */
          projectCode: po.project.code,
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
    return this.getPurchaseOrderById(id);
  }

  /**
   * Load a single PO detail without a caller identity. Backs both the
   * authenticated detail endpoint (read access is gated at the controller, so
   * the user is unused there) and the tokenised vendor PO portal (FOR-246),
   * where the validated access token already binds the request to this exact
   * PO. Tenancy is implicit — the row carries its own companyId.
   */
  async getPurchaseOrderById(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        project: { select: { name: true, code: true } },
        vendor: { select: { id: true, legalName: true } },
        company: { select: { id: true, legalName: true } },
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        lastModifiedBy: { select: { id: true, name: true } },
        deliveryLocation: { select: { label: true, address: true } },
        deliveries: {
          orderBy: { sequence: 'asc' },
          include: { deliveryLocation: { select: { label: true, address: true } } },
        },
        lineItems: { include: { material: { select: { name: true, imageUrl: true } } } },
        documents: {
          include: {
            file: { include: { uploadedBy: { select: { id: true, name: true, email: true } } } },
          },
        },
        invoices: { select: { id: true, status: true, totalAmount: true } },
        // Split award (US 5.19): a SPLIT parent surfaces its per-vendor children;
        // a child surfaces a link back to its parent.
        parentPo: { select: { id: true, poNumber: true } },
        childPos: {
          orderBy: { poNumber: 'asc' },
          select: {
            id: true,
            poNumber: true,
            status: true,
            totalAmount: true,
            lineItemCount: true,
            vendor: { select: { id: true, legalName: true } },
          },
        },
      },
    });

    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    return {
      id: po.id,
      poNumber: po.poNumber,
      documentName: po.documentName,
      projectName: po.project.name,
      projectId: po.projectId,
      // Human-readable project code (PRJ-YYYY-NNN) shown wherever the UI labels a
      // "Project ID", mirroring the PO list table.
      projectCode: po.project.code,
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
      termsAndConditions: po.termsAndConditions,
      deliveryResponsibleName: po.deliveryResponsibleName,
      deliveryResponsibleEmail: po.deliveryResponsibleEmail,
      issuedAt: po.issuedAt?.toISOString() ?? null,
      parentPoId: po.parentPoId,
      parentPoNumber: po.parentPo?.poNumber ?? null,
      childPos: (po.childPos ?? []).map((c) => ({
        id: c.id,
        poNumber: c.poNumber,
        status: c.status,
        totalAmount: c.totalAmount ? Number(c.totalAmount) : null,
        lineItemCount: c.lineItemCount,
        vendor: c.vendor ? { id: c.vendor.id, name: c.vendor.legalName } : null,
      })),
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
        imageUrl: li.material?.imageUrl ?? null,
        materialCode: li.materialCode,
        description: li.description,
        quantityOrdered: li.quantityOrdered,
        quantityDelivered: li.quantityDelivered,
        unitOfMeasure: li.unitOfMeasure,
        unitPrice: Number(li.unitPrice),
        lineTotal: Number(li.lineTotal),
        costCode: li.costCode,
        upc: li.upc,
        manufacturerPartNumber: li.manufacturerPartNumber,
        taxCode: li.taxCode,
        expectedDeliveryDate: li.expectedDeliveryDate?.toISOString() ?? null,
        deliveryTime: li.deliveryTime,
        deliveryLocation: li.deliveryLocationId,
        notes: li.notes,
        pickUp: li.pickUp,
      })),
      deliveries: (po.deliveries ?? []).map((d) => ({
        id: d.id,
        deliveryLocationId: d.deliveryLocationId,
        deliveryLocationName: d.deliveryLocation?.label ?? d.deliveryLocation?.address ?? null,
        deliveryDate: d.deliveryDate?.toISOString() ?? null,
        notes: d.notes,
        sequence: d.sequence,
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
        // Accepted POs move on to scheduled / late by themselves (FOR-396).
        where.status = {
          in: [
            PrismaPoStatus.ACCEPTED,
            PrismaPoStatus.ACKNOWLEDGED,
            PrismaPoStatus.SCHEDULED_FOR_DELIVERY,
            PrismaPoStatus.LATE_FOR_DELIVERY,
          ],
        };
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

  // ── Delivery rows helper ────────────────────────────────────────────────

  /**
   * Validate header-level delivery rows (FOR-210) and return the nested-create
   * payload with a stable `sequence`. Each row must carry at least a location
   * or a date, and any supplied location must belong to the PO's project.
   */
  private async buildDeliveryRows(
    deliveries: CreatePoDeliveryDto[] | undefined,
    projectId: string,
  ): Promise<
    Array<{
      deliveryLocationId: string | null;
      deliveryDate: Date | null;
      notes: string | null;
      sequence: number;
    }>
  > {
    if (!deliveries || deliveries.length === 0) return [];

    const locationIds = [
      ...new Set(deliveries.map((d) => d.deliveryLocationId).filter(Boolean)),
    ] as string[];

    const validLocationIds = new Set<string>();
    if (locationIds.length > 0) {
      const locations = await this.prisma.projectLocation.findMany({
        where: { id: { in: locationIds }, projectId },
        select: { id: true },
      });
      for (const loc of locations) validLocationIds.add(loc.id);
    }

    return deliveries.map((d, idx) => {
      if (!d.deliveryLocationId && !d.deliveryDate) {
        throw new BadRequestException(ERR.purchaseOrders.invalidDeliveryRow);
      }
      if (d.deliveryLocationId && !validLocationIds.has(d.deliveryLocationId)) {
        throw new BadRequestException(ERR.purchaseOrders.invalidDeliveryLocation);
      }
      return {
        deliveryLocationId: d.deliveryLocationId ?? null,
        deliveryDate: d.deliveryDate ? new Date(d.deliveryDate) : null,
        notes: d.notes ?? null,
        sequence: idx,
      };
    });
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
      await assertVendorUsableOnProject(this.prisma, dto.vendorId, project.companyId, project.id);
    }

    // Validate deliveryLocationId belongs to project (when provided — a draft PO
    // may omit it; the buyer sets the delivery location before the PO is issued).
    if (dto.deliveryLocationId) {
      const location = await this.prisma.projectLocation.findUnique({
        where: { id: dto.deliveryLocationId },
      });
      if (location?.projectId !== dto.projectId) {
        throw new BadRequestException(ERR.purchaseOrders.invalidDeliveryLocation);
      }
    }

    // Hold-for-release requires earliest delivery date (FRD US 5.07 AC 5)
    if (dto.holdForRelease && !dto.deadlineStart) {
      throw new BadRequestException(ERR.purchaseOrders.holdForReleaseRequiresDeadline);
    }

    // Drawdown-from-PO (US 5.09): a PO sourced from a bulk order draws each of
    // its lines down against the bulk order's remaining quantities. Detect the
    // mode up front so we can force poType=DRAWDOWN and run the create + the
    // drawdown bookkeeping atomically.
    const isDrawdown =
      (dto.sourceOfCreation as string) === PoSourceOfCreation.BULK_DRAWDOWN && !!dto.bulkOrderId;

    // Snapshot each catalogue material's UPC / MPN / tax code onto its line and
    // pre-fill the cost code (US: materials carry these codes; cost code defaults
    // onto the line but stays editable).
    const materialSnapshots = await loadMaterialSnapshots(
      this.prisma,
      dto.lineItems.map((li) => li.materialId),
    );

    // FOR-391: a line bought from an approved quote is priced at the quoted
    // unit price, whatever the client sent.
    const quotedPrices = await this.loadQuotedPrices(dto, project.companyId);

    // Calculate line totals. `bulkOrderLineItemId` is not a PoLineItem column —
    // it only drives the drawdown, so keep it alongside the create payload.
    const lineItems = dto.lineItems.map((li: CreatePoLineItemDto, idx: number) => {
      const unitPrice = li.quoteLineItemId
        ? (quotedPrices.byLine.get(li.quoteLineItemId) ?? li.unitPrice)
        : li.unitPrice;
      const lineTotal = li.quantityOrdered * unitPrice;
      const snapshot = resolveMaterialSnapshot(li, li.materialId ?? null, materialSnapshots);
      return {
        bulkOrderLineItemId: li.bulkOrderLineItemId,
        data: {
          lineNumber: idx + 1,
          materialId: li.materialId ?? null,
          materialCode: li.materialCode,
          description: li.description,
          quantityOrdered: li.quantityOrdered,
          unitOfMeasure: li.unitOfMeasure,
          unitPrice,
          lineTotal,
          costCode: snapshot.costCode,
          upc: snapshot.upc,
          manufacturerPartNumber: snapshot.manufacturerPartNumber,
          taxCode: snapshot.taxCode,
          notes: li.notes,
          expectedDeliveryDate: li.expectedDeliveryDate ? new Date(li.expectedDeliveryDate) : null,
          deliveryTime: li.deliveryTime ?? null,
          deliveryLocationId: li.deliveryLocationId,
          pickUp: li.pickUp ?? false,
        },
      };
    });

    // Build and validate header-level delivery rows (FOR-210)
    const deliveryRows = await this.buildDeliveryRows(dto.deliveries, dto.projectId);

    const subtotal = lineItems.reduce((sum, li) => sum + li.data.lineTotal, 0);
    const poNumber = await nextSequentialNumber(
      this.prisma,
      'purchaseOrder',
      'PO',
      user.companyId ?? '',
    );

    // FOR-398: the wizard sends the (possibly edited) terms; any other caller
    // gets the company default.
    const termsAndConditions =
      dto.termsAndConditions !== undefined
        ? normalisePoTerms(dto.termsAndConditions)
        : await loadCompanyPoTerms(this.prisma, user.companyId ?? '');

    const poType: PrismaPoType = isDrawdown
      ? PrismaPoType.DRAWDOWN
      : ((dto.poType as unknown as PrismaPoType) ?? PrismaPoType.STANDARD);

    const po = await this.prisma.$transaction(async (tx) => {
      const created = await tx.purchaseOrder.create({
        data: {
          poNumber,
          documentName: dto.documentName ?? null,
          companyId: user.companyId ?? '',
          projectId: dto.projectId,
          vendorId: dto.vendorId ?? null,
          createdByUserId: user.id,
          status: PrismaPoStatus.DRAFT,
          poType,
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
          termsAndConditions,
          deliveryResponsibleName: dto.deliveryResponsibleName,
          deliveryResponsibleEmail: dto.deliveryResponsibleEmail,
          paymentTermsDays: dto.paymentTermsDays,
          costCode: dto.costCode,
          rfqId: dto.rfqId ?? quotedPrices.rfqId,
          subtotal,
          totalAmount: subtotal,
          lineItemCount: lineItems.length,
          totalRequestedQty: lineItems.reduce((sum, li) => sum + li.data.quantityOrdered, 0),
          lineItems: { create: lineItems.map((li) => li.data) },
          ...(deliveryRows.length > 0 && { deliveries: { create: deliveryRows } }),
        },
      });

      if (isDrawdown && dto.bulkOrderId) {
        await this.applyDrawdownsFromPo(tx, dto.bulkOrderId, created.id, lineItems, user.id);
      }

      return created;
    });

    await this.auditPoEvent(AuditAction.PO_CREATED, po.id, user, {
      source: (dto.sourceOfCreation as string) ?? PoSourceOfCreation.MANUAL,
      ...(isDrawdown && dto.bulkOrderId ? { bulkOrderId: dto.bulkOrderId } : {}),
    });

    return this.getPurchaseOrder(po.id, user);
  }

  /**
   * Resolve the quoted unit price of every quote line the PO lines reference
   * (FOR-391). Each must belong to an approved quote (or an approved line) from
   * this PO's vendor on one of the buyer company's RFQs. When the lines all come
   * from one RFQ and the client sent no `rfqId`, that RFQ is returned so the PO
   * still links back to it.
   */
  private async loadQuotedPrices(
    dto: CreatePurchaseOrderDto,
    companyId: string,
  ): Promise<{ byLine: Map<string, number>; rfqId: string | undefined }> {
    const ids = [
      ...new Set(dto.lineItems.map((li) => li.quoteLineItemId).filter(Boolean)),
    ] as string[];
    if (ids.length === 0) return { byLine: new Map(), rfqId: undefined };

    const quoteLines = await this.prisma.quoteResponseLineItem.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        unitPrice: true,
        status: true,
        quoteResponse: {
          select: {
            vendorId: true,
            status: true,
            rfqId: true,
            rfq: { select: { companyId: true } },
          },
        },
      },
    });

    const byLine = new Map<string, number>();
    const rfqIds = new Set<string>();
    for (const ql of quoteLines) {
      const qr = ql.quoteResponse;
      const approved =
        qr.status === QuoteResponseStatus.APPROVED || ql.status === QuoteLineItemStatus.APPROVED;
      if (
        !approved ||
        ql.status === QuoteLineItemStatus.DECLINED ||
        qr.rfq.companyId !== companyId ||
        (dto.vendorId && qr.vendorId !== dto.vendorId)
      ) {
        continue;
      }
      byLine.set(ql.id, Number(ql.unitPrice));
      rfqIds.add(qr.rfqId);
    }
    if (byLine.size !== ids.length) {
      throw new BadRequestException(ERR.purchaseOrders.invalidQuoteLine);
    }
    return { byLine, rfqId: rfqIds.size === 1 ? [...rfqIds][0] : undefined };
  }

  // ── Drawdown-from-PO bookkeeping (US 5.09) ──────────────────────────────

  /**
   * For a PO sourced from a bulk order, draw each PO line that references a
   * bulk-order line down against that line's `qtyRemaining`: validate the
   * quantity, write a Drawdown row, decrement `qtyRemaining` / increment
   * `ordered`, and recompute the line utilisation. When every line on the bulk
   * order reaches zero remaining, the bulk order is marked COMPLETED. Runs
   * inside the PO-create transaction so the PO and the drawdowns are
   * all-or-nothing.
   */
  private async applyDrawdownsFromPo(
    tx: Prisma.TransactionClient,
    bulkOrderId: string,
    purchaseOrderId: string,
    lineItems: Array<{ bulkOrderLineItemId?: string; data: { quantityOrdered: number } }>,
    userId: string,
  ): Promise<void> {
    const bulkOrder = await tx.bulkOrder.findUnique({
      where: { id: bulkOrderId },
      select: { id: true, bulkOrderNumber: true },
    });
    if (!bulkOrder) throw new NotFoundException(ERR.purchaseOrders.bulkOrderNotFound);

    for (const li of lineItems) {
      if (!li.bulkOrderLineItemId) continue;

      const bulkLine = await tx.bulkOrderLineItem.findFirst({
        where: { id: li.bulkOrderLineItemId, bulkOrderId },
      });
      if (!bulkLine) throw new NotFoundException(ERR.purchaseOrders.bulkOrderLineNotFound);

      const qty = li.data.quantityOrdered;
      if (qty > bulkLine.qtyRemaining) {
        throw new BadRequestException(
          ERR.purchaseOrders.drawdownExceedsRemaining(
            qty,
            bulkLine.itemReference || bulkLine.description,
            bulkLine.qtyRemaining,
            bulkOrder.bulkOrderNumber ?? bulkOrder.id,
          ),
        );
      }

      await tx.drawdown.create({
        data: {
          bulkOrderId,
          lineItemId: li.bulkOrderLineItemId,
          purchaseOrderId,
          quantity: qty,
          qtyBeforeDrawdown: bulkLine.qtyRemaining,
          createdByUserId: userId,
        },
      });

      const newRemaining = bulkLine.qtyRemaining - qty;
      const newOrdered = bulkLine.ordered + qty;
      const deliveriesPercent = bulkLine.qty > 0 ? (newOrdered / bulkLine.qty) * 100 : 0;

      await tx.bulkOrderLineItem.update({
        where: { id: li.bulkOrderLineItemId },
        data: {
          qtyRemaining: newRemaining,
          ordered: newOrdered,
          deliveriesPercent: Math.round(deliveriesPercent * 100) / 100,
        },
      });
    }

    // If every line on the bulk order is now fully drawn, complete it.
    const remainingLines = await tx.bulkOrderLineItem.findMany({
      where: { bulkOrderId },
      select: { qtyRemaining: true },
    });
    const fullyDrawn =
      remainingLines.length > 0 && remainingLines.every((l) => l.qtyRemaining === 0);
    if (fullyDrawn) {
      await tx.bulkOrder.update({
        where: { id: bulkOrderId },
        data: { status: BulkOrderStatus.COMPLETED },
      });
    }
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

    // Build/validate header-level delivery rows when provided (FOR-210).
    // Replacing deliveries works independently of whether lineItems are sent.
    const deliveryRows = dto.deliveries
      ? await this.buildDeliveryRows(dto.deliveries, po.projectId)
      : undefined;

    if (dto.lineItems) {
      // Delete old and create new line items in a transaction. Re-snapshot the
      // catalogue codes from each line's material (see createPurchaseOrder).
      const materialSnapshots = await loadMaterialSnapshots(
        this.prisma,
        dto.lineItems.map((li) => li.materialId),
      );
      const lineItems = dto.lineItems.map((li: CreatePoLineItemDto, idx: number) => {
        const lineTotal = li.quantityOrdered * li.unitPrice;
        const snapshot = resolveMaterialSnapshot(li, li.materialId ?? null, materialSnapshots);
        return {
          lineNumber: idx + 1,
          materialId: li.materialId ?? null,
          materialCode: li.materialCode,
          description: li.description,
          quantityOrdered: li.quantityOrdered,
          unitOfMeasure: li.unitOfMeasure,
          unitPrice: li.unitPrice,
          lineTotal,
          costCode: snapshot.costCode,
          upc: snapshot.upc,
          manufacturerPartNumber: snapshot.manufacturerPartNumber,
          taxCode: snapshot.taxCode,
          notes: li.notes,
          expectedDeliveryDate: li.expectedDeliveryDate ? new Date(li.expectedDeliveryDate) : null,
          deliveryTime: li.deliveryTime ?? null,
          deliveryLocationId: li.deliveryLocationId,
          pickUp: li.pickUp ?? false,
        };
      });

      const subtotal = lineItems.reduce((sum, li) => sum + li.lineTotal, 0);

      await this.prisma.$transaction([
        this.prisma.poLineItem.deleteMany({ where: { purchaseOrderId: id } }),
        ...(deliveryRows
          ? [this.prisma.poDelivery.deleteMany({ where: { purchaseOrderId: id } })]
          : []),
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
            ...(dto.termsAndConditions !== undefined && {
              termsAndConditions: normalisePoTerms(dto.termsAndConditions),
            }),
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
            ...(deliveryRows && { deliveries: { create: deliveryRows } }),
          },
        }),
      ]);
    } else {
      const data: Prisma.PurchaseOrderUncheckedUpdateInput = {
        ...(deliveryRows && { deliveries: { create: deliveryRows } }),
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
        ...(dto.termsAndConditions !== undefined && {
          termsAndConditions: normalisePoTerms(dto.termsAndConditions),
        }),
        ...(dto.deliveryResponsibleName !== undefined && {
          deliveryResponsibleName: dto.deliveryResponsibleName,
        }),
        ...(dto.deliveryResponsibleEmail !== undefined && {
          deliveryResponsibleEmail: dto.deliveryResponsibleEmail,
        }),
        lastModifiedById: user.id,
      };

      if (deliveryRows) {
        // Replace delivery rows atomically alongside the metadata update.
        await this.prisma.$transaction([
          this.prisma.poDelivery.deleteMany({ where: { purchaseOrderId: id } }),
          this.prisma.purchaseOrder.update({ where: { id }, data }),
        ]);
      } else {
        await this.prisma.purchaseOrder.update({ where: { id }, data });
      }
    }

    // Record which DTO fields the draft edit touched (FOR-353).
    const changedFields = Object.keys(dto).filter(
      (key) => (dto as unknown as Record<string, unknown>)[key] !== undefined,
    );
    await this.auditPoEvent(AuditAction.PO_UPDATED, id, user, { changedFields });

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
        // A copy is a new PO: it takes today's company terms (FOR-398).
        termsAndConditions: await loadCompanyPoTerms(this.prisma, source.companyId),
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
            upc: li.upc,
            manufacturerPartNumber: li.manufacturerPartNumber,
            taxCode: li.taxCode,
            expectedDeliveryDate: li.expectedDeliveryDate,
            deliveryTime: li.deliveryTime,
            deliveryLocationId: li.deliveryLocationId,
            notes: li.notes,
            pickUp: li.pickUp,
          })),
        },
      },
    });

    await this.auditPoEvent(AuditAction.PO_CREATED, copy.id, user, {
      source: 'COPY',
      copiedFromPoId: source.id,
      copiedFromPoNumber: source.poNumber,
    });

    return { id: copy.id };
  }
}
