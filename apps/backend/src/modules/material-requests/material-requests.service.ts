import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  MaterialRequestStatus,
  PoSourceOfCreation,
  PoStatus,
  PoType,
  Prisma,
  RfqStatus,
  UserRole,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PermissionsService } from '../../common/permissions';
import { nextSequentialNumber } from '../../common/utils/sequential-number.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';

import {
  ConvertToPoDto,
  ConvertToRfqDto,
  CreateMaterialRequestDto,
  CreateMrLineItemDto,
  DeclineMaterialRequestDto,
  ListMaterialRequestQueryDto,
  UpdateMaterialRequestDto,
} from './material-requests.dto';
import {
  assertTransition as assertTransitionOrThrow,
  canTransition as canTransitionMr,
} from './mr-state-machine';

/** Prisma include shared by the detail read + the convert reads. */
const MR_DETAIL_INCLUDE = {
  project: { select: { id: true, name: true } },
  company: { select: { id: true, legalName: true } },
  requestedBy: { select: { id: true, name: true, email: true } },
  reviewedBy: { select: { id: true, name: true, email: true } },
  deliveryLocation: { select: { id: true, label: true, address: true } },
  convertedToRfq: { select: { id: true, rfqNumber: true } },
  convertedToPo: { select: { id: true, poNumber: true } },
  lineItems: {
    include: {
      material: { select: { id: true, name: true, uom: true } },
      deliveryLocation: { select: { id: true, label: true, address: true } },
    },
  },
} satisfies Prisma.MaterialRequestInclude;

@Injectable()
export class MaterialRequestsService {
  private readonly logger = new Logger(MaterialRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly permissions: PermissionsService,
    private readonly inventoryService: InventoryService,
  ) {}

  // ── Audit helper ────────────────────────────────────────────────────────────

  /**
   * Best-effort audit of an MR lifecycle event. Never throws — a logging failure
   * must not fail the (already persisted) status change, matching the
   * fire-and-forget convention used by the PO module (po-status.service.ts).
   */
  private async auditMr(
    action: AuditAction,
    mrId: string,
    user: AuthenticatedUser,
    metadata?: Prisma.InputJsonObject,
  ): Promise<void> {
    try {
      await this.auditService.log({
        action,
        performedById: user.id,
        targetType: 'MaterialRequest',
        targetId: mrId,
        metadata: metadata ?? {},
      });
    } catch (err) {
      this.logger.debug(
        `Failed to audit MR ${action} on ${mrId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  async create(user: AuthenticatedUser, dto: CreateMaterialRequestDto) {
    const companyId = user.companyId ?? '';

    // Project must exist and belong to the caller's company (SUPER_ADMIN any).
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true, companyId: true },
    });
    if (!project) throw new NotFoundException(ERR.materialRequests.projectNotFound);
    this.assertCompanyAccess(user, project.companyId);

    await this.assertLineItemsValid(dto.lineItems);
    await this.assertDeliveryLocationsInProject(dto, project.id);

    const submit = dto.submit === true;
    const status = submit ? MaterialRequestStatus.SUBMITTED : MaterialRequestStatus.DRAFT;
    const mrNumber = await this.nextMrNumber(companyId);

    const created = await this.prisma.materialRequest.create({
      data: {
        mrNumber,
        projectId: project.id,
        companyId,
        status,
        priority: dto.priority ?? undefined,
        requestedById: user.id,
        neededByDate: dto.neededByDate ? new Date(dto.neededByDate) : null,
        deliveryLocationId: dto.deliveryLocationId ?? null,
        note: dto.note ?? null,
        lineItems: { create: dto.lineItems.map((li) => this.toLineItemCreate(li)) },
      },
      select: { id: true },
    });

    await this.auditMr(AuditAction.MATERIAL_REQUEST_CREATED, created.id, user);
    if (submit) {
      await this.auditMr(AuditAction.MATERIAL_REQUEST_SUBMITTED, created.id, user, {
        from: MaterialRequestStatus.DRAFT,
        to: MaterialRequestStatus.SUBMITTED,
      });
    }

    return this.get(created.id, user);
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async list(user: AuthenticatedUser, query: ListMaterialRequestQueryDto) {
    const where: Prisma.MaterialRequestWhereInput = {};

    // Company scoping (SUPER_ADMIN sees all; everyone else their own company).
    if (user.role !== UserRole.SUPER_ADMIN) {
      if (!user.companyId) return { items: [] };
      where.companyId = user.companyId;
    }

    if (query.mine) where.requestedById = user.id;
    if (query.projectId) where.projectId = query.projectId;
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;

    // Quick filters (each narrows the set; they compose).
    if (query.awaitingApproval) where.status = MaterialRequestStatus.SUBMITTED;
    if (query.approved) where.status = MaterialRequestStatus.APPROVED;
    if (query.urgent) where.priority = { in: ['HIGH', 'URGENT'] };
    if (query.overdue) {
      where.neededByDate = { lt: new Date() };
      where.status = {
        notIn: [
          MaterialRequestStatus.CONVERTED,
          MaterialRequestStatus.DECLINED,
          MaterialRequestStatus.CANCELLED,
        ],
      };
    }

    const items = await this.prisma.materialRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        mrNumber: true,
        status: true,
        priority: true,
        neededByDate: true,
        createdAt: true,
        projectId: true,
        project: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
        _count: { select: { lineItems: true } },
      },
    });

    return {
      items: items.map((mr) => ({
        id: mr.id,
        mrNumber: mr.mrNumber,
        status: mr.status,
        priority: mr.priority,
        projectId: mr.projectId,
        project: { id: mr.project.id, name: mr.project.name },
        requestedBy: { id: mr.requestedBy.id, name: mr.requestedBy.name },
        lineItemCount: mr._count.lineItems,
        neededByDate: mr.neededByDate?.toISOString() ?? null,
        createdAt: mr.createdAt.toISOString(),
      })),
    };
  }

  // ── Get single ──────────────────────────────────────────────────────────────

  async get(id: string, user: AuthenticatedUser) {
    const mr = await this.prisma.materialRequest.findUnique({
      where: { id },
      include: MR_DETAIL_INCLUDE,
    });
    if (!mr) throw new NotFoundException(ERR.materialRequests.notFound);
    this.assertCompanyAccess(user, mr.companyId);

    return this.toDetail(mr);
  }

  // ── Update (DRAFT only) ──────────────────────────────────────────────────────

  async update(id: string, user: AuthenticatedUser, dto: UpdateMaterialRequestDto) {
    const mr = await this.prisma.materialRequest.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true, projectId: true },
    });
    if (!mr) throw new NotFoundException(ERR.materialRequests.notFound);
    this.assertCompanyAccess(user, mr.companyId);

    if (mr.status !== MaterialRequestStatus.DRAFT) {
      throw new BadRequestException(ERR.materialRequests.cannotUpdateNonDraft);
    }

    // A line-item replacement (when provided) is validated like create.
    if (dto.lineItems) {
      await this.assertLineItemsValid(dto.lineItems);
    }
    await this.assertDeliveryLocationsInProject(dto, mr.projectId);

    const data: Prisma.MaterialRequestUpdateInput = {};
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.note !== undefined) data.note = dto.note;
    if (dto.neededByDate !== undefined) {
      data.neededByDate = dto.neededByDate ? new Date(dto.neededByDate) : null;
    }
    if (dto.deliveryLocationId !== undefined) {
      data.deliveryLocation = dto.deliveryLocationId
        ? { connect: { id: dto.deliveryLocationId } }
        : { disconnect: true };
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.lineItems) {
        await tx.materialRequestLineItem.deleteMany({ where: { materialRequestId: id } });
        await tx.materialRequestLineItem.createMany({
          data: dto.lineItems.map((li) => ({
            materialRequestId: id,
            ...this.toLineItemCreate(li),
          })),
        });
      }
      await tx.materialRequest.update({ where: { id }, data });
    });

    return this.get(id, user);
  }

  // ── Submit (DRAFT → SUBMITTED) ────────────────────────────────────────────────

  async submit(id: string, user: AuthenticatedUser) {
    const mr = await this.findForTransition(id, user);
    assertTransitionOrThrow(mr.status, MaterialRequestStatus.SUBMITTED);

    await this.prisma.materialRequest.update({
      where: { id },
      data: { status: MaterialRequestStatus.SUBMITTED },
    });
    await this.auditMr(AuditAction.MATERIAL_REQUEST_SUBMITTED, id, user, {
      from: mr.status,
      to: MaterialRequestStatus.SUBMITTED,
    });

    return this.get(id, user);
  }

  // ── Approve (SUBMITTED → APPROVED) ────────────────────────────────────────────

  async approve(id: string, user: AuthenticatedUser) {
    const mr = await this.prisma.materialRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        companyId: true,
        deliveryLocationId: true,
        lineItems: {
          select: { id: true, materialId: true, quantity: true, deliveryLocationId: true },
        },
      },
    });
    if (!mr) throw new NotFoundException(ERR.materialRequests.notFound);
    this.assertCompanyAccess(user, mr.companyId);
    assertTransitionOrThrow(mr.status, MaterialRequestStatus.APPROVED);

    // Approve the MR and auto-issue any in-stock lines atomically: the status
    // change and the inventory OUT movements commit together. Each line with a
    // catalogue material and a resolvable location (line override, else the MR
    // header) is issued up to its requested quantity, clamped at on-hand by
    // inventoryService.issueOut. Lines without material / location / stock issue
    // nothing — that is correct and expected (the demand simply isn't covered
    // from inventory and flows on to procurement).
    const issued: Array<{
      lineId: string;
      materialId: string;
      locationId: string;
      issued: number;
    }> = [];

    await this.prisma.$transaction(async (tx) => {
      await tx.materialRequest.update({
        where: { id },
        data: {
          status: MaterialRequestStatus.APPROVED,
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
      });

      for (const line of mr.lineItems) {
        const locationId = line.deliveryLocationId ?? mr.deliveryLocationId;
        if (!line.materialId || !locationId) continue;

        const result = await this.inventoryService.issueOut(tx, {
          companyId: mr.companyId,
          materialId: line.materialId,
          locationId,
          requestedQuantity: line.quantity,
          sourceType: 'MATERIAL_REQUEST',
          sourceId: mr.id,
          sourceLineId: line.id,
          createdById: user.id,
        });

        if (result.issued > 0) {
          issued.push({
            lineId: line.id,
            materialId: line.materialId,
            locationId,
            issued: result.issued,
          });
        }
      }
    });

    await this.auditMr(AuditAction.MATERIAL_REQUEST_APPROVED, id, user, {
      from: mr.status,
      to: MaterialRequestStatus.APPROVED,
      issued,
    });

    return this.get(id, user);
  }

  // ── Decline (SUBMITTED → DECLINED, reason required) ───────────────────────────

  async decline(id: string, user: AuthenticatedUser, dto: DeclineMaterialRequestDto) {
    const mr = await this.findForTransition(id, user);
    assertTransitionOrThrow(mr.status, MaterialRequestStatus.DECLINED);

    await this.prisma.materialRequest.update({
      where: { id },
      data: {
        status: MaterialRequestStatus.DECLINED,
        declineReason: dto.reason,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
    await this.auditMr(AuditAction.MATERIAL_REQUEST_DECLINED, id, user, {
      from: mr.status,
      to: MaterialRequestStatus.DECLINED,
      reason: dto.reason,
    });

    return this.get(id, user);
  }

  // ── Cancel (DRAFT|SUBMITTED|APPROVED → CANCELLED) ─────────────────────────────

  async cancel(id: string, user: AuthenticatedUser) {
    const mr = await this.findForTransition(id, user);

    // Only the requester or a user entitled to approve MRs may cancel.
    const canApprove = await this.userCanApprove(user);
    if (mr.requestedById !== user.id && !canApprove) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (!canTransitionMr(mr.status, MaterialRequestStatus.CANCELLED)) {
      throw new BadRequestException(ERR.materialRequests.cannotCancel(mr.status));
    }
    assertTransitionOrThrow(mr.status, MaterialRequestStatus.CANCELLED);

    await this.prisma.materialRequest.update({
      where: { id },
      data: { status: MaterialRequestStatus.CANCELLED },
    });
    await this.auditMr(AuditAction.MATERIAL_REQUEST_CANCELLED, id, user, {
      from: mr.status,
      to: MaterialRequestStatus.CANCELLED,
    });

    return this.get(id, user);
  }

  // ── Convert to RFQ (APPROVED → CONVERTED) ─────────────────────────────────────

  async convertToRfq(id: string, user: AuthenticatedUser, dto?: ConvertToRfqDto) {
    const mr = await this.prisma.materialRequest.findUnique({
      where: { id },
      include: { lineItems: true },
    });
    if (!mr) throw new NotFoundException(ERR.materialRequests.notFound);
    this.assertCompanyAccess(user, mr.companyId);

    if (mr.status !== MaterialRequestStatus.APPROVED) {
      throw new BadRequestException(ERR.materialRequests.cannotConvertNotApproved);
    }
    assertTransitionOrThrow(mr.status, MaterialRequestStatus.CONVERTED);

    const rfqNumber = await nextSequentialNumber(this.prisma, 'rfq', 'RFQ', mr.companyId);
    const totalRequestedQty = mr.lineItems.reduce((sum, li) => sum + li.quantity, 0);

    const rfq = await this.prisma.$transaction(async (tx) => {
      const createdRfq = await tx.rfq.create({
        data: {
          rfqNumber,
          name: dto?.name ?? null,
          companyId: mr.companyId,
          projectId: mr.projectId,
          createdByUserId: user.id,
          status: RfqStatus.DRAFT,
          deliveryLocationId: mr.deliveryLocationId,
          needByDate: mr.neededByDate,
          totalRequestedQty,
          lineItems: {
            create: mr.lineItems.map((li) => ({
              materialId: li.materialId,
              materialName: li.materialName,
              description: li.description,
              quantity: li.quantity,
              unit: li.unit,
              expectedDeliveryDate: li.expectedDeliveryDate,
              deliveryLocationId: li.deliveryLocationId,
              notes: li.notes,
            })),
          },
        },
        select: { id: true, rfqNumber: true },
      });

      await tx.materialRequest.update({
        where: { id },
        data: {
          status: MaterialRequestStatus.CONVERTED,
          convertedToRfqId: createdRfq.id,
          convertedAt: new Date(),
        },
      });

      return createdRfq;
    });

    await this.auditMr(AuditAction.MATERIAL_REQUEST_CONVERTED, id, user, {
      from: MaterialRequestStatus.APPROVED,
      to: MaterialRequestStatus.CONVERTED,
      target: 'RFQ',
      rfqId: rfq.id,
    });

    return { rfqId: rfq.id, rfqNumber: rfq.rfqNumber };
  }

  // ── Convert to PO (APPROVED → CONVERTED) ──────────────────────────────────────

  async convertToPo(id: string, user: AuthenticatedUser, dto: ConvertToPoDto) {
    const mr = await this.prisma.materialRequest.findUnique({
      where: { id },
      include: { lineItems: true },
    });
    if (!mr) throw new NotFoundException(ERR.materialRequests.notFound);
    this.assertCompanyAccess(user, mr.companyId);

    if (mr.status !== MaterialRequestStatus.APPROVED) {
      throw new BadRequestException(ERR.materialRequests.cannotConvertNotApproved);
    }
    if (!dto.vendorId) {
      throw new BadRequestException(ERR.materialRequests.vendorRequired);
    }
    assertTransitionOrThrow(mr.status, MaterialRequestStatus.CONVERTED);

    const poNumber = await nextSequentialNumber(this.prisma, 'purchaseOrder', 'PO', mr.companyId);
    const totalRequestedQty = mr.lineItems.reduce((sum, li) => sum + li.quantity, 0);

    const po = await this.prisma.$transaction(async (tx) => {
      const createdPo = await tx.purchaseOrder.create({
        data: {
          poNumber,
          companyId: mr.companyId,
          projectId: mr.projectId,
          vendorId: dto.vendorId,
          createdByUserId: user.id,
          status: PoStatus.DRAFT,
          poType: PoType.STANDARD,
          sourceOfCreation: PoSourceOfCreation.MATERIAL_REQUEST,
          deliveryLocationId: mr.deliveryLocationId,
          subtotal: 0,
          totalAmount: 0,
          lineItemCount: mr.lineItems.length,
          totalRequestedQty,
          lineItems: {
            // unitPrice / lineTotal default to 0 — filled in during PO edit since
            // the MR carries no pricing.
            create: mr.lineItems.map((li, idx) => ({
              lineNumber: idx + 1,
              materialId: li.materialId,
              description: li.description ?? li.materialName,
              quantityOrdered: li.quantity,
              unitOfMeasure: li.unit,
              unitPrice: 0,
              lineTotal: 0,
              expectedDeliveryDate: li.expectedDeliveryDate,
              deliveryLocationId: li.deliveryLocationId,
              notes: li.notes,
            })),
          },
        },
        select: { id: true, poNumber: true },
      });

      await tx.materialRequest.update({
        where: { id },
        data: {
          status: MaterialRequestStatus.CONVERTED,
          convertedToPoId: createdPo.id,
          convertedAt: new Date(),
        },
      });

      return createdPo;
    });

    await this.auditMr(AuditAction.MATERIAL_REQUEST_CONVERTED, id, user, {
      from: MaterialRequestStatus.APPROVED,
      to: MaterialRequestStatus.CONVERTED,
      target: 'PO',
      poId: po.id,
    });

    return { poId: po.id, poNumber: po.poNumber };
  }

  // ── Audit trail ───────────────────────────────────────────────────────────────

  /**
   * Chronological audit trail for a single MR (activity timeline feed). Returns
   * every `MaterialRequest`-targeted audit entry oldest-first, with the
   * performing user resolved. Scoped the same way the lifecycle mutations are.
   * Mirrors PoStatusService.getAuditTrail.
   */
  async getAuditTrail(id: string, user: AuthenticatedUser) {
    const mr = await this.prisma.materialRequest.findUnique({
      where: { id },
      select: { id: true, companyId: true },
    });
    if (!mr) throw new NotFoundException(ERR.materialRequests.notFound);
    this.assertCompanyAccess(user, mr.companyId);

    const logs = await this.prisma.auditLog.findMany({
      where: { targetType: 'MaterialRequest', targetId: id },
      orderBy: { createdAt: 'asc' },
      include: { performedBy: { select: { id: true, name: true, email: true } } },
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      metadata: log.metadata,
      performedBy: log.performedBy
        ? { id: log.performedBy.id, name: log.performedBy.name, email: log.performedBy.email }
        : null,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** Scoped fetch of the minimal MR fields needed to drive a status transition. */
  private async findForTransition(id: string, user: AuthenticatedUser) {
    const mr = await this.prisma.materialRequest.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true, requestedById: true },
    });
    if (!mr) throw new NotFoundException(ERR.materialRequests.notFound);
    this.assertCompanyAccess(user, mr.companyId);
    return mr;
  }

  private assertCompanyAccess(user: AuthenticatedUser, companyId: string): void {
    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }
  }

  /** True when the caller's role holds `materialRequest.approve`. */
  private async userCanApprove(user: AuthenticatedUser): Promise<boolean> {
    if (user.role === UserRole.SUPER_ADMIN) return true;
    return this.permissions.roleHasPermission(user.role, 'materialRequest.approve');
  }

  /** Next "MR-00001" number for a company, sequential by existing MR count. */
  private async nextMrNumber(companyId: string): Promise<string> {
    const count = await this.prisma.materialRequest.count({ where: { companyId } });
    return `MR-${String(count + 1).padStart(5, '0')}`;
  }

  /**
   * Each line must carry a catalogue material id OR a free-text name, and every
   * referenced catalogue material id must exist (mirrors RfqsService line-item
   * validation, FOR-204).
   */
  private async assertLineItemsValid(lineItems: CreateMrLineItemDto[]): Promise<void> {
    if (lineItems.some((li) => !li.materialId && !li.materialName?.trim())) {
      throw new BadRequestException(ERR.materialRequests.invalidLineItem);
    }
    const materialIds = [
      ...new Set(lineItems.map((li) => li.materialId).filter((mid): mid is string => Boolean(mid))),
    ];
    if (materialIds.length === 0) return;
    const materials = await this.prisma.material.findMany({
      where: { id: { in: materialIds } },
      select: { id: true },
    });
    if (materials.length !== materialIds.length) {
      throw new BadRequestException(ERR.materialRequests.invalidMaterialIds);
    }
  }

  /**
   * Every delivery location referenced (header default + each line) must belong
   * to the MR's project. Skips the query when none is provided.
   */
  private async assertDeliveryLocationsInProject(
    dto: { deliveryLocationId?: string; lineItems?: CreateMrLineItemDto[] },
    projectId: string,
  ): Promise<void> {
    const locationIds = [
      ...new Set(
        [
          dto.deliveryLocationId,
          ...(dto.lineItems ?? []).map((li) => li.deliveryLocationId),
        ].filter((lid): lid is string => Boolean(lid?.trim())),
      ),
    ];
    if (locationIds.length === 0) return;

    const locations = await this.prisma.projectLocation.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, projectId: true },
    });
    const validIds = new Set(
      locations.filter((loc) => loc.projectId === projectId).map((loc) => loc.id),
    );
    if (locationIds.some((lid) => !validIds.has(lid))) {
      throw new BadRequestException(ERR.materialRequests.invalidDeliveryLocation);
    }
  }

  /** Map a line-item DTO to a Prisma nested-create input. */
  private toLineItemCreate(
    li: CreateMrLineItemDto,
  ): Prisma.MaterialRequestLineItemCreateWithoutMaterialRequestInput {
    return {
      material: li.materialId ? { connect: { id: li.materialId } } : undefined,
      materialName: li.materialName ?? null,
      description: li.description ?? null,
      quantity: li.quantity,
      unit: li.unit,
      priority: li.priority ?? null,
      expectedDeliveryDate: li.expectedDeliveryDate ? new Date(li.expectedDeliveryDate) : null,
      deliveryLocation: li.deliveryLocationId
        ? { connect: { id: li.deliveryLocationId } }
        : undefined,
      notes: li.notes ?? null,
    };
  }

  /** Serialise a fully-included MR row into the detail response shape. */
  private toDetail(mr: Prisma.MaterialRequestGetPayload<{ include: typeof MR_DETAIL_INCLUDE }>) {
    return {
      id: mr.id,
      mrNumber: mr.mrNumber,
      status: mr.status,
      priority: mr.priority,
      projectId: mr.projectId,
      project: { id: mr.project.id, name: mr.project.name },
      company: { id: mr.company.id, name: mr.company.legalName },
      requestedBy: {
        id: mr.requestedBy.id,
        name: mr.requestedBy.name,
        email: mr.requestedBy.email,
      },
      reviewedBy: mr.reviewedBy
        ? { id: mr.reviewedBy.id, name: mr.reviewedBy.name, email: mr.reviewedBy.email }
        : null,
      reviewedAt: mr.reviewedAt?.toISOString() ?? null,
      declineReason: mr.declineReason,
      neededByDate: mr.neededByDate?.toISOString() ?? null,
      deliveryLocationId: mr.deliveryLocationId,
      deliveryLocation: mr.deliveryLocation
        ? (mr.deliveryLocation.label ?? mr.deliveryLocation.address)
        : null,
      note: mr.note,
      convertedToRfq: mr.convertedToRfq
        ? { id: mr.convertedToRfq.id, rfqNumber: mr.convertedToRfq.rfqNumber }
        : null,
      convertedToPo: mr.convertedToPo
        ? { id: mr.convertedToPo.id, poNumber: mr.convertedToPo.poNumber }
        : null,
      convertedAt: mr.convertedAt?.toISOString() ?? null,
      lineItems: mr.lineItems.map((li) => ({
        id: li.id,
        materialId: li.materialId,
        materialName: li.material?.name ?? li.materialName,
        description: li.description,
        quantity: li.quantity,
        unit: li.unit,
        priority: li.priority,
        expectedDeliveryDate: li.expectedDeliveryDate?.toISOString() ?? null,
        deliveryLocationId: li.deliveryLocationId,
        deliveryLocation: li.deliveryLocation
          ? (li.deliveryLocation.label ?? li.deliveryLocation.address)
          : null,
        notes: li.notes,
      })),
      createdAt: mr.createdAt.toISOString(),
      updatedAt: mr.updatedAt.toISOString(),
    };
  }
}
