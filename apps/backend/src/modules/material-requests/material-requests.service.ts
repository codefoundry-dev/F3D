import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApprovalEntityType,
  AuditAction,
  MaterialRequestStatus,
  NotificationEntityType,
  NotificationType,
  PoSourceOfCreation,
  PoStatus,
  PoType,
  Prisma,
  RfqStatus,
  UserRole,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  ApprovalAuthorizationService,
  PermissionsService,
  type ApproverPoolMember,
} from '../../common/permissions';
import {
  loadMaterialSnapshots,
  resolveMaterialSnapshot,
} from '../../common/utils/material-snapshot.util';
import { nextSequentialNumber } from '../../common/utils/sequential-number.util';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { AuditService } from '../audit/audit.service';
import { BrandingService } from '../export/branding.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationService } from '../notification-feed/notification.service';
import { SYSTEM_SENDER } from '../notification-feed/notification.types';
import { EmailService } from '../notifications/email.service';
import { loadCompanyPoTerms } from '../purchase-orders/po-terms.util';
import { assertVendorUsableOnProject } from '../vendors/vendor-access.util';

import {
  ConvertToPoDto,
  ConvertToRfqDto,
  CreateMaterialRequestDto,
  CreateMrLineItemDto,
  DeclineMaterialRequestDto,
  ListMaterialRequestQueryDto,
  SubmitMaterialRequestDto,
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
      material: { select: { id: true, name: true, uom: true, imageUrl: true } },
      deliveryLocation: { select: { id: true, label: true, address: true } },
    },
  },
} satisfies Prisma.MaterialRequestInclude;

/** The MR fields the pending-approval email lists beyond its number + project. */
const MR_EMAIL_DETAIL_SELECT = {
  priority: true,
  neededByDate: true,
  requestedBy: { select: { name: true } },
} satisfies Prisma.MaterialRequestSelect;

@Injectable()
export class MaterialRequestsService {
  private readonly logger = new Logger(MaterialRequestsService.name);
  private readonly webAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly permissions: PermissionsService,
    private readonly inventoryService: InventoryService,
    private readonly approvals: ApprovalsService,
    private readonly approvalAuth: ApprovalAuthorizationService,
    private readonly emailService: EmailService,
    private readonly notifications: NotificationService,
    private readonly branding: BrandingService,
    config: ConfigService,
  ) {
    this.webAppUrl = config.get<string>('WEB_APP_URL', 'http://localhost:5179');
  }

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
    const mrNumber = await nextSequentialNumber(this.prisma, 'materialRequest', 'MR', companyId);

    // FOR-347: the one-shot create is the wizard's submit door, so nominees ride
    // on it. Vet them against the Pool BEFORE creating anything — a bad id is a
    // 400 with no MR, not a submitted MR with dropped routing. A draft has no
    // routing moment, so nominees without submit are a caller error.
    const nomineeIds = dto.nomineeIds ?? [];
    if (!submit && nomineeIds.length > 0) {
      throw new BadRequestException(ERR.materialRequests.nomineesRequireSubmit);
    }
    let pool: ApproverPoolMember[] = [];
    if (submit) {
      pool = await this.resolveMrApproverPool(companyId, user.id);
      if (nomineeIds.length > 0) {
        await this.approvals.assertNomineesInPool(companyId, pool, nomineeIds);
      }
    }

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

      // Persist the routing choice before notifying, and await it: a Nomination
      // is part of the document's record, not a best-effort side effect like
      // the email itself (mirrors PoStatusService.issuePurchaseOrder).
      if (nomineeIds.length > 0) {
        await this.approvals.recordNominationsAtSubmit(
          ApprovalEntityType.MATERIAL_REQUEST,
          created.id,
          companyId,
          pool,
          nomineeIds,
          user.id,
        );
      }
      this.notifyApproversOfPendingMr(created.id, companyId, pool).catch(() => {});
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

  async submit(id: string, user: AuthenticatedUser, dto?: SubmitMaterialRequestDto) {
    const mr = await this.findForTransition(id, user);
    assertTransitionOrThrow(mr.status, MaterialRequestStatus.SUBMITTED);

    // FOR-347: resolve the Pool and vet the nominees BEFORE the transition, so
    // an id outside the Pool is a 400 on a still-DRAFT request rather than a
    // half-submitted one. The Pool depends on the company only (an MR has no
    // amount), so it is the same set either side of the status change.
    const nomineeIds = dto?.nomineeIds ?? [];
    const pool = await this.resolveMrApproverPool(mr.companyId, mr.requestedById);
    if (nomineeIds.length > 0) {
      await this.approvals.assertNomineesInPool(mr.companyId, pool, nomineeIds);
    }

    await this.prisma.materialRequest.update({
      where: { id },
      data: { status: MaterialRequestStatus.SUBMITTED },
    });
    await this.auditMr(AuditAction.MATERIAL_REQUEST_SUBMITTED, id, user, {
      from: mr.status,
      to: MaterialRequestStatus.SUBMITTED,
    });

    // Persist the routing choice before notifying, and await it: a Nomination
    // is part of the document's record, not a best-effort side effect.
    if (nomineeIds.length > 0) {
      await this.approvals.recordNominationsAtSubmit(
        ApprovalEntityType.MATERIAL_REQUEST,
        id,
        mr.companyId,
        pool,
        nomineeIds,
        user.id,
      );
    }

    // Notify the users entitled to approve this MR (fire-and-forget). Nominees,
    // when the requester chose any, narrow *who is notified* — never who may
    // approve.
    this.notifyApproversOfPendingMr(id, mr.companyId, pool).catch(() => {});

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
        requestedById: true,
        deliveryLocationId: true,
        lineItems: {
          select: { id: true, materialId: true, quantity: true, deliveryLocationId: true },
        },
      },
    });
    if (!mr) throw new NotFoundException(ERR.materialRequests.notFound);
    this.assertCompanyAccess(user, mr.companyId);
    // FOR-349: separation of duties — whatever grant the requester holds,
    // another authorised user must resolve their request. Same identity-first
    // ordering as cancel: who you are disqualifies you before status is judged.
    if (mr.requestedById === user.id) {
      throw new ForbiddenException(ERR.materialRequests.cannotReviewOwn);
    }
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

    await this.autoConvertToRfq(mr, issued, user);

    return this.get(id, user);
  }

  /**
   * FOR-396: a company that opted in gets the approved MR's draft RFQ straight
   * away, so buyers don't have to press "Convert to RFQ". This is skipped when
   * stock covered every line (nothing is left to buy). A failure leaves the MR
   * approved and convertible by hand; the approval itself has already committed.
   */
  private async autoConvertToRfq(
    mr: { id: string; companyId: string; lineItems: { id: string; quantity: number }[] },
    issued: { lineId: string; issued: number }[],
    user: AuthenticatedUser,
  ): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: mr.companyId },
      select: { autoConvertApprovedMrToRfq: true },
    });
    if (!company?.autoConvertApprovedMrToRfq) return;

    const issuedByLine = new Map(issued.map((i) => [i.lineId, i.issued]));
    const coveredFromStock = mr.lineItems.every(
      (li) => (issuedByLine.get(li.id) ?? 0) >= li.quantity,
    );
    if (coveredFromStock) return;

    try {
      await this.convertToRfq(mr.id, user);
    } catch (err) {
      this.logger.warn(
        `Auto-convert of approved MR ${mr.id} to RFQ failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── Decline (SUBMITTED → DECLINED, reason required) ───────────────────────────

  async decline(id: string, user: AuthenticatedUser, dto: DeclineMaterialRequestDto) {
    const mr = await this.findForTransition(id, user);
    // FOR-349: declining is the other half of the review act (it records the
    // caller as the reviewer), so the requester is barred from it too — their
    // own way out of a submitted request is cancel.
    if (mr.requestedById === user.id) {
      throw new ForbiddenException(ERR.materialRequests.cannotReviewOwn);
    }
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
    // Snapshot the catalogue codes from each line's material onto the new RFQ
    // lines (MR lines don't carry these; they default from the material).
    const materialSnapshots = await loadMaterialSnapshots(
      this.prisma,
      mr.lineItems.map((li) => li.materialId),
    );

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
            create: mr.lineItems.map((li) => {
              // MR lines carry none of the codes themselves — they default purely
              // from the linked material.
              const snapshot = resolveMaterialSnapshot({}, li.materialId, materialSnapshots);
              return {
                materialId: li.materialId,
                materialName: li.materialName,
                description: li.description,
                quantity: li.quantity,
                unit: li.unit,
                costCode: snapshot.costCode,
                upc: snapshot.upc,
                manufacturerPartNumber: snapshot.manufacturerPartNumber,
                taxCode: snapshot.taxCode,
                expectedDeliveryDate: li.expectedDeliveryDate,
                deliveryTime: li.deliveryTime,
                deliveryLocationId: li.deliveryLocationId,
                notes: li.notes,
              };
            }),
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
    await assertVendorUsableOnProject(this.prisma, dto.vendorId, mr.companyId, mr.projectId);
    assertTransitionOrThrow(mr.status, MaterialRequestStatus.CONVERTED);

    const poNumber = await nextSequentialNumber(this.prisma, 'purchaseOrder', 'PO', mr.companyId);
    const totalRequestedQty = mr.lineItems.reduce((sum, li) => sum + li.quantity, 0);
    // Snapshot the catalogue codes from each line's material onto the new PO
    // lines (MR lines don't carry these; they default from the material).
    const materialSnapshots = await loadMaterialSnapshots(
      this.prisma,
      mr.lineItems.map((li) => li.materialId),
    );

    const termsAndConditions = await loadCompanyPoTerms(this.prisma, mr.companyId);

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
          // The requester's needed-by date becomes the PO's planned delivery
          // date — the PO has no separate "need by", and without this the date
          // the MR was raised against was silently lost on conversion.
          plannedDeliveryDate: mr.neededByDate,
          termsAndConditions,
          subtotal: 0,
          totalAmount: 0,
          lineItemCount: mr.lineItems.length,
          totalRequestedQty,
          lineItems: {
            // unitPrice / lineTotal default to 0 — filled in during PO edit since
            // the MR carries no pricing.
            create: mr.lineItems.map((li, idx) => {
              // MR lines carry none of the codes themselves — they default purely
              // from the linked material.
              const snapshot = resolveMaterialSnapshot({}, li.materialId, materialSnapshots);
              return {
                lineNumber: idx + 1,
                materialId: li.materialId,
                description: li.description ?? li.materialName,
                quantityOrdered: li.quantity,
                unitOfMeasure: li.unit,
                unitPrice: 0,
                lineTotal: 0,
                costCode: snapshot.costCode,
                upc: snapshot.upc,
                manufacturerPartNumber: snapshot.manufacturerPartNumber,
                taxCode: snapshot.taxCode,
                expectedDeliveryDate: li.expectedDeliveryDate,
                deliveryTime: li.deliveryTime,
                deliveryLocationId: li.deliveryLocationId,
                notes: li.notes,
              };
            }),
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

  // ── Approver routing (FOR-347) ──────────────────────────────────────────────

  /**
   * Nominate further Approver Pool members on an MR already awaiting approval
   * (the unresponsive-approver remedy, mirroring PoStatusService). Routed
   * through this service rather than ApprovalsService directly because the
   * nominee has to be *notified*, and the MR's email templates live here.
   */
  async nominateApprovers(id: string, userIds: string[], user: AuthenticatedUser) {
    const { view, notify } = await this.approvals.addNominations(
      ApprovalEntityType.MATERIAL_REQUEST,
      id,
      userIds,
      user,
    );

    if (notify.length > 0) {
      // Best-effort: a mail failure must not undo a recorded nomination.
      this.notifyNominatedApprovers(id, notify, user.id).catch(() => {});
    }

    return view;
  }

  /**
   * The MR Approver Pool: every ACTIVE company user whose effective grant
   * includes `materialRequest.approve`. The key is not threshold-aware and an
   * MR carries no amount, so — unlike the PO/Invoice Pools — this is grant
   * membership, not cap coverage (ADR-0006 amendment, FOR-347).
   *
   * The requester is excluded even when they hold the grant (FOR-349):
   * separation of duties says another authorised user must approve, so they
   * are neither a valid nominee nor a pending-approval notification target
   * for their own request.
   */
  private async resolveMrApproverPool(
    companyId: string,
    requesterId: string,
  ): Promise<ApproverPoolMember[]> {
    const pool = await this.approvalAuth.resolveApproverPool(
      companyId,
      'materialRequest.approve',
      null,
    );
    return pool.filter((m) => m.id !== requesterId);
  }

  /**
   * Email + in-app-notify the users entitled to approve a just-submitted MR.
   * Best-effort, called fire-and-forget. Mirrors notifyApproversOfPendingPo,
   * minus the amount (an MR has none — the project name stands in as context).
   */
  private async notifyApproversOfPendingMr(
    mrId: string,
    companyId: string,
    resolvedPool?: ApproverPoolMember[],
  ): Promise<void> {
    const mr = await this.prisma.materialRequest.findUnique({
      where: { id: mrId },
      select: {
        mrNumber: true,
        requestedById: true,
        ...MR_EMAIL_DETAIL_SELECT,
        project: { select: { name: true } },
      },
    });
    if (!mr) return;

    // The submit path has already resolved the Pool to vet nominees against it;
    // re-resolving here would be a second identical set of queries.
    const pool = resolvedPool ?? (await this.resolveMrApproverPool(companyId, mr.requestedById));

    const viewUrl = `${this.webAppUrl}/material-requests/${mrId}`;
    const log = { companyId };
    const brand = await this.branding.getEmailBrand(companyId);

    // An empty Pool means the MR is already SUBMITTED with nobody able to
    // approve it. Tell the Company Admins so the grant can be assigned, and the
    // requester so the submit is not a silent success (FOR-302 precedent).
    if (pool.length === 0) {
      await this.notifyMrApprovalUnroutable(
        mrId,
        companyId,
        mr.mrNumber,
        mr.requestedById,
        mr.project.name,
        viewUrl,
        log,
        brand,
      );
      return;
    }

    // Nominating narrows the fan-out to the nominees. Everyone else in the Pool
    // keeps full authority and still sees the MR under the awaiting-approval
    // list filter — that queue is the safety net this narrowing leans on.
    const targets = await this.approvals.resolveNotificationTargets(
      ApprovalEntityType.MATERIAL_REQUEST,
      mrId,
      pool,
    );
    const recipients = [...new Set(targets.map((m) => m.email))];

    await this.emailPendingMr(mr, recipients, targets, viewUrl, log, brand);

    await this.notifications.createForEmails(recipients, {
      type: NotificationType.MATERIAL_REQUEST_PENDING_APPROVAL,
      title: 'Material request awaiting approval',
      body: `Material request ${mr.mrNumber} for ${mr.project.name} needs your approval.`,
      entityType: NotificationEntityType.MATERIAL_REQUEST,
      entityId: mrId,
      sender: { userId: mr.requestedById },
    });
  }

  /**
   * Tell newly nominated Pool members that an MR is waiting on them.
   * Deliberately the same MATERIAL_REQUEST_PENDING_APPROVAL notification the
   * submit-time fan-out sends: a separate "you were nominated" type would imply
   * the nomination granted them something. It did not.
   */
  private async notifyNominatedApprovers(
    mrId: string,
    nominees: ApproverPoolMember[],
    nominatedByUserId: string,
  ): Promise<void> {
    const mr = await this.prisma.materialRequest.findUnique({
      where: { id: mrId },
      select: {
        mrNumber: true,
        companyId: true,
        ...MR_EMAIL_DETAIL_SELECT,
        project: { select: { name: true } },
      },
    });
    if (!mr) return;

    const viewUrl = `${this.webAppUrl}/material-requests/${mrId}`;
    const log = { companyId: mr.companyId };
    const brand = await this.branding.getEmailBrand(mr.companyId);
    const recipients = [...new Set(nominees.map((n) => n.email))];

    await this.emailPendingMr(mr, recipients, nominees, viewUrl, log, brand);

    await this.notifications.createForEmails(recipients, {
      type: NotificationType.MATERIAL_REQUEST_PENDING_APPROVAL,
      title: 'Material request awaiting approval',
      body: `Material request ${mr.mrNumber} for ${mr.project.name} needs your approval.`,
      entityType: NotificationEntityType.MATERIAL_REQUEST,
      entityId: mrId,
      sender: { userId: nominatedByUserId },
    });
  }

  /**
   * Send the pending-approval email to each recipient, greeting them by name
   * and listing the request details (client format, Nov 2026).
   */
  private async emailPendingMr(
    mr: {
      mrNumber: string;
      priority: string;
      neededByDate: Date | null;
      requestedBy: { name: string } | null;
      project: { name: string };
    },
    recipients: string[],
    people: ReadonlyArray<{ email: string; name: string }>,
    viewUrl: string,
    log: { companyId: string },
    brand: Awaited<ReturnType<BrandingService['getEmailBrand']>>,
  ): Promise<void> {
    const nameByEmail = new Map(people.map((p) => [p.email, p.name]));
    await Promise.all(
      recipients.map((email) =>
        this.emailService.sendMaterialRequestPendingApprovalEmail(
          email,
          mr.mrNumber,
          mr.project.name,
          viewUrl,
          log,
          brand,
          {
            recipientName: nameByEmail.get(email) ?? null,
            requesterName: mr.requestedBy?.name ?? null,
            requiredBy: mr.neededByDate,
            priority: mr.priority,
          },
        ),
      ),
    );
  }

  /**
   * Fallback fan-out for an MR whose Approver Pool is empty: nobody in the
   * company holds `materialRequest.approve`. Company Admins are notified as
   * *recipients* — the way out is granting the permission under Roles &
   * permissions, not raising a limit (there is no amount here). The requester
   * is told too, so submitting into a dead state is never a silent success.
   */
  private async notifyMrApprovalUnroutable(
    mrId: string,
    companyId: string,
    mrNumber: string,
    requestedById: string,
    projectName: string,
    viewUrl: string,
    log: { companyId: string },
    brand: Awaited<ReturnType<BrandingService['getEmailBrand']>>,
  ): Promise<void> {
    const admins = await this.approvalAuth.findCompanyAdminRecipients(companyId);
    const adminEmails = [...new Set(admins.map((a) => a.email))];

    const title = 'Material request has no eligible approver';
    const body =
      `Material request ${mrNumber} for ${projectName} is awaiting approval, but no one ` +
      `in your company is eligible to approve it — a requester can never approve their ` +
      `own request. Grant the approval permission to another user under Roles & ` +
      `permissions to move it forward.`;

    await Promise.all(
      adminEmails.map((email) =>
        this.emailService.sendMaterialRequestApprovalUnroutableEmail(
          email,
          mrNumber,
          projectName,
          viewUrl,
          log,
          brand,
        ),
      ),
    );

    await this.notifications.createForEmails(adminEmails, {
      type: NotificationType.MATERIAL_REQUEST_APPROVAL_UNROUTABLE,
      title,
      body,
      entityType: NotificationEntityType.MATERIAL_REQUEST,
      entityId: mrId,
      sender: SYSTEM_SENDER,
    });

    // The requester gets the same signal in-app even when they are not an
    // admin; skip when they were already reached as one.
    const requesterIsAdmin = admins.some((a) => a.id === requestedById);
    if (!requesterIsAdmin) {
      await this.notifications.createForUsers({
        userIds: [requestedById],
        type: NotificationType.MATERIAL_REQUEST_APPROVAL_UNROUTABLE,
        title,
        body,
        entityType: NotificationEntityType.MATERIAL_REQUEST,
        entityId: mrId,
        sender: SYSTEM_SENDER,
      });
    }
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

  /** True when the caller holds `materialRequest.approve` (custom-role-first). */
  private async userCanApprove(user: AuthenticatedUser): Promise<boolean> {
    if (user.role === UserRole.SUPER_ADMIN) return true;
    return this.permissions.userHasPermission(user, 'materialRequest.approve');
  }

  /** Next "MR-00001" number for a company, sequential by existing MR count. */
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
      deliveryTime: li.deliveryTime ?? null,
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
        imageUrl: li.material?.imageUrl ?? null,
        description: li.description,
        quantity: li.quantity,
        unit: li.unit,
        priority: li.priority,
        expectedDeliveryDate: li.expectedDeliveryDate?.toISOString() ?? null,
        deliveryTime: li.deliveryTime,
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
