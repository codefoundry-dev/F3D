import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  PickUpTimeExpectation,
  PoChangeRequestStatus,
  PoChangeType,
  PoStatus,
  Prisma,
  UserRole,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { resolveVendorEmailRecipients } from '../../common/utils/vendor-recipients.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../notifications/email.service';

import { CreatePoChangeRequestDto, RejectPoChangeRequestDto } from './po-change.dto';

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
interface ChangedFields {
  fields?: Record<string, ChangedFieldDiff>;
  lineItems?: ChangedLineItem[];
}

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

@Injectable()
export class PoChangeService {
  private readonly webAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    config: ConfigService,
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
        poNumber: true,
        company: {
          select: {
            users: { where: { role: UserRole.COMPANY_ADMIN }, select: { email: true } },
          },
        },
        vendor: {
          select: {
            contactEmail: true,
            users: { where: { role: UserRole.VENDOR }, select: { email: true } },
          },
        },
      },
    });
    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    this.validateAccess(po, user);

    const allowedStatuses: PoStatus[] = [PoStatus.SENT, PoStatus.ACKNOWLEDGED, PoStatus.ACCEPTED];
    if (!allowedStatuses.includes(po.status)) {
      throw new BadRequestException(`Cannot propose changes: PO status is ${po.status}`);
    }

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

    // Notify the other party (fire-and-forget). When the contractor proposes a
    // change the recipient is the vendor, which may have been quick-added with
    // only a contactEmail and no user accounts (US-3.01) — fall back to it.
    // Contractors always have COMPANY_ADMIN user accounts, so no fallback there.
    const isVendor = user.role === UserRole.VENDOR;
    const recipientEmails = isVendor
      ? (po.company?.users ?? []).map((u) => u.email)
      : resolveVendorEmailRecipients(po.vendor?.users ?? [], po.vendor?.contactEmail);
    const viewUrl = `${this.webAppUrl}/purchase-orders/${poId}`;
    const proposedBy = changeRequest.requestedBy?.name ?? 'A user';

    Promise.all(
      recipientEmails.map((email) =>
        this.emailService.sendChangeRequestProposedEmail(email, po.poNumber, proposedBy, viewUrl),
      ),
    ).catch(() => {});

    return this.toChangeRequestResponse(changeRequest);
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

  // ── Approve a change request ─────────────────────────────────────────────

  async approveChange(poId: string, changeRequestId: string, user: AuthenticatedUser) {
    const cr = await this.prisma.poChangeRequest.findUnique({
      where: { id: changeRequestId },
      include: {
        requestedBy: { select: { id: true, name: true } },
      },
    });
    if (!cr) throw new NotFoundException('Change request not found');

    if (cr.status !== PoChangeRequestStatus.PENDING) {
      throw new BadRequestException('Change request is not pending');
    }
    if (cr.requestedById === user.id) {
      throw new ForbiddenException('Cannot approve your own change request');
    }

    const changedFields = (cr.changedFields ?? {}) as ChangedFields;
    const resolvedAt = new Date();

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

    // Notify the requester that their change was approved (fire-and-forget)
    this.notifyChangeRequestRequester(cr.requestedById, poId, 'approved').catch(() => {});

    return { approved: true };
  }

  // ── Reject a change request ──────────────────────────────────────────────

  async rejectChange(
    poId: string,
    changeRequestId: string,
    dto: RejectPoChangeRequestDto,
    user: AuthenticatedUser,
  ) {
    const cr = await this.prisma.poChangeRequest.findUnique({
      where: { id: changeRequestId },
      include: {
        requestedBy: { select: { id: true, name: true } },
      },
    });
    if (!cr) throw new NotFoundException('Change request not found');

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

    // Notify the requester that their change was rejected (fire-and-forget)
    this.notifyChangeRequestRequester(cr.requestedById, poId, 'rejected').catch(() => {});

    return { rejected: true };
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

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
      requestedByName: cr.requestedBy?.name ?? null,
      requestedByCompanyName: cr.requestedBy?.company?.legalName ?? null,
      resolvedByName: cr.resolvedBy?.name ?? null,
      resolvedAt: cr.resolvedAt?.toISOString() ?? null,
      createdAt: cr.createdAt.toISOString(),
    };
  }

  private async notifyChangeRequestRequester(
    requestedById: string,
    poId: string,
    outcome: 'approved' | 'rejected',
  ): Promise<void> {
    const requester = await this.prisma.user.findUnique({
      where: { id: requestedById },
      select: { email: true, role: true },
    });
    if (!requester) return;

    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { poNumber: true },
    });
    if (!po) return;

    const viewUrl = `${this.webAppUrl}/purchase-orders/${poId}`;

    if (outcome === 'approved') {
      await this.emailService.sendChangeRequestApprovedEmail(requester.email, po.poNumber, viewUrl);
    } else {
      await this.emailService.sendChangeRequestRejectedEmail(requester.email, po.poNumber, viewUrl);
    }
  }

  private validateAccess(
    po: { companyId: string; vendorId: string | null },
    user: AuthenticatedUser,
  ): void {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (user.role === UserRole.VENDOR) {
      if (user.companyId !== po.vendorId) {
        throw new ForbiddenException(ERR.general.accessDenied);
      }
    } else {
      if (user.companyId !== po.companyId) {
        throw new ForbiddenException(ERR.general.accessDenied);
      }
    }
  }
}
