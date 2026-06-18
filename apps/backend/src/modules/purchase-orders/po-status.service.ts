import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessTokenPurpose,
  AccessTokenSubject,
  AuditAction,
  ApprovalStatus,
  PoStatus as PrismaPoStatus,
  Prisma,
  UserRole,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApprovalAuthorizationService } from '../../common/permissions';
import { resolveVendorEmailRecipients } from '../../common/utils/vendor-recipients.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessTokensService } from '../access-tokens/access-tokens.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { EmailService } from '../notifications/email.service';

import { PoExportService } from './po-export.service';
import { assertTransition } from './po-state-machine';
import { DeclinePoDto, ReceivePoDto } from './po-status.dto';
import { VendorAcceptPoDto, VendorDeclinePoDto } from './po-vendor.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

/**
 * Lifetime of a tokenised vendor PO link. A fixed 30-day cap — a deliberate
 * deviation from the base ADR's "lifetime of the document" rule, per the
 * ADR-0002 Release-1 PO token amendment (2026-06-16). The window comfortably
 * covers acknowledge/accept (which happen within days); later lifecycle actions
 * (delivery confirmation, change-request reply, …) will re-issue a fresh token.
 */
const PO_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Lifetime of a public QR delivery-submission link (Epic 6). 90 days — the link
 * is printed on paperwork / shown as a QR and must outlast the whole delivery
 * window; like PO_VIEW it is validated, never consumed, and re-mintable.
 */
const DELIVERY_LINK_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/** Minimal PO shape the delivery-delta applier needs (close-out leg). */
export interface DeliveryDeltaPo {
  id: string;
  status: PrismaPoStatus;
  companyId: string;
  deliveryLocationId: string | null;
  lineItems: Array<{
    id: string;
    quantityOrdered: number;
    quantityDelivered: number;
    materialId: string | null;
    deliveryLocationId: string | null;
  }>;
}

/** Outcome of applying delivery deltas to a PO — drives the post-commit audit. */
export interface DeliveryDeltaOutcome {
  transitioned: boolean;
  fromStatus: PrismaPoStatus;
  nextStatus: PrismaPoStatus;
}

@Injectable()
export class PoStatusService {
  private readonly logger = new Logger(PoStatusService.name);
  private readonly webAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PurchaseOrdersService))
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly emailService: EmailService,
    private readonly poExportService: PoExportService,
    private readonly approvalAuth: ApprovalAuthorizationService,
    private readonly auditService: AuditService,
    private readonly inventoryService: InventoryService,
    private readonly accessTokens: AccessTokensService,
    config: ConfigService,
  ) {
    this.webAppUrl = config.get<string>('WEB_APP_URL', 'http://localhost:5179');
  }

  /**
   * Best-effort audit of a PO status transition. Never throws — a logging
   * failure must not fail the (already persisted) status change, matching the
   * fire-and-forget convention used elsewhere (po-change.service.ts).
   */
  private async auditTransition(
    action: AuditAction,
    poId: string,
    user: AuthenticatedUser,
    from: PrismaPoStatus,
    to: PrismaPoStatus,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.auditService.log({
        action,
        performedById: user.id,
        targetType: 'PurchaseOrder',
        targetId: poId,
        metadata: { from, to, ...(extra ?? {}) },
      });
    } catch (err) {
      this.logger.debug(
        `Failed to audit PO transition ${from}→${to}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // ── Issue Purchase Order ───────────────────────────────────────────────

  async issuePurchaseOrder(id: string, user: AuthenticatedUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true, totalAmount: true, currency: true },
    });

    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== po.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (po.status !== PrismaPoStatus.DRAFT) {
      throw new BadRequestException(ERR.purchaseOrders.cannotIssue(po.status));
    }

    // FOR-210: approval-gated sending. SUPER_ADMIN always sends directly.
    // Otherwise evaluate the user's `po.approve` threshold against the PO total:
    //  - allowed       → send the PO to the vendor (DRAFT → SENT)
    //  - belowThreshold → over the cap; route for internal approval
    //  - notGranted     → role can't self-approve; route for internal approval
    let requiresApproval = false;
    if (user.role !== UserRole.SUPER_ADMIN) {
      const decision = await this.approvalAuth.evaluate(user.role, 'po.approve', po.totalAmount);
      requiresApproval = decision.outcome !== 'allowed';
    }

    if (requiresApproval) {
      // Hold for internal approval — do NOT notify the vendor or set issuedAt.
      assertTransition(po.status, PrismaPoStatus.PENDING_APPROVAL);
      await this.prisma.purchaseOrder.update({
        where: { id },
        data: {
          status: PrismaPoStatus.PENDING_APPROVAL,
          approvalStatus: ApprovalStatus.PENDING,
          lastModifiedById: user.id,
        },
      });

      await this.auditTransition(
        AuditAction.PO_ISSUED,
        id,
        user,
        po.status,
        PrismaPoStatus.PENDING_APPROVAL,
        { requiresApproval: true },
      );

      // Notify the company users entitled to approve this PO (fire-and-forget).
      this.notifyApproversOfPendingPo(id, po.companyId, po.totalAmount, po.currency).catch(
        () => {},
      );

      return this.purchaseOrdersService.getPurchaseOrder(id, user);
    }

    assertTransition(po.status, PrismaPoStatus.SENT);
    // Mint the tokenised vendor PO link in the same transaction as the
    // DRAFT→SENT transition so a later best-effort email failure cannot leave
    // the PO sent without a usable link (ADR-0002 R1 PO token amendment).
    const { updated, poViewToken } = await this.prisma.$transaction(async (tx) => {
      const sent = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: PrismaPoStatus.SENT,
          issuedAt: new Date(),
          lastModifiedById: user.id,
        },
        include: {
          vendor: {
            select: {
              id: true,
              contactEmail: true,
              users: { where: { role: UserRole.VENDOR }, select: { email: true } },
            },
          },
        },
      });
      const issued = await this.accessTokens.issueTokenIfNoneLive(
        {
          subjectType: AccessTokenSubject.PURCHASE_ORDER,
          subjectId: id,
          purpose: AccessTokenPurpose.PO_VIEW,
          ttlMs: PO_TOKEN_TTL_MS,
          createdByUserId: user.id,
        },
        tx,
      );
      return { updated: sent, poViewToken: issued.token };
    });

    await this.auditTransition(AuditAction.PO_ISSUED, id, user, po.status, PrismaPoStatus.SENT);

    // Send email notification to vendor with PDF attachment (fire-and-forget).
    // The "View" link is chosen per vendor state inside notifyVendorOfPo.
    this.notifyVendorOfPo(id, updated.poNumber, updated.vendor, user, poViewToken).catch(() => {});

    return this.purchaseOrdersService.getPurchaseOrder(id, user);
  }

  // ── Confirm Purchase Order (Vendor) ──────────────────────────────────────

  async confirmPurchaseOrder(id: string, user: AuthenticatedUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, status: true, vendorId: true },
    });

    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    // Vendor can only confirm POs addressed to their company
    if (user.companyId !== po.vendorId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (po.status !== PrismaPoStatus.SENT) {
      throw new BadRequestException(ERR.purchaseOrders.cannotConfirm(po.status));
    }

    assertTransition(po.status, PrismaPoStatus.ACKNOWLEDGED);
    await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PrismaPoStatus.ACKNOWLEDGED,
        lastModifiedById: user.id,
      },
    });

    await this.auditTransition(
      AuditAction.PO_ACKNOWLEDGED,
      id,
      user,
      po.status,
      PrismaPoStatus.ACKNOWLEDGED,
    );

    return this.purchaseOrdersService.getPurchaseOrder(id, user);
  }

  // ── Approve Purchase Order ───────────────────────────────────────────────

  async approvePurchaseOrder(id: string, user: AuthenticatedUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        companyId: true,
        totalAmount: true,
        currency: true,
      },
    });

    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== po.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (
      po.status !== PrismaPoStatus.DRAFT &&
      po.status !== PrismaPoStatus.SENT &&
      po.status !== PrismaPoStatus.PENDING_APPROVAL
    ) {
      throw new BadRequestException(ERR.purchaseOrders.cannotApprove(po.status));
    }

    // SUPER_ADMIN bypasses threshold checks — the role exists to break the
    // glass on otherwise-locked workflows, and approval still records who
    // performed it via approvedById for audit. For everyone else the approver
    // must be authorized for the PO total.
    if (user.role !== UserRole.SUPER_ADMIN) {
      const decision = await this.approvalAuth.evaluate(user.role, 'po.approve', po.totalAmount);
      if (decision.outcome === 'belowThreshold') {
        throw new ForbiddenException(
          ERR.purchaseOrders.approvalThresholdExceeded(
            (po.totalAmount ?? 0).toString(),
            decision.threshold.toString(),
            po.currency,
          ),
        );
      }
      if (decision.outcome === 'notGranted') {
        throw new ForbiddenException(ERR.general.accessDenied);
      }
    }

    // FOR-210: approving a PENDING_APPROVAL PO completes the held send — the PO
    // goes out to the vendor (→ SENT, issuedAt set, vendor notified). Any other
    // approvable status keeps the legacy → ACKNOWLEDGED behavior.
    const isPendingApprovalSend = po.status === PrismaPoStatus.PENDING_APPROVAL;
    const nextStatus = isPendingApprovalSend ? PrismaPoStatus.SENT : PrismaPoStatus.ACKNOWLEDGED;

    assertTransition(po.status, nextStatus);
    const { updated, poViewToken } = await this.prisma.$transaction(async (tx) => {
      const approved = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: nextStatus,
          approvalStatus: ApprovalStatus.APPROVED,
          approvedById: user.id,
          lastModifiedById: user.id,
          ...(isPendingApprovalSend && { issuedAt: new Date() }),
        },
        include: {
          project: { select: { name: true } },
          vendor: {
            select: {
              legalName: true,
              contactEmail: true,
              users: { where: { role: UserRole.VENDOR }, select: { email: true } },
            },
          },
        },
      });

      // Approving a held PO completes the send (→ SENT): mint the tokenised
      // vendor link atomically, mirroring the direct-issue path. Other approvable
      // statuses (→ ACKNOWLEDGED) do not send to the vendor, so no token.
      const issuedToken = isPendingApprovalSend
        ? (
            await this.accessTokens.issueTokenIfNoneLive(
              {
                subjectType: AccessTokenSubject.PURCHASE_ORDER,
                subjectId: id,
                purpose: AccessTokenPurpose.PO_VIEW,
                ttlMs: PO_TOKEN_TTL_MS,
                createdByUserId: user.id,
              },
              tx,
            )
          ).token
        : null;

      return { updated: approved, poViewToken: issuedToken };
    });

    await this.auditTransition(AuditAction.PO_APPROVED, id, user, po.status, nextStatus);

    if (isPendingApprovalSend) {
      // Send email notification to vendor with PDF attachment (fire-and-forget).
      this.notifyVendorOfPo(id, updated.poNumber, updated.vendor, user, poViewToken).catch(
        () => {},
      );
    }

    return {
      id: updated.id,
      projectName: updated.project.name,
      status: updated.status,
      vendorName: updated.vendor?.legalName ?? null,
    };
  }

  // ── Decline Purchase Order ───────────────────────────────────────────────

  async declinePurchaseOrder(id: string, dto: DeclinePoDto, user: AuthenticatedUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true },
    });

    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== po.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (po.status === PrismaPoStatus.CANCELLED || po.status === PrismaPoStatus.CLOSED) {
      throw new BadRequestException(ERR.purchaseOrders.cannotDecline(po.status));
    }

    assertTransition(po.status, PrismaPoStatus.CANCELLED);
    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PrismaPoStatus.CANCELLED,
        approvalStatus: ApprovalStatus.REJECTED,
        cancellationReason: dto.reason,
        lastModifiedById: user.id,
      },
      include: {
        project: { select: { name: true } },
        vendor: { select: { legalName: true } },
      },
    });

    await this.auditTransition(
      AuditAction.PO_DECLINED,
      id,
      user,
      po.status,
      PrismaPoStatus.CANCELLED,
      { reason: dto.reason },
    );

    return {
      id: updated.id,
      projectName: updated.project.name,
      status: updated.status,
      vendorName: updated.vendor?.legalName ?? null,
    };
  }

  // ── Accept Purchase Order (Vendor) ──────────────────────────────────────

  async acceptPurchaseOrder(
    id: string,
    dto: VendorAcceptPoDto | undefined,
    user: AuthenticatedUser,
  ) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, status: true, vendorId: true },
    });

    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    // Vendor can only accept POs addressed to their company
    if (user.companyId !== po.vendorId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (po.status !== PrismaPoStatus.ACKNOWLEDGED) {
      throw new BadRequestException(ERR.purchaseOrders.cannotAccept(po.status));
    }

    assertTransition(po.status, PrismaPoStatus.ACCEPTED);
    const updateData: Record<string, unknown> = {
      status: PrismaPoStatus.ACCEPTED,
      lastModifiedById: user.id,
    };

    if (dto?.paymentTermsDays !== undefined) {
      updateData.paymentTermsDays = dto.paymentTermsDays;
    }

    if (dto?.warehouseLocationId) {
      updateData.warehouseLocationId = dto.warehouseLocationId;
    }

    await this.prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
    });

    await this.auditTransition(
      AuditAction.PO_ACCEPTED,
      id,
      user,
      po.status,
      PrismaPoStatus.ACCEPTED,
    );

    return this.purchaseOrdersService.getPurchaseOrder(id, user);
  }

  // ── Vendor Decline Purchase Order ─────────────────────────────────────────

  async vendorDeclinePurchaseOrder(
    id: string,
    dto: VendorDeclinePoDto | undefined,
    user: AuthenticatedUser,
  ) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        vendorId: true,
        poNumber: true,
        companyId: true,
        vendor: { select: { legalName: true } },
        company: {
          select: {
            users: {
              where: { role: UserRole.COMPANY_ADMIN },
              select: { email: true },
            },
          },
        },
      },
    });

    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    // Vendor can only decline POs addressed to their company
    if (user.companyId !== po.vendorId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (po.status !== PrismaPoStatus.SENT && po.status !== PrismaPoStatus.ACKNOWLEDGED) {
      throw new BadRequestException(ERR.purchaseOrders.cannotVendorDecline(po.status));
    }

    assertTransition(po.status, PrismaPoStatus.CANCELLED_BY_VENDOR);
    await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PrismaPoStatus.CANCELLED_BY_VENDOR,
        lastModifiedById: user.id,
        // cancellationReason is the canonical store; deliveryNotes is kept in
        // sync for backward-compat with readers that predate the new column.
        ...(dto?.reason && {
          cancellationReason: dto.reason,
          deliveryNotes: dto.reason,
        }),
      },
    });

    await this.auditTransition(
      AuditAction.PO_DECLINED_BY_VENDOR,
      id,
      user,
      po.status,
      PrismaPoStatus.CANCELLED_BY_VENDOR,
      { reason: dto?.reason ?? null },
    );

    // Notify contractor that vendor declined the PO (fire-and-forget)
    this.notifyContractorOfDecline(
      id,
      po.poNumber,
      po.vendor?.legalName ?? 'Vendor',
      po.company?.users ?? [],
      dto?.reason,
    ).catch(() => {});

    return this.purchaseOrdersService.getPurchaseOrder(id, user);
  }

  // ── Archive Purchase Order ─────────────────────────────────────────────

  async archivePurchaseOrder(id: string, user: AuthenticatedUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true },
    });

    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== po.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (po.status !== PrismaPoStatus.CLOSED) {
      throw new BadRequestException(ERR.purchaseOrders.onlyClosedCanArchive);
    }

    // Archive is a soft-delete, not a lifecycle transition: it intentionally
    // repurposes CANCELLED as the archived sentinel for a CLOSED PO. CLOSED is a
    // terminal state in the state machine, so this deliberately does NOT route
    // through assertTransition; it is gated by the onlyClosedCanArchive check
    // above instead.
    await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PrismaPoStatus.CANCELLED, lastModifiedById: user.id },
    });

    await this.auditTransition(
      AuditAction.PO_ARCHIVED,
      id,
      user,
      PrismaPoStatus.CLOSED,
      PrismaPoStatus.CANCELLED,
    );

    return { success: true };
  }

  // ── Receive / record delivery ──────────────────────────────────────────────

  /**
   * Record a delivery against a PO (Week-3 delivery leg / inventory hook). Sets
   * the cumulative delivered quantity per line, then moves the PO to
   * PARTIALLY_DELIVERED, or DELIVERED when every line is fully delivered, via
   * the state machine. A no-progress receipt (nothing delivered on any line)
   * leaves the status untouched.
   */
  async receivePurchaseOrder(id: string, dto: ReceivePoDto, user: AuthenticatedUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        companyId: true,
        deliveryLocationId: true,
        lineItems: {
          select: {
            id: true,
            quantityOrdered: true,
            quantityDelivered: true,
            materialId: true,
            deliveryLocationId: true,
          },
        },
      },
    });

    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== po.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    const lineById = new Map(po.lineItems.map((li) => [li.id, li]));

    // Validate every referenced line belongs to this PO and is not over-received
    // before mutating anything. The manual receive path stays strict: a
    // cumulative figure above the ordered quantity is rejected (the
    // delivery-report approval path, by contrast, ALLOWS over-receipt).
    for (const line of dto.lines) {
      const existing = lineById.get(line.lineItemId);
      if (!existing) {
        throw new BadRequestException(ERR.purchaseOrders.lineNotFound(line.lineItemId));
      }
      if (line.quantityDelivered > existing.quantityOrdered) {
        throw new BadRequestException(
          ERR.purchaseOrders.deliveredExceedsOrdered(
            line.quantityDelivered,
            existing.quantityOrdered,
          ),
        );
      }
    }

    // Convert the cumulative figures the manual path supplies into per-line
    // positive deltas (existing + (new − existing) === new), then delegate to the
    // shared delta-based applier. A re-post of the same figures yields delta 0 on
    // every line → no inventory movement and no status change (idempotent).
    const deltas = new Map<string, number>();
    for (const line of dto.lines) {
      const existing = lineById.get(line.lineItemId);
      deltas.set(line.lineItemId, line.quantityDelivered - (existing?.quantityDelivered ?? 0));
    }

    const outcome = await this.prisma.$transaction((tx) =>
      this.applyDeliveryDeltasTx(tx, po, deltas, user.id),
    );

    // Audit the transition (best-effort) after the receipt commits — matches the
    // original post-commit ordering of receivePurchaseOrder.
    if (outcome.transitioned) {
      const action =
        outcome.nextStatus === PrismaPoStatus.DELIVERED
          ? AuditAction.PO_DELIVERED
          : AuditAction.PO_PARTIALLY_DELIVERED;
      await this.auditTransition(action, id, user, outcome.fromStatus, outcome.nextStatus, {
        lines: dto.lines.map((l) => ({
          lineItemId: l.lineItemId,
          quantityDelivered: l.quantityDelivered,
        })),
      });
    }

    return this.purchaseOrdersService.getPurchaseOrder(id, user);
  }

  /**
   * Apply per-line delivered DELTAS to a PO inside an open transaction (the
   * shared close-out leg used by both the manual receive path and the
   * delivery-report approval path). For each line with a positive delta it bumps
   * `poLineItem.quantityDelivered` by the delta (write is the projected
   * cumulative), pushes that delta into inventory when the line resolves a
   * catalogue material + location (line override, else the PO header), then
   * recomputes the PO status from the projected cumulative quantities —
   * DELIVERED when every line is delivered ≥ ordered, else PARTIALLY_DELIVERED
   * when any is delivered, gated by `assertTransition` and only written when the
   * status actually moves. Returns the transition outcome so the caller can emit
   * a best-effort transition audit AFTER the surrounding transaction commits.
   *
   * Callers are responsible for their own validation (e.g. the manual path's
   * over-receipt guard) before invoking this. Deltas of 0 are no-ops.
   */
  private async applyDeliveryDeltasTx(
    tx: Prisma.TransactionClient,
    po: DeliveryDeltaPo,
    deltas: Map<string, number>,
    actorUserId: string,
  ): Promise<DeliveryDeltaOutcome> {
    const lineById = new Map(po.lineItems.map((li) => [li.id, li]));

    // Project post-update cumulative delivered quantities to decide the status.
    const nextDelivered = new Map(po.lineItems.map((li) => [li.id, li.quantityDelivered]));
    for (const [lineId, delta] of deltas) {
      const existing = lineById.get(lineId);
      if (!existing) continue;
      nextDelivered.set(lineId, existing.quantityDelivered + delta);
    }

    const allFullyDelivered = po.lineItems.every(
      (li) => (nextDelivered.get(li.id) ?? 0) >= li.quantityOrdered,
    );
    const anyDelivered = po.lineItems.some((li) => (nextDelivered.get(li.id) ?? 0) > 0);

    const nextStatus = allFullyDelivered
      ? PrismaPoStatus.DELIVERED
      : anyDelivered
        ? PrismaPoStatus.PARTIALLY_DELIVERED
        : po.status;

    // Only assert/transition when the status actually moves — a re-post of the
    // same partial figures should be idempotent rather than an illegal
    // PARTIALLY_DELIVERED → PARTIALLY_DELIVERED self-loop rejection.
    if (nextStatus !== po.status) {
      assertTransition(po.status, nextStatus);
    }

    for (const [lineId, delta] of deltas) {
      const existing = lineById.get(lineId);
      if (!existing) continue;

      // Write the projected cumulative; only a positive delta changes anything.
      await tx.poLineItem.update({
        where: { id: lineId },
        data: { quantityDelivered: existing.quantityDelivered + delta },
      });

      // Push the newly-received quantity into inventory. Only the positive delta
      // counts (a re-post of the same figures yields delta 0 → no movement), and
      // only when the line carries a catalogue material and a resolvable location
      // (line-level override, else the PO header). Lines without material or
      // location simply aren't tracked — quantityDelivered still updates.
      const locationId = existing.deliveryLocationId ?? po.deliveryLocationId;
      if (delta > 0 && existing.materialId && locationId) {
        await this.inventoryService.applyIn(tx, {
          companyId: po.companyId,
          materialId: existing.materialId,
          locationId,
          quantity: delta,
          sourceType: 'PURCHASE_ORDER',
          sourceId: po.id,
          sourceLineId: lineId,
          createdById: actorUserId,
        });
      }
    }

    if (nextStatus !== po.status) {
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: nextStatus, lastModifiedById: actorUserId },
      });
    }

    return {
      transitioned: nextStatus !== po.status,
      fromStatus: po.status,
      nextStatus,
    };
  }

  /**
   * Public entry point onto the shared delivery close-out leg, used by the
   * delivery-report APPROVAL path (DeliveriesService.approveDeliveryReport). The
   * caller supplies an open transaction `tx`, the PO snapshot, the per-line
   * received DELTAS to apply, and the approving user — exactly the same
   * machinery the manual receive path runs, but the caller decides the deltas
   * (over-receipt is permitted on the approval path). Returns the transition
   * outcome so the caller can audit AFTER its transaction commits via
   * {@link auditDeliveryTransition}. Inventory is append-only and the line bump
   * is an `increment`-equivalent absolute write of the projected cumulative, so
   * idempotency must be enforced by the caller (re-read the report status inside
   * the same tx before applying).
   */
  async applyDeliveryDeltasInTx(
    tx: Prisma.TransactionClient,
    po: DeliveryDeltaPo,
    deltas: Map<string, number>,
    actorUserId: string,
  ): Promise<DeliveryDeltaOutcome> {
    return this.applyDeliveryDeltasTx(tx, po, deltas, actorUserId);
  }

  /**
   * Mint (or reuse) a long-lived public QR delivery-submission link for a PO
   * (Epic 6). The PO must be in a deliverable status. The token is a 90-day
   * DELIVERY_SUBMIT grant, idempotent per (PO, purpose) via issueTokenIfNoneLive
   * — like PO_VIEW it is validated, never consumed, so the QR stays reusable.
   * Returns { token, url, poNumber }. When a live token already exists its
   * plaintext cannot be reconstructed, so a fresh one is force-minted to keep the
   * caller's QR functional.
   */
  async generateDeliveryLink(
    id: string,
    user: AuthenticatedUser,
  ): Promise<{ token: string; url: string; poNumber: string | null }> {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, poNumber: true, companyId: true, status: true },
    });
    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== po.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    const deliverable: PrismaPoStatus[] = [
      PrismaPoStatus.SENT,
      PrismaPoStatus.ACKNOWLEDGED,
      PrismaPoStatus.ACCEPTED,
      PrismaPoStatus.SCHEDULED_FOR_DELIVERY,
      PrismaPoStatus.PARTIALLY_DELIVERED,
      PrismaPoStatus.LATE_FOR_DELIVERY,
    ];
    if (!deliverable.includes(po.status)) {
      throw new BadRequestException(
        `A delivery link cannot be generated for a PO in status ${po.status}.`,
      );
    }

    const issued = await this.accessTokens.issueTokenIfNoneLive({
      subjectType: AccessTokenSubject.PURCHASE_ORDER,
      subjectId: po.id,
      purpose: AccessTokenPurpose.DELIVERY_SUBMIT,
      ttlMs: DELIVERY_LINK_TTL_MS,
      createdByUserId: user.id,
    });

    // A reused live token can't expose its plaintext (only its hash is stored);
    // force-mint a fresh one so the QR the caller renders actually resolves.
    const token =
      issued.token ??
      (
        await this.accessTokens.issueToken({
          subjectType: AccessTokenSubject.PURCHASE_ORDER,
          subjectId: po.id,
          purpose: AccessTokenPurpose.DELIVERY_SUBMIT,
          ttlMs: DELIVERY_LINK_TTL_MS,
          createdByUserId: user.id,
        })
      ).token;

    return {
      token,
      url: `${this.webAppUrl}/delivery/${token}`,
      poNumber: po.poNumber,
    };
  }

  /**
   * Emit the best-effort PO status-transition audit for a delivery-driven
   * close-out, AFTER the surrounding transaction has committed. No-op when the
   * status did not move. Reuses PO_DELIVERED / PO_PARTIALLY_DELIVERED.
   */
  async auditDeliveryTransition(
    poId: string,
    actorUserId: string,
    outcome: DeliveryDeltaOutcome,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    if (!outcome.transitioned) return;
    const action =
      outcome.nextStatus === PrismaPoStatus.DELIVERED
        ? AuditAction.PO_DELIVERED
        : AuditAction.PO_PARTIALLY_DELIVERED;
    await this.auditTransition(
      action,
      poId,
      { id: actorUserId } as AuthenticatedUser,
      outcome.fromStatus,
      outcome.nextStatus,
      extra,
    );
  }

  // ── Pending-approval queue ──────────────────────────────────────────────────

  /**
   * POs in PENDING_APPROVAL within the caller's company that the CURRENT user is
   * actually entitled to approve (po.approve permission + threshold ≥ the PO
   * total). Reuses the standard PO list serialization via getPurchaseOrder so
   * the inbox UI gets the same detail shape it already renders.
   */
  async listPendingApproval(user: AuthenticatedUser) {
    const where: Prisma.PurchaseOrderWhereInput = { status: PrismaPoStatus.PENDING_APPROVAL };
    // SUPER_ADMIN sees the whole queue; everyone else is scoped to their company.
    if (user.role !== UserRole.SUPER_ADMIN) {
      if (!user.companyId) return { items: [] };
      where.companyId = user.companyId;
    }

    const pos = await this.prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true, totalAmount: true },
    });

    const entitled: Array<{ id: string }> = [];
    for (const po of pos) {
      if (user.role === UserRole.SUPER_ADMIN) {
        entitled.push(po);
        continue;
      }
      const decision = await this.approvalAuth.evaluate(user.role, 'po.approve', po.totalAmount);
      if (decision.outcome === 'allowed') entitled.push(po);
    }

    const items = await Promise.all(
      entitled.map((po) => this.purchaseOrdersService.getPurchaseOrder(po.id, user)),
    );

    return { items };
  }

  // ── Audit / activity trail ──────────────────────────────────────────────────

  /**
   * Chronological audit trail for a single PO (Week-3 activity timeline feed).
   * Returns every `PurchaseOrder`-targeted audit entry oldest-first, with the
   * performing user resolved. Access is scoped the same way the lifecycle
   * mutations are: SUPER_ADMIN sees any PO, the owning contractor company sees
   * its own, and the addressed vendor company sees POs sent to it.
   */
  async getAuditTrail(id: string, user: AuthenticatedUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, companyId: true, vendorId: true },
    });

    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    const hasAccess =
      user.role === UserRole.SUPER_ADMIN ||
      user.companyId === po.companyId ||
      user.companyId === po.vendorId;
    if (!hasAccess) throw new ForbiddenException(ERR.general.accessDenied);

    const logs = await this.prisma.auditLog.findMany({
      where: { targetType: 'PurchaseOrder', targetId: id },
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

  // ── Email notification helpers ──────────────────────────────────────────

  private async notifyVendorOfPo(
    poId: string,
    poNumber: string,
    vendor: { users: Array<{ email: string }>; contactEmail: string | null } | null | undefined,
    user: AuthenticatedUser,
    poViewToken?: string | null,
  ): Promise<void> {
    // Reach the vendor's user accounts, or fall back to the company contact
    // email when the vendor was quick-added without a user (US-3.01).
    const recipients = resolveVendorEmailRecipients(vendor?.users ?? [], vendor?.contactEmail);
    if (recipients.length === 0) return;

    // Generate PDF buffer for email attachment
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await this.poExportService.generatePoPdfBuffer(poId, user);
    } catch {
      // PDF generation failure is non-critical — send email without attachment
    }

    // Choose the "View" link by vendor state (ADR-0001 / ADR-0002 R1 PO token):
    //  - Activated vendor (has a real account) → authenticated app route.
    //  - Unactivated vendor (email-only) → tokenised public PO portal so they can
    //    view (and later act on) the PO with no login.
    // resolveVendorEmailRecipients() already collapses to a single state — it
    // returns user emails when the vendor is activated, otherwise the contact
    // email — so the whole recipient set shares one link type.
    const isActivated = (vendor?.users?.length ?? 0) > 0;
    const viewUrl =
      !isActivated && poViewToken
        ? `${this.webAppUrl}/po/${poViewToken}`
        : `${this.webAppUrl}/purchase-orders/${poId}`;

    // Track each vendor email so it surfaces on the PO email log (FOR-213).
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { companyId: true },
    });
    const log = po
      ? { companyId: po.companyId, purchaseOrderId: poId, sentByUserId: user.id }
      : undefined;

    await Promise.all(
      recipients.map((email) =>
        this.emailService.sendPoIssuedEmail(email, poNumber, viewUrl, pdfBuffer, log),
      ),
    );
  }

  private async notifyContractorOfDecline(
    poId: string,
    poNumber: string,
    vendorName: string,
    companyAdmins: Array<{ email: string }>,
    reason?: string,
  ): Promise<void> {
    if (companyAdmins.length === 0) return;

    const viewUrl = `${this.webAppUrl}/purchase-orders/${poId}`;

    // Track the decline notification on the PO email log (FOR-213).
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { companyId: true },
    });
    const log = po ? { companyId: po.companyId, purchaseOrderId: poId } : undefined;

    await Promise.all(
      companyAdmins.map((u) =>
        this.emailService.sendPoDeclinedByVendorEmail(
          u.email,
          poNumber,
          vendorName,
          viewUrl,
          reason,
          log,
        ),
      ),
    );
  }

  /**
   * Email the company users entitled to approve a PO that has been routed to
   * PENDING_APPROVAL (Week-3 approver notification). "Entitled" = an ACTIVE user
   * in the PO's company whose role holds `po.approve` with a threshold that
   * covers the PO total (null threshold = unlimited). Best-effort.
   */
  private async notifyApproversOfPendingPo(
    poId: string,
    companyId: string,
    totalAmount: Prisma.Decimal | null,
    currency: string,
  ): Promise<void> {
    const recipients = await this.findApproverEmails(companyId, totalAmount);
    if (recipients.length === 0) return;

    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { poNumber: true },
    });
    if (!po) return;

    const amountLabel = `${(totalAmount ?? 0).toString()} ${currency}`;
    const viewUrl = `${this.webAppUrl}/purchase-orders/${poId}`;
    const log = { companyId, purchaseOrderId: poId };

    await Promise.all(
      recipients.map((email) =>
        this.emailService.sendPoPendingApprovalEmail(email, po.poNumber, amountLabel, viewUrl, log),
      ),
    );
  }

  /**
   * Resolve the ACTIVE users in `companyId` whose role can approve a PO of
   * `totalAmount`. A role qualifies when its `po.approve` grant exists and its
   * threshold is null (unlimited) or ≥ the amount.
   */
  private async findApproverEmails(
    companyId: string,
    totalAmount: Prisma.Decimal | null,
  ): Promise<string[]> {
    const grants = await this.prisma.rolePermission.findMany({
      where: { permission: { key: 'po.approve' } },
      select: { role: true, thresholdAmount: true },
    });

    const amount = totalAmount === null ? null : new Prisma.Decimal(totalAmount);
    const eligibleRoles = grants
      .filter((g) => g.thresholdAmount === null || !amount?.greaterThan(g.thresholdAmount))
      .map((g) => g.role);

    if (eligibleRoles.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        role: { in: eligibleRoles },
      },
      select: { email: true },
    });

    return [...new Set(users.map((u) => u.email))];
  }
}
