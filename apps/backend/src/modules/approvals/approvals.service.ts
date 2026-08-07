import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalEntityType, ApprovalStatus, AuditAction, Prisma, UserRole } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApprovalAuthorizationService, type ApproverPoolMember } from '../../common/permissions';
import { PrismaService } from '../../prisma/prisma.service';

import {
  APPROVAL_ENTITY_CONFIG,
  type ApprovalNominationView,
  type ApproverPoolMemberView,
  type ApproverPoolRoleGroupView,
  type ApproverPoolView,
} from './approvals.types';

/** The document fields the Pool needs, whichever entity it came from. */
interface ApprovableDocument {
  id: string;
  companyId: string;
  totalAmount: Prisma.Decimal | null;
  approvalStatus: ApprovalStatus;
  approvedBy: { id: string; name: string } | null;
  /** Who may nominate: the PO's creator, or the invoice's reviewer (FOR-307). */
  nominatorUserId: string | null;
}

/**
 * Approver Pool and Nomination, shared by the Purchase Order and Invoice paths
 * (ADR-0006 amendment, 2026-08-07).
 *
 * One implementation parameterised by entity type — the Pool is the same idea
 * on both documents, and forking it is how the two paths drift.
 */
@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalAuth: ApprovalAuthorizationService,
  ) {}

  // ── Document loading ───────────────────────────────────────────────────────

  private async loadDocument(
    entityType: ApprovalEntityType,
    entityId: string,
  ): Promise<ApprovableDocument> {
    if (entityType === ApprovalEntityType.PURCHASE_ORDER) {
      const po = await this.prisma.purchaseOrder.findUnique({
        where: { id: entityId },
        select: {
          id: true,
          companyId: true,
          totalAmount: true,
          approvalStatus: true,
          createdByUserId: true,
          approvedBy: { select: { id: true, name: true } },
        },
      });
      if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);
      return {
        id: po.id,
        companyId: po.companyId,
        totalAmount: po.totalAmount,
        approvalStatus: po.approvalStatus,
        approvedBy: po.approvedBy,
        nominatorUserId: po.createdByUserId,
      };
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: entityId },
      select: {
        id: true,
        companyId: true,
        totalAmount: true,
        approvalStatus: true,
        reviewedByUserId: true,
        approvedBy: { select: { id: true, name: true } },
      },
    });
    if (!invoice) throw new NotFoundException(ERR.invoices.notFound);
    return {
      id: invoice.id,
      companyId: invoice.companyId,
      totalAmount: invoice.totalAmount,
      approvalStatus: invoice.approvalStatus,
      approvedBy: invoice.approvedBy,
      // An invoice arrives from a vendor rather than being raised by a spender,
      // so the reviewer stands in for the PO's creator (ADR-0006 amendment).
      nominatorUserId: invoice.reviewedByUserId,
    };
  }

  /**
   * Tenant scope. SUPER_ADMIN bypasses it as break-glass, but is never itself in
   * a Pool (`companyId` is null), so platform-operator identity is never exposed
   * to a tenant through this surface.
   */
  private assertCompanyScope(user: AuthenticatedUser, companyId: string): void {
    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }
  }

  // ── Read model ─────────────────────────────────────────────────────────────

  /**
   * Collapse Pool members to role labels + counts — the only shape the pending
   * panel renders. A custom role is its own group (its grant replaced the
   * built-in one), so "Junior Buyer" never hides inside "Foreman".
   */
  private groupByRole(members: ApproverPoolMemberView[]): ApproverPoolRoleGroupView[] {
    const groups = new Map<string, ApproverPoolRoleGroupView>();
    for (const m of members) {
      const key = m.customRoleName ?? m.role;
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(key, { role: m.role, customRoleName: m.customRoleName, count: 1 });
      }
    }
    return [...groups.values()];
  }

  private toMemberView(m: ApproverPoolMember): ApproverPoolMemberView {
    return { id: m.id, name: m.name, role: m.role, customRoleName: m.customRoleName };
  }

  /**
   * When the approval resolved, and by whom. `approvedById` carries the person
   * (ADR-0006's audit requirement); the timestamp comes off the audit trail,
   * which is the authoritative record of when the transition happened.
   */
  private async resolveTimestamp(
    entityType: ApprovalEntityType,
    entityId: string,
  ): Promise<string | null> {
    const config = APPROVAL_ENTITY_CONFIG[entityType];
    const entry = await this.prisma.auditLog.findFirst({
      where: {
        targetType: config.auditTargetType,
        targetId: entityId,
        action: { in: [...config.resolvedActions] as AuditAction[] },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return entry?.createdAt.toISOString() ?? null;
  }

  /**
   * The document's Approver Pool as the UI needs it.
   *
   * The Pool is recomputed here on every call — never snapshotted. A user whose
   * cap is lowered drops out; a new hire with an adequate cap appears. That is a
   * deliberate divergence from the frozen `RfqVendor` recipient set: those rows
   * are document *content*, whereas the Pool is a derived view of *current*
   * authority, and authorisation is evaluated live at approve time.
   */
  async getApproverPool(
    entityType: ApprovalEntityType,
    entityId: string,
    user: AuthenticatedUser,
    /**
     * Resolve the Pool for this total instead of the document's stored one.
     *
     * The invoice nomination picker needs it: the reviewer is choosing who to
     * notify about a total they have typed but not yet saved, and showing them
     * the Pool for the *old* total would offer people who cannot approve the new
     * one. The Pool is a pure function of (company, permission, amount), so this
     * is a preview of the same computation, not a second rule.
     *
     * It widens nothing: the caller can already move the total to any figure and
     * re-read, and the view still carries names and roles only — never caps.
     */
    amountOverride?: Prisma.Decimal | number | null,
  ): Promise<ApproverPoolView> {
    const doc = await this.loadDocument(entityType, entityId);
    this.assertCompanyScope(user, doc.companyId);

    const config = APPROVAL_ENTITY_CONFIG[entityType];
    const pool = await this.approvalAuth.resolveApproverPool(
      doc.companyId,
      config.permissionKey,
      amountOverride === undefined ? doc.totalAmount : amountOverride,
    );
    const members = pool.map((m) => this.toMemberView(m));

    const isResolved =
      doc.approvalStatus === ApprovalStatus.APPROVED ||
      doc.approvalStatus === ApprovalStatus.REJECTED;

    const [resolvedAt, nominations] = await Promise.all([
      isResolved ? this.resolveTimestamp(entityType, entityId) : Promise.resolve(null),
      this.listNominations(entityType, entityId, members),
    ]);

    return {
      entityType,
      entityId,
      approvalStatus: doc.approvalStatus,
      members,
      roleGroups: this.groupByRole(members),
      memberCount: members.length,
      isEmpty: members.length === 0,
      resolvedBy: isResolved ? doc.approvedBy : null,
      resolvedAt,
      nominations,
      // Only the creator (PO) / reviewer (Invoice) may nominate. Pool members
      // re-nominating each other is deferred (ADR-0006 amendment).
      canNominate: doc.approvalStatus === ApprovalStatus.PENDING && doc.nominatorUserId === user.id,
    };
  }

  // ── Nomination (FOR-306 / FOR-308) ─────────────────────────────────────────

  /**
   * Persist routing hints, rejecting anyone outside `pool`.
   *
   * The in-Pool check is the whole safety property: a Nomination may only ever
   * **narrow** who is notified, never widen who could act. Enforcing it here —
   * server-side, against the Pool as recomputed at this instant — is what makes
   * the UI's picker a convenience rather than the control.
   *
   * Idempotent by `@@unique([entityType, entityId, userId])`: re-nominating an
   * existing nominee is skipped, so nobody gets a second email for it.
   *
   * @returns the members newly nominated by this call — i.e. exactly who to
   *          notify, with duplicates already dropped.
   */
  /**
   * Reject any requested nominee who is not in `pool`.
   *
   * Separated from the write so the submit path can validate *before* it commits
   * the document to PENDING_APPROVAL — a bad id should be a 400 on a still-DRAFT
   * order, not a half-submitted one. The Pool depends only on company and total,
   * neither of which the transition changes, so checking early is equivalent to
   * checking late.
   */
  async assertNomineesInPool(
    companyId: string,
    pool: ApproverPoolMember[],
    userIds: string[],
  ): Promise<void> {
    const inPool = new Set(pool.map((m) => m.id));
    const outsidePool = [...new Set(userIds)].filter((id) => !inPool.has(id));
    if (outsidePool.length === 0) return;

    // Name them where we can — "Yaw can't approve this amount" tells the creator
    // what to do next, where "one of the selected people" does not. The lookup
    // is company-scoped so a bad id cannot be used to probe other tenants.
    const named = await this.prisma.user.findFirst({
      where: { id: { in: outsidePool }, companyId },
      select: { name: true },
    });
    throw new BadRequestException(
      named ? ERR.approvals.nomineeNotInPool(named.name) : ERR.approvals.nomineeUnknown,
    );
  }

  private async persistNominations(
    entityType: ApprovalEntityType,
    entityId: string,
    companyId: string,
    pool: ApproverPoolMember[],
    userIds: string[],
    nominatedById: string,
  ): Promise<ApproverPoolMember[]> {
    const requested = [...new Set(userIds)];
    if (requested.length === 0) return [];

    await this.assertNomineesInPool(companyId, pool, requested);
    const byId = new Map(pool.map((m) => [m.id, m]));

    const existing = await this.prisma.approvalNomination.findMany({
      where: { entityType, entityId, userId: { in: requested } },
      select: { userId: true },
    });
    const alreadyNominated = new Set(existing.map((e) => e.userId));
    const fresh = requested.filter((id) => !alreadyNominated.has(id));
    if (fresh.length === 0) return [];

    await this.prisma.approvalNomination.createMany({
      data: fresh.map((userId) => ({
        entityType,
        entityId,
        userId,
        nominatedById,
        companyId,
      })),
      // Belt-and-braces against two concurrent submits racing on the unique
      // index; the pre-filter above is what keeps the *notification* single.
      skipDuplicates: true,
    });

    return fresh.map((id) => byId.get(id) as ApproverPoolMember);
  }

  /**
   * Record nominations made as part of submitting a document for approval
   * (FOR-306), where the caller has already resolved the Pool and is about to
   * fan out the notification itself.
   *
   * Deliberately does not re-check "is this user the creator": the act of
   * submitting *is* the routing moment, so whoever performed it owns this
   * choice, even in the rare case where they are not the document's creator.
   * Post-submit nomination (FOR-308) is the stricter, creator-only path.
   */
  async recordNominationsAtSubmit(
    entityType: ApprovalEntityType,
    entityId: string,
    companyId: string,
    pool: ApproverPoolMember[],
    userIds: string[],
    nominatedById: string,
  ): Promise<ApproverPoolMember[]> {
    return this.persistNominations(entityType, entityId, companyId, pool, userIds, nominatedById);
  }

  /**
   * Nominate further Pool members on a document already awaiting approval
   * (FOR-308) — the unresponsive-approver remedy.
   *
   * Because a Nomination never controlled authority, this is purely "also ping
   * Yaw": no authorisation changes, and no dependency on the Out-of-Office
   * delegation ADR-0006 defers.
   *
   * @returns the members to notify (empty when every id was already nominated)
   *          alongside the refreshed view.
   */
  async addNominations(
    entityType: ApprovalEntityType,
    entityId: string,
    userIds: string[],
    user: AuthenticatedUser,
  ): Promise<{ view: ApproverPoolView; notify: ApproverPoolMember[] }> {
    const doc = await this.loadDocument(entityType, entityId);
    this.assertCompanyScope(user, doc.companyId);
    this.assertMayNominate(doc, user);

    const config = APPROVAL_ENTITY_CONFIG[entityType];
    const pool = await this.approvalAuth.resolveApproverPool(
      doc.companyId,
      config.permissionKey,
      doc.totalAmount,
    );

    const notify = await this.persistNominations(
      entityType,
      entityId,
      doc.companyId,
      pool,
      userIds,
      user.id,
    );

    return { view: await this.getApproverPool(entityType, entityId, user), notify };
  }

  /**
   * Withdraw a nomination. Authority is untouched — the withdrawn user keeps
   * their place in the Pool and the document stays in their dashboard queue, so
   * this can never strand the document.
   */
  async withdrawNomination(
    entityType: ApprovalEntityType,
    entityId: string,
    userId: string,
    user: AuthenticatedUser,
  ): Promise<ApproverPoolView> {
    const doc = await this.loadDocument(entityType, entityId);
    this.assertCompanyScope(user, doc.companyId);
    this.assertMayNominate(doc, user);

    const { count } = await this.prisma.approvalNomination.deleteMany({
      where: { entityType, entityId, userId },
    });
    if (count === 0) throw new NotFoundException(ERR.approvals.nominationNotFound);

    return this.getApproverPool(entityType, entityId, user);
  }

  /**
   * Cascade-on-delete for the polymorphic table: `entityId` carries no FK
   * (it points at either documents table), so orphan rows are our problem, not
   * the database's.
   */
  async deleteNominationsFor(entityType: ApprovalEntityType, entityId: string): Promise<void> {
    await this.prisma.approvalNomination.deleteMany({ where: { entityType, entityId } });
  }

  /**
   * Only the creator (PO) / reviewer (Invoice) may nominate, and only while the
   * approval is still open. Pool members re-nominating each other is explicitly
   * deferred in the ADR-0006 amendment.
   */
  private assertMayNominate(doc: ApprovableDocument, user: AuthenticatedUser): void {
    if (doc.approvalStatus !== ApprovalStatus.PENDING) {
      throw new BadRequestException(ERR.approvals.notPending);
    }
    if (doc.nominatorUserId !== user.id) {
      throw new ForbiddenException(ERR.approvals.notNominator);
    }
  }

  /**
   * Who a pending-approval notification should actually reach.
   *
   * Nominating narrows the fan-out to the nominees; nominating nobody keeps the
   * pre-nomination broadcast to the whole Pool. Either way this returns Pool
   * members only — a nominee who has since dropped out of the Pool is not
   * emailed about a document they can no longer approve.
   *
   * Non-nominated Pool members are not left in the dark: the dashboard's
   * entitlement-filtered "Awaiting approval" queue still lists the document for
   * every one of them. That queue is the safety net this narrowing leans on.
   */
  async resolveNotificationTargets(
    entityType: ApprovalEntityType,
    entityId: string,
    pool: ApproverPoolMember[],
  ): Promise<ApproverPoolMember[]> {
    if (pool.length === 0) return [];

    const nominations = await this.prisma.approvalNomination.findMany({
      where: { entityType, entityId },
      select: { userId: true },
    });
    if (nominations.length === 0) return pool;

    const nominated = new Set(nominations.map((n) => n.userId));
    const targets = pool.filter((m) => nominated.has(m.id));

    // Every nominee has since fallen out of the Pool. Falling back to the whole
    // Pool beats emailing nobody: the document still needs approving, and the
    // creator's stale intent must not silence the request entirely.
    return targets.length > 0 ? targets : pool;
  }

  /**
   * Nominations for a document, each flagged with whether the nominee is still
   * in the Pool. The Pool is live but a Nomination is frozen: a nominee whose
   * cap was lowered renders as "no longer eligible" rather than silently
   * disappearing, because the row is the creator's recorded intent.
   */
  private async listNominations(
    entityType: ApprovalEntityType,
    entityId: string,
    poolMembers: ApproverPoolMemberView[],
  ): Promise<ApprovalNominationView[]> {
    const rows = await this.prisma.approvalNomination.findMany({
      where: { entityType, entityId },
      orderBy: { nominatedAt: 'asc' },
      select: {
        userId: true,
        nominatedById: true,
        nominatedAt: true,
        user: {
          select: {
            name: true,
            role: true,
            customRoleId: true,
            customRole: { select: { name: true } },
          },
        },
      },
    });

    const inPool = new Set(poolMembers.map((m) => m.id));
    return rows.map((r) => ({
      userId: r.userId,
      name: r.user.name,
      role: r.user.role,
      customRoleName: r.user.customRoleId ? (r.user.customRole?.name ?? null) : null,
      nominatedAt: r.nominatedAt.toISOString(),
      nominatedById: r.nominatedById,
      stillEligible: inPool.has(r.userId),
    }));
  }
}
