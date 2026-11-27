import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessTokenPurpose,
  AccessTokenSubject,
  AuditAction,
  NotificationEntityType,
  NotificationType,
  PickUpTimeExpectation,
  PoChangeRequestStatus,
  PoChangeType,
  PoStatus,
  Prisma,
  UserRole,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  loadMaterialSnapshots,
  resolveMaterialSnapshot,
} from '../../common/utils/material-snapshot.util';
import { resolveVendorRecipientsWithState } from '../../common/utils/vendor-recipients.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessTokensService } from '../access-tokens/access-tokens.service';
import { AuditService } from '../audit/audit.service';
import { BrandingService } from '../export/branding.service';
import { NotificationService } from '../notification-feed/notification.service';
import { EmailService } from '../notifications/email.service';

import { canReadPurchaseOrder } from './po-access.util';
import { CreatePoChangeRequestDto, RejectPoChangeRequestDto } from './po-change.dto';
import { assertTransition } from './po-state-machine';
import { PO_TOKEN_TTL_MS } from './po-token.const';

/**
 * The agreed cross-package `changedFields` JSON shape (see PLAN §B). Both the
 * propose step (frontend → here) and the apply step (here → PO row) use it.
 */
interface ChangedFieldDiff {
  from: unknown;
  to: unknown;
}
interface ChangedLineItem {
  lineItemId: string;
  name: string;
  changes: Record<string, ChangedFieldDiff>;
}
interface RemovedLineItem {
  lineItemId: string;
  name?: string;
}
/** A brand-new line the request creates on approval (full line payload). */
interface AddedLineItem {
  name?: string;
  materialId?: string;
  materialCode?: string;
  description?: string;
  quantityOrdered?: number;
  unitOfMeasure?: string;
  unitPrice?: number;
  costCode?: string;
  upc?: string;
  manufacturerPartNumber?: string;
  taxCode?: string;
  expectedDeliveryDate?: string;
  deliveryTime?: string;
  notes?: string;
}
interface ChangedFields {
  fields?: Record<string, ChangedFieldDiff>;
  lineItems?: ChangedLineItem[];
  // FOR-352: lines the request deletes on approval.
  removedLineItems?: RemovedLineItem[];
  // Lines the request adds on approval.
  addedLineItems?: AddedLineItem[];
  // FOR-352: approving cancels the PO instead of applying field changes.
  cancelPo?: boolean;
}

/**
 * Audit-trail + attribution label for a change request proposed by a vendor
 * through a tokenised portal link — the actor has no user account, so this human
 * label stands in for `requestedById` / `performedById` (mirrors the FOR-247
 * guest PO-action pattern in po-status.service.ts).
 */
const GUEST_VENDOR_ACTOR_LABEL = 'Vendor (portal link)';

/**
 * PO-level fields a change request may modify, mapped from the camelCase key in
 * `changedFields.fields` to a typed coercion of the `to` value into a Prisma
 * update. Anything not in this allowlist is ignored when applying — a change
 * request can never write an arbitrary column.
 */
const PO_FIELD_APPLIERS: Record<
  string,
  (to: unknown, data: Prisma.PurchaseOrderUncheckedUpdateInput) => void
> = {
  paymentTermsDays: (to, data) => {
    data.paymentTermsDays = to === null || to === undefined ? null : Number(to);
  },
  pickUpLocation: (to, data) => {
    data.pickUpLocation = toNullableString(to);
  },
  pickUpTimeExpectation: (to, data) => {
    data.pickUpTimeExpectation = toNullableString(to) as PickUpTimeExpectation | null;
  },
  pickUpPersonName: (to, data) => {
    data.pickUpPersonName = toNullableString(to);
  },
  pickUpPersonPhone: (to, data) => {
    data.pickUpPersonPhone = toNullableString(to);
  },
  plannedDeliveryDate: (to, data) => {
    data.plannedDeliveryDate = toNullableDate(to);
  },
  deliveryLocationId: (to, data) => {
    data.deliveryLocationId = toNullableString(to);
  },
  deliveryNotes: (to, data) => {
    data.deliveryNotes = toNullableString(to);
  },
  costCode: (to, data) => {
    data.costCode = toNullableString(to);
  },
  message: (to, data) => {
    data.message = toNullableString(to);
  },
  deliveryResponsibleName: (to, data) => {
    data.deliveryResponsibleName = toNullableString(to);
  },
  deliveryResponsibleEmail: (to, data) => {
    data.deliveryResponsibleEmail = toNullableString(to);
  },
};

/**
 * Per-line attributes a change request may modify. `unitPrice`/`quantityOrdered`
 * additionally drive a `lineTotal` recompute (handled by the caller).
 */
const PO_LINE_FIELD_APPLIERS: Record<
  string,
  (to: unknown, data: Prisma.PoLineItemUpdateInput) => void
> = {
  unitPrice: (to, data) => {
    data.unitPrice = to === null || to === undefined ? 0 : Number(to);
  },
  quantityOrdered: (to, data) => {
    data.quantityOrdered = to === null || to === undefined ? 0 : Number(to);
  },
  costCode: (to, data) => {
    data.costCode = toNullableString(to);
  },
  expectedDeliveryDate: (to, data) => {
    data.expectedDeliveryDate = toNullableDate(to);
  },
  deliveryTime: (to, data) => {
    data.deliveryTime = toNullableString(to);
  },
  description: (to, data) => {
    data.description = toNullableString(to);
  },
  unitOfMeasure: (to, data) => {
    const value = toNullableString(to);
    if (value !== null) data.unitOfMeasure = value;
  },
  notes: (to, data) => {
    data.notes = toNullableString(to);
  },
};

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // Anything else (objects/arrays) is not a valid scalar field value — drop it.
  return null;
}

function toNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Statuses a change (or cancellation) can be proposed on. An accepted PO moves
 * on to SCHEDULED_FOR_DELIVERY / LATE_FOR_DELIVERY on its own (FOR-396), so
 * those stay changeable just as ACCEPTED was.
 */
export const CHANGEABLE_PO_STATUSES: PoStatus[] = [
  PoStatus.SENT,
  PoStatus.ACKNOWLEDGED,
  PoStatus.ACCEPTED,
  PoStatus.SCHEDULED_FOR_DELIVERY,
  PoStatus.LATE_FOR_DELIVERY,
];

@Injectable()
export class PoChangeService {
  private readonly webAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly accessTokens: AccessTokensService,
    config: ConfigService,
    private readonly branding: BrandingService,
    private readonly notifications: NotificationService,
  ) {
    this.webAppUrl = config.get<string>('WEB_APP_URL', 'http://localhost:5179');
  }

  // ── Propose a change ─────────────────────────────────────────────────────

  async proposeChange(poId: string, dto: CreatePoChangeRequestDto, user: AuthenticatedUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: {
        id: true,
        status: true,
        companyId: true,
        vendorId: true,
        rfqId: true,
        poNumber: true,
        company: {
          select: {
            users: { where: { role: UserRole.COMPANY_ADMIN }, select: { email: true } },
          },
        },
        vendor: {
          select: {
            contactEmail: true,
            users: { where: { role: UserRole.VENDOR }, select: { email: true, status: true } },
          },
        },
      },
    });
    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    this.validateAccess(po, user);

    const allowedStatuses: PoStatus[] = CHANGEABLE_PO_STATUSES;
    if (!allowedStatuses.includes(po.status)) {
      throw new BadRequestException(`Cannot propose changes: PO status is ${po.status}`);
    }

    await this.validateProposedRemovals(poId, dto);

    // Sequential per-PO human reference ("CR-001", "CR-002", …) shown on the
    // detail tab + action log.
    const reference = await this.nextChangeReference(poId);

    const changeRequest = await this.prisma.poChangeRequest.create({
      data: {
        purchaseOrderId: poId,
        reference,
        changeType: dto.changeType as PoChangeType,
        changedFields: (dto.changedFields ?? {}) as object,
        message: dto.message ?? null,
        status: PoChangeRequestStatus.PENDING,
        requestedById: user.id,
      },
      include: {
        requestedBy: { select: { id: true, name: true, company: { select: { legalName: true } } } },
      },
    });

    await this.auditService.log({
      action: AuditAction.PO_CHANGE_PROPOSED,
      performedById: user.id,
      targetType: 'PurchaseOrder',
      targetId: poId,
      metadata: { changeRequestId: changeRequest.id, reference },
    });

    // Notify the other party (fire-and-forget).
    const proposedBy = changeRequest.requestedBy?.name ?? 'A user';
    this.notifyChangeProposed(po, user.role === UserRole.VENDOR, user.id, proposedBy, {
      changeType: changeRequest.changeType,
      comment: changeRequest.message,
    }).catch(() => {});

    return this.toChangeRequestResponse(changeRequest);
  }

  // ── Propose a change via the tokenised portal (guest vendor, no login) ──────

  /**
   * Guest counterpart to {@link proposeChange}. The validated PO_VIEW access
   * token already binds the request to this exact PO (the caller never names an
   * id), so the token IS the authorization — there is no user / ownership check
   * (mirrors the FOR-247 guest PO actions). The proposer has no account, so the
   * CR is attributed by `requestedByLabel` (the vendor's name) and the contractor
   * is notified with the authenticated link.
   */
  async proposeChangeViaToken(poId: string, dto: CreatePoChangeRequestDto) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: {
        id: true,
        status: true,
        companyId: true,
        vendorId: true,
        rfqId: true,
        poNumber: true,
        company: {
          select: {
            users: { where: { role: UserRole.COMPANY_ADMIN }, select: { email: true } },
          },
        },
        vendor: { select: { legalName: true, tradeName: true, contactEmail: true } },
      },
    });
    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    const allowedStatuses: PoStatus[] = CHANGEABLE_PO_STATUSES;
    if (!allowedStatuses.includes(po.status)) {
      throw new BadRequestException(`Cannot propose changes: PO status is ${po.status}`);
    }

    await this.validateProposedRemovals(poId, dto);

    const vendorLabel = po.vendor?.legalName ?? po.vendor?.tradeName ?? GUEST_VENDOR_ACTOR_LABEL;
    const reference = await this.nextChangeReference(poId);

    const changeRequest = await this.prisma.poChangeRequest.create({
      data: {
        purchaseOrderId: poId,
        reference,
        changeType: dto.changeType as PoChangeType,
        changedFields: (dto.changedFields ?? {}) as object,
        message: dto.message ?? null,
        status: PoChangeRequestStatus.PENDING,
        requestedById: null,
        requestedByLabel: vendorLabel,
      },
    });

    await this.auditService.log({
      action: AuditAction.PO_CHANGE_PROPOSED,
      performedById: null,
      performedByLabel: GUEST_VENDOR_ACTOR_LABEL,
      targetType: 'PurchaseOrder',
      targetId: poId,
      metadata: { changeRequestId: changeRequest.id, reference },
    });

    // A guest proposal is always vendor→contractor: notify the contractor admins
    // (they have accounts, so the authenticated link is right; nothing to mint).
    this.notifyChangeProposed(po, true, null, vendorLabel, {
      changeType: changeRequest.changeType,
      comment: changeRequest.message,
    }).catch(() => {});

    return this.toChangeRequestResponse(changeRequest);
  }

  /**
   * Email the counterparty about a freshly proposed change, and mirror it into
   * their in-app feed. A vendor's proposal goes to the contractor's
   * COMPANY_ADMINs — contractors always have accounts, so the authenticated link
   * is right. A contractor's proposal is vendor-bound and follows the same
   * contract as the PO issue email (CONTEXT.md): the sales reps selected on the
   * source RFQ win (falling back to the vendor's users / contact email), and the
   * "View" link is chosen per recipient (ADR-0001) — unactivated recipients get
   * the tokenised PO portal link, re-minted here because the 30-day issue token
   * may have lapsed (ADR-0002 R1 amendment).
   *
   * An INTERNAL change carries no approval ask, so it sends the "PO updated"
   * pair instead of the change-request pair.
   */
  private async notifyChangeProposed(
    po: {
      id: string;
      companyId: string;
      poNumber: string;
      vendorId: string | null;
      rfqId: string | null;
      company: { users: Array<{ email: string }> } | null;
      vendor: {
        contactEmail?: string | null;
        users?: Array<{ email: string; status: string }>;
      } | null;
    },
    proposerIsVendor: boolean,
    // Non-null only for an authenticated contractor proposer — used to mint the
    // tokenised link for unactivated vendor recipients. Guests never reach the
    // vendor-recipient branch (their proposal notifies the contractor).
    proposerUserId: string | null,
    proposedBy: string,
    change: { changeType: PoChangeType; comment: string | null },
  ): Promise<void> {
    const authenticatedUrl = `${this.webAppUrl}/purchase-orders/${po.id}`;
    const isInternal = change.changeType === PoChangeType.INTERNAL;

    // The issuing (buyer) company's logo + name, shown atop the change-request
    // email (FOR-288). Resolved once here, inside the fire-and-forget helper, so a
    // branding failure can never break the notification.
    const brand = await this.branding.getEmailBrand(po.companyId);
    const log = {
      companyId: po.companyId,
      purchaseOrderId: po.id,
      ...(proposerUserId ? { sentByUserId: proposerUserId } : {}),
    };

    const send = (email: string, url: string) =>
      isInternal
        ? this.emailService.sendPoInternalChangeEmail(email, po.poNumber, proposedBy, url, {
            brand,
            log,
          })
        : this.emailService.sendPoChangeProposedEmail(email, po.poNumber, proposedBy, url, {
            comment: change.comment,
            brand,
            log,
          });

    const feed = isInternal
      ? {
          type: NotificationType.PO_INTERNAL_CHANGE,
          title: 'Purchase order updated',
          body: `${proposedBy} saved an internal update to purchase order ${po.poNumber}.`,
        }
      : {
          type: NotificationType.CHANGE_REQUEST_PROPOSED,
          title: 'Change request submitted',
          body: `${proposedBy} requested changes to purchase order ${po.poNumber}.`,
        };

    const notify = (emails: string[]) =>
      this.notifications.createForEmails(emails, {
        ...feed,
        entityType: NotificationEntityType.PURCHASE_ORDER,
        entityId: po.id,
        // A guest proposer has no account — the vendor company stands in.
        sender: proposerUserId ? { userId: proposerUserId } : { companyName: proposedBy },
      });

    if (proposerIsVendor) {
      const admins = po.company?.users ?? [];
      await Promise.all(admins.map((u) => send(u.email, authenticatedUrl)));
      await notify(admins.map((u) => u.email));
      return;
    }

    const selectedReps =
      po.rfqId && po.vendorId
        ? (
            await this.prisma.rfqVendorContact.findMany({
              where: { rfqVendor: { rfqId: po.rfqId, vendorId: po.vendorId } },
              select: { user: { select: { email: true, status: true } } },
            })
          ).map((c) => c.user)
        : [];

    const recipients = resolveVendorRecipientsWithState(
      selectedReps,
      po.vendor?.users ?? [],
      po.vendor?.contactEmail,
    );
    if (recipients.length === 0) return;

    const tokenisedUrl =
      recipients.some((r) => !r.activated) && proposerUserId
        ? await this.mintPoViewUrl(po.id, proposerUserId)
        : null;

    await Promise.all(
      recipients.map((r) =>
        send(r.email, !r.activated && tokenisedUrl ? tokenisedUrl : authenticatedUrl),
      ),
    );
    // Only activated reps have an inbox; createForEmails drops the rest.
    await notify(recipients.map((r) => r.email));
  }

  /**
   * A usable tokenised PO-portal URL for unactivated recipients. Always mints a
   * fresh PO_VIEW token: a live token's plaintext cannot be reconstructed (only
   * its hash is stored), so reuse is impossible — the same reason the delivery
   * QR force-mints. Earlier links stay valid (PO_VIEW is validated, never
   * consumed). Returns null on failure so the caller degrades to the
   * authenticated link instead of dropping the email.
   */
  private async mintPoViewUrl(poId: string, userId: string): Promise<string | null> {
    try {
      const { token } = await this.accessTokens.issueToken({
        subjectType: AccessTokenSubject.PURCHASE_ORDER,
        subjectId: poId,
        purpose: AccessTokenPurpose.PO_VIEW,
        ttlMs: PO_TOKEN_TTL_MS,
        createdByUserId: userId,
      });
      return `${this.webAppUrl}/po/${token}`;
    } catch {
      return null;
    }
  }

  // ── List change requests ─────────────────────────────────────────────────

  async listChangeRequests(poId: string, user: AuthenticatedUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { id: true, companyId: true, vendorId: true },
    });
    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    this.validateAccess(po, user);

    const requests = await this.prisma.poChangeRequest.findMany({
      where: { purchaseOrderId: poId },
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, name: true, company: { select: { legalName: true } } } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });

    return requests.map((cr) => this.toChangeRequestResponse(cr));
  }

  /**
   * Guest counterpart to {@link listChangeRequests} — the PO_VIEW token binds the
   * request to this PO, so no user/access check is needed. Lets the tokenised
   * portal show the vendor its proposed change(s) and their resolution status.
   */
  async listChangeRequestsViaToken(poId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { id: true },
    });
    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    const requests = await this.prisma.poChangeRequest.findMany({
      where: { purchaseOrderId: poId },
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, name: true, company: { select: { legalName: true } } } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });

    return requests.map((cr) => this.toChangeRequestResponse(cr));
  }

  // ── Approve a change request ─────────────────────────────────────────────

  async approveChange(poId: string, changeRequestId: string, user: AuthenticatedUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { id: true, status: true, companyId: true, vendorId: true },
    });
    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    this.validateAccess(po, user);

    const cr = await this.prisma.poChangeRequest.findUnique({
      where: { id: changeRequestId },
      include: {
        requestedBy: { select: { id: true, name: true, role: true } },
      },
    });
    // A CR belonging to a different PO is "not found" for this route — resolving
    // it here would apply its diff onto the PO named in the URL.
    if (!cr || cr.purchaseOrderId !== poId) {
      throw new NotFoundException('Change request not found');
    }

    if (cr.status !== PoChangeRequestStatus.PENDING) {
      throw new BadRequestException('Change request is not pending');
    }
    if (cr.requestedById === user.id) {
      throw new ForbiddenException('Cannot approve your own change request');
    }

    const changedFields = (cr.changedFields ?? {}) as ChangedFields;
    const resolvedAt = new Date();

    // FOR-352 — a cancellation request short-circuits the field-apply path:
    // approving it cancels the PO itself.
    if (changedFields.cancelPo === true) {
      return this.approveCancellation(po, cr, user, resolvedAt);
    }

    await this.prisma.$transaction(async (tx) => {
      // 1) Apply PO-level field changes
      const poData = this.buildPoUpdateData(changedFields.fields);
      poData.revision = { increment: 1 };
      await tx.purchaseOrder.update({ where: { id: poId }, data: poData });

      // 2) Apply per-line-item changes (recomputing lineTotal where price/qty move)
      for (const li of changedFields.lineItems ?? []) {
        if (!li.lineItemId || !li.changes) continue;
        const existing = await tx.poLineItem.findFirst({
          where: { id: li.lineItemId, purchaseOrderId: poId },
        });
        if (!existing) continue;

        const lineData: Prisma.PoLineItemUpdateInput = {};
        for (const [field, diff] of Object.entries(li.changes)) {
          PO_LINE_FIELD_APPLIERS[field]?.(diff.to, lineData);
        }

        // Recompute lineTotal from the post-change unit price × quantity.
        const nextUnitPrice =
          lineData.unitPrice !== undefined
            ? Number(lineData.unitPrice)
            : Number(existing.unitPrice);
        const nextQty =
          lineData.quantityOrdered !== undefined
            ? Number(lineData.quantityOrdered)
            : existing.quantityOrdered;
        lineData.lineTotal = nextUnitPrice * nextQty;

        await tx.poLineItem.update({ where: { id: li.lineItemId }, data: lineData });
      }

      // 2b) FOR-352 — delete the lines the request removes. Lines with recorded
      // deliveries are protected (a DeliveryReportLine FK would reject the
      // delete anyway — this surfaces it as a 400 instead of a 500), and at
      // least one line must survive: an empty PO is a cancellation, not a change.
      const removedIds = (changedFields.removedLineItems ?? [])
        .map((li) => li?.lineItemId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      if (removedIds.length > 0) {
        const removable = await tx.poLineItem.findMany({
          where: { id: { in: removedIds }, purchaseOrderId: poId },
          select: {
            id: true,
            quantityDelivered: true,
            _count: { select: { deliveryReportLines: true } },
          },
        });
        if (removable.some((l) => l.quantityDelivered > 0 || l._count.deliveryReportLines > 0)) {
          throw new BadRequestException(
            'Cannot remove a line item that already has recorded deliveries',
          );
        }
        const totalLines = await tx.poLineItem.count({ where: { purchaseOrderId: poId } });
        if (removable.length >= totalLines) {
          throw new BadRequestException(
            'Cannot remove every line item — cancel the purchase order instead',
          );
        }
        await tx.poLineItem.deleteMany({ where: { id: { in: removable.map((l) => l.id) } } });
      }

      // 2c) Create the brand-new lines the request adds. Incomplete entries are
      // skipped rather than 400ing — the request already passed review, and a
      // partial apply of the valid lines beats failing the whole approval.
      // Catalogue snapshots (UPC/MPN/cost/tax code) resolve exactly like the
      // create-PO path; a materialId that no longer resolves is dropped so a
      // stale reference can't fail the insert.
      const addedLines = (changedFields.addedLineItems ?? []).filter(
        (li) =>
          li &&
          typeof li.unitOfMeasure === 'string' &&
          li.unitOfMeasure.length > 0 &&
          Math.trunc(Number(li.quantityOrdered)) >= 1,
      );
      if (addedLines.length > 0) {
        const snapshots = await loadMaterialSnapshots(
          this.prisma,
          addedLines.map((li) => li.materialId),
        );
        const maxLine = await tx.poLineItem.aggregate({
          where: { purchaseOrderId: poId },
          _max: { lineNumber: true },
        });
        let nextLineNumber = (maxLine._max.lineNumber ?? 0) + 1;
        for (const li of addedLines) {
          const materialId = li.materialId && snapshots.has(li.materialId) ? li.materialId : null;
          const snapshot = resolveMaterialSnapshot(li, materialId, snapshots);
          const quantityOrdered = Math.trunc(Number(li.quantityOrdered));
          const unitPrice = Math.max(0, Number(li.unitPrice) || 0);
          await tx.poLineItem.create({
            data: {
              purchaseOrderId: poId,
              lineNumber: nextLineNumber++,
              materialId,
              materialCode: toNullableString(li.materialCode),
              // Manual-name lines carry their name in `description` (same
              // convention as the create-PO payload mapping).
              description: toNullableString(li.description) ?? toNullableString(li.name),
              quantityOrdered,
              unitOfMeasure: li.unitOfMeasure as string,
              unitPrice,
              lineTotal: unitPrice * quantityOrdered,
              costCode: snapshot.costCode,
              upc: snapshot.upc,
              manufacturerPartNumber: snapshot.manufacturerPartNumber,
              taxCode: snapshot.taxCode,
              expectedDeliveryDate: toNullableDate(li.expectedDeliveryDate),
              deliveryTime: toNullableString(li.deliveryTime),
              notes: toNullableString(li.notes),
            },
          });
        }
      }

      // 3) Recompute PO money + counts from the (now updated) line items
      const lines = await tx.poLineItem.findMany({ where: { purchaseOrderId: poId } });
      const subtotal = lines.reduce((sum, l) => sum + Number(l.lineTotal), 0);
      const totalRequestedQty = lines.reduce((sum, l) => sum + l.quantityOrdered, 0);
      await tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          subtotal,
          totalAmount: subtotal,
          lineItemCount: lines.length,
          totalRequestedQty,
          lastModifiedById: user.id,
        },
      });

      // 4) Resolve the change request
      await tx.poChangeRequest.update({
        where: { id: changeRequestId },
        data: {
          status: PoChangeRequestStatus.APPROVED,
          resolvedById: user.id,
          resolvedAt,
        },
      });
    });

    const resolver = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true },
    });

    await this.auditService.log({
      action: AuditAction.PO_CHANGE_APPROVED,
      performedById: user.id,
      targetType: 'PurchaseOrder',
      targetId: poId,
      metadata: {
        changeRequestId,
        reference: cr.reference ?? null,
        changeType: cr.changeType,
        changedFields: (cr.changedFields ?? {}) as Prisma.InputJsonValue,
        requestedByName: cr.requestedBy?.name ?? null,
        resolvedByName: resolver?.name ?? user.email,
        resolvedAt: resolvedAt.toISOString(),
      },
    });

    // Notify the requester and the other party (fire-and-forget). Approving
    // captures no comment of its own, so the requester's original message is
    // what carries through as the user comment.
    this.notifyChangeResolved(cr.requestedById, poId, 'approved', user.id, cr.message).catch(
      () => {},
    );

    return { approved: true };
  }

  // ── Reject a change request ──────────────────────────────────────────────

  async rejectChange(
    poId: string,
    changeRequestId: string,
    dto: RejectPoChangeRequestDto,
    user: AuthenticatedUser,
  ) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { id: true, companyId: true, vendorId: true },
    });
    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    this.validateAccess(po, user);

    const cr = await this.prisma.poChangeRequest.findUnique({
      where: { id: changeRequestId },
      include: {
        requestedBy: { select: { id: true, name: true } },
      },
    });
    if (!cr || cr.purchaseOrderId !== poId) {
      throw new NotFoundException('Change request not found');
    }

    if (cr.status !== PoChangeRequestStatus.PENDING) {
      throw new BadRequestException('Change request is not pending');
    }
    if (cr.requestedById === user.id) {
      throw new ForbiddenException('Cannot reject your own change request');
    }

    const resolvedAt = new Date();
    await this.prisma.poChangeRequest.update({
      where: { id: changeRequestId },
      data: {
        status: PoChangeRequestStatus.REJECTED,
        reason: dto.reason ?? null,
        resolvedById: user.id,
        resolvedAt,
      },
    });

    const resolver = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true },
    });

    await this.auditService.log({
      action: AuditAction.PO_CHANGE_REJECTED,
      performedById: user.id,
      targetType: 'PurchaseOrder',
      targetId: poId,
      metadata: {
        changeRequestId,
        reference: cr.reference ?? null,
        changeType: cr.changeType,
        changedFields: (cr.changedFields ?? {}) as Prisma.InputJsonValue,
        requestedByName: cr.requestedBy?.name ?? null,
        resolvedByName: resolver?.name ?? user.email,
        reason: dto.reason ?? null,
        resolvedAt: resolvedAt.toISOString(),
      },
    });

    // Notify the requester and the other party (fire-and-forget), carrying the
    // rejecter's reason as the user comment.
    this.notifyChangeResolved(
      cr.requestedById,
      poId,
      'rejected',
      user.id,
      dto.reason ?? null,
    ).catch(() => {});

    return { rejected: true };
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * FOR-352 — apply an approved cancellation request: the PO transitions to
   * CANCELLED (contractor-requested) or CANCELLED_BY_VENDOR (vendor- or
   * guest-portal-requested), with the requester's message preserved as the
   * cancellation reason. Any other diffs the request carried are ignored —
   * cancelling supersedes them. The state machine still arbitrates: a PO that
   * moved to a non-cancellable status since the proposal rejects with a 400.
   */
  private async approveCancellation(
    po: { id: string; status: PoStatus },
    cr: {
      id: string;
      reference: string | null;
      changeType: PoChangeType;
      changedFields: Prisma.JsonValue;
      message: string | null;
      requestedById: string | null;
      requestedBy: { id: string; name: string; role: UserRole } | null;
    },
    user: AuthenticatedUser,
    resolvedAt: Date,
  ) {
    const requesterIsVendor = cr.requestedById === null || cr.requestedBy?.role === UserRole.VENDOR;
    const target = requesterIsVendor ? PoStatus.CANCELLED_BY_VENDOR : PoStatus.CANCELLED;
    assertTransition(po.status, target);

    await this.prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: target,
          ...(cr.message ? { cancellationReason: cr.message } : {}),
          lastModifiedById: user.id,
        },
      });
      await tx.poChangeRequest.update({
        where: { id: cr.id },
        data: {
          status: PoChangeRequestStatus.APPROVED,
          resolvedById: user.id,
          resolvedAt,
        },
      });
    });

    const resolver = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true },
    });

    await this.auditService.log({
      action: AuditAction.PO_CHANGE_APPROVED,
      performedById: user.id,
      targetType: 'PurchaseOrder',
      targetId: po.id,
      metadata: {
        changeRequestId: cr.id,
        reference: cr.reference ?? null,
        changeType: cr.changeType,
        changedFields: (cr.changedFields ?? {}) as Prisma.InputJsonValue,
        requestedByName: cr.requestedBy?.name ?? null,
        resolvedByName: resolver?.name ?? user.email,
        resolvedAt: resolvedAt.toISOString(),
      },
    });

    // Second entry mirroring the direct-cancel audit shape (from/to/reason) so
    // the cancellation itself reads in the action log like any other transition.
    await this.auditService.log({
      action: AuditAction.PO_CANCELLED,
      performedById: user.id,
      targetType: 'PurchaseOrder',
      targetId: po.id,
      metadata: {
        from: po.status,
        to: target,
        reason: cr.message ?? null,
        changeRequestId: cr.id,
      },
    });

    this.notifyChangeResolved(cr.requestedById, po.id, 'approved', user.id, cr.message).catch(
      () => {},
    );

    return { approved: true };
  }

  /**
   * FOR-352 — propose-time guard for `changedFields.removedLineItems`: a change
   * request may thin a PO out but never empty it — removing every line is a
   * cancellation and must be proposed as one (`cancelPo`). A cancellation
   * request skips the check because its removals are ignored on apply. Ids not
   * on the PO are ignored here and again when applying.
   */
  private async validateProposedRemovals(
    poId: string,
    dto: CreatePoChangeRequestDto,
  ): Promise<void> {
    const changed = (dto.changedFields ?? {}) as ChangedFields;
    if (changed.cancelPo === true) return;

    const removedIds = new Set(
      (changed.removedLineItems ?? [])
        .map((li) => li?.lineItemId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    );
    if (removedIds.size === 0) return;

    const lines = await this.prisma.poLineItem.findMany({
      where: { purchaseOrderId: poId },
      select: { id: true },
    });
    const removals = lines.filter((l) => removedIds.has(l.id)).length;
    if (lines.length > 0 && removals >= lines.length) {
      throw new BadRequestException(
        'Cannot remove every line item — request a cancellation instead',
      );
    }
  }

  /** Build a typed PO update from the allowlisted `changedFields.fields` diff. */
  private buildPoUpdateData(
    fields: Record<string, ChangedFieldDiff> | undefined,
  ): Prisma.PurchaseOrderUncheckedUpdateInput {
    const data: Prisma.PurchaseOrderUncheckedUpdateInput = {};
    for (const [field, diff] of Object.entries(fields ?? {})) {
      PO_FIELD_APPLIERS[field]?.(diff.to, data);
    }
    return data;
  }

  /** Next "CR-###" reference for a PO, sequential by existing request count. */
  private async nextChangeReference(poId: string): Promise<string> {
    const count = await this.prisma.poChangeRequest.count({
      where: { purchaseOrderId: poId },
    });
    return `CR-${String(count + 1).padStart(3, '0')}`;
  }

  private toChangeRequestResponse(cr: {
    id: string;
    purchaseOrderId: string;
    reference: string | null;
    changeType: PoChangeType;
    changedFields: Prisma.JsonValue;
    message: string | null;
    status: PoChangeRequestStatus;
    reason: string | null;
    resolvedAt: Date | null;
    createdAt: Date;
    requestedByLabel?: string | null;
    requestedBy?: { id: string; name: string; company?: { legalName: string } | null } | null;
    resolvedBy?: { id: string; name: string } | null;
  }) {
    return {
      id: cr.id,
      purchaseOrderId: cr.purchaseOrderId,
      reference: cr.reference,
      changeType: cr.changeType,
      changedFields: cr.changedFields,
      message: cr.message,
      status: cr.status,
      reason: cr.reason,
      // Guest (tokenised) proposers have no user — fall back to the stored label.
      requestedByName: cr.requestedBy?.name ?? cr.requestedByLabel ?? null,
      requestedByCompanyName: cr.requestedBy?.company?.legalName ?? cr.requestedByLabel ?? null,
      resolvedByName: cr.resolvedBy?.name ?? null,
      resolvedAt: cr.resolvedAt?.toISOString() ?? null,
      createdAt: cr.createdAt.toISOString(),
    };
  }

  /**
   * Tell both parties the outcome of a change request (approved/rejected) — the
   * matrix routes the resolution to the requester *and* the other party, so this
   * fans out across the contractor's COMPANY_ADMINs, the authenticated requester
   * (who need not be an admin), and the vendor's recipients.
   *
   * The vendor side mirrors `notifyChangeProposed`: RFQ sales reps win, else the
   * vendor's users / contact email, and anyone not yet activated gets a fresh
   * tokenised portal link — `resolverUserId` is the approver/rejecter, used to
   * mint it. A guest (tokenised) requester has no account (`requestedById` is
   * null) and is reached through that same vendor set.
   */
  private async notifyChangeResolved(
    requestedById: string | null,
    poId: string,
    outcome: 'approved' | 'rejected',
    resolverUserId: string,
    comment: string | null,
  ): Promise<void> {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: {
        id: true,
        poNumber: true,
        companyId: true,
        vendorId: true,
        rfqId: true,
        company: {
          select: {
            users: { where: { role: UserRole.COMPANY_ADMIN }, select: { email: true } },
          },
        },
        vendor: {
          select: {
            contactEmail: true,
            users: { where: { role: UserRole.VENDOR }, select: { email: true, status: true } },
          },
        },
      },
    });
    if (!po) return;

    // The issuing (buyer) company's logo + name, shown atop the approved/rejected
    // email (FOR-288). Resolved inside this fire-and-forget helper so a branding
    // failure never breaks the notification.
    const brand = await this.branding.getEmailBrand(po.companyId);
    const log = { companyId: po.companyId, purchaseOrderId: poId, sentByUserId: resolverUserId };

    const authenticatedUrl = `${this.webAppUrl}/purchase-orders/${poId}`;
    const send = (email: string, url: string) =>
      outcome === 'approved'
        ? this.emailService.sendPoChangeApprovedEmail(email, po.poNumber, url, {
            comment,
            brand,
            log,
          })
        : this.emailService.sendPoChangeRejectedEmail(email, po.poNumber, url, {
            comment,
            brand,
            log,
          });

    // ── Contractor side: company admins + the authenticated requester ──────────
    const contractorEmails = new Set((po.company?.users ?? []).map((u) => u.email));
    if (requestedById) {
      const requester = await this.prisma.user.findUnique({
        where: { id: requestedById },
        select: { email: true },
      });
      // A vendor-side requester is already covered by the vendor fan-out below;
      // adding them here is harmless because the two sets are de-duplicated
      // per-recipient before sending.
      if (requester) contractorEmails.add(requester.email);
    }

    // ── Vendor side ───────────────────────────────────────────────────────────
    const selectedReps =
      po.rfqId && po.vendorId
        ? (
            await this.prisma.rfqVendorContact.findMany({
              where: { rfqVendor: { rfqId: po.rfqId, vendorId: po.vendorId } },
              select: { user: { select: { email: true, status: true } } },
            })
          ).map((c) => c.user)
        : [];

    const vendorRecipients = resolveVendorRecipientsWithState(
      selectedReps,
      po.vendor?.users ?? [],
      po.vendor?.contactEmail,
    );

    const tokenisedUrl = vendorRecipients.some((r) => !r.activated)
      ? await this.mintPoViewUrl(poId, resolverUserId)
      : null;

    // One email per address, contractor links taking precedence — an address on
    // both sides is a contractor user and should get the authenticated link.
    const urlByEmail = new Map<string, string>();
    for (const r of vendorRecipients) {
      urlByEmail.set(r.email, !r.activated && tokenisedUrl ? tokenisedUrl : authenticatedUrl);
    }
    for (const email of contractorEmails) {
      urlByEmail.set(email, authenticatedUrl);
    }
    if (urlByEmail.size === 0) return;

    await Promise.all([...urlByEmail].map(([email, url]) => send(email, url)));

    await this.notifications.createForEmails([...urlByEmail.keys()], {
      type:
        outcome === 'approved'
          ? NotificationType.CHANGE_REQUEST_APPROVED
          : NotificationType.CHANGE_REQUEST_REJECTED,
      title: outcome === 'approved' ? 'Change request approved' : 'Change request rejected',
      body:
        outcome === 'approved'
          ? `The change request for purchase order ${po.poNumber} was approved.`
          : `The change request for purchase order ${po.poNumber} was rejected.`,
      entityType: NotificationEntityType.PURCHASE_ORDER,
      entityId: poId,
      sender: { userId: resolverUserId },
    });
  }

  private validateAccess(
    po: { companyId: string; vendorId: string | null },
    user: AuthenticatedUser,
  ): void {
    if (!canReadPurchaseOrder(po, user)) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }
  }
}
