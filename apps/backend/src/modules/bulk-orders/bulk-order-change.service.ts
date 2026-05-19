import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  BulkOrderChangeRequestStatus,
  BulkOrderStatus,
  Prisma,
  UserRole as PrismaUserRole,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../notifications/email.service';

import { CreateBulkOrderChangeRequestDto, RejectChangeRequestDto } from './bulk-order-change.dto';

@Injectable()
export class BulkOrderChangeService {
  private readonly vendorAppUrl: string;
  private readonly companyAdminAppUrl: string;
  private readonly procurementOfficerAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    config: ConfigService,
  ) {
    this.vendorAppUrl = config.get<string>('VENDOR_APP_URL', 'http://localhost:3003');
    this.companyAdminAppUrl = config.get<string>('COMPANY_ADMIN_APP_URL', 'http://localhost:3002');
    this.procurementOfficerAppUrl = config.get<string>(
      'PROCUREMENT_OFFICER_APP_URL',
      'http://localhost:3005',
    );
  }

  // ── Propose a change ─────────────────────────────────────────────────────

  async proposeChange(
    bulkOrderId: string,
    dto: CreateBulkOrderChangeRequestDto,
    user: AuthenticatedUser,
  ) {
    const bo = await this.prisma.bulkOrder.findUnique({ where: { id: bulkOrderId } });
    if (!bo) throw new NotFoundException(ERR.bulkOrders.notFound);

    if (bo.status !== BulkOrderStatus.ACTIVE) {
      throw new BadRequestException(
        ERR.bulkOrders.cannotModifyClosed.replace('{{status}}', bo.status),
      );
    }

    // Validate user has access (vendor or contractor of this bulk order)
    this.validateAccess(bo, user);

    const changeRequest = await this.prisma.bulkOrderChangeRequest.create({
      data: {
        bulkOrderId,
        requestedByUserId: user.id,
        changes: {
          endDate: dto.endDate ?? null,
          lineItems: (dto.lineItems ?? []) as unknown as Prisma.InputJsonValue,
        } as Prisma.InputJsonValue,
        message: dto.message,
        status: BulkOrderChangeRequestStatus.PENDING,
      },
      include: {
        requestedBy: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      action: AuditAction.BULK_ORDER_CHANGE_PROPOSED,
      performedById: user.id,
      targetType: 'BulkOrder',
      targetId: bulkOrderId,
    });

    // Notify the other party via email (fire-and-forget)
    const bulkId = `BO-${bulkOrderId.slice(0, 8).toUpperCase()}`;
    const proposerName = changeRequest.requestedBy.name;
    if (user.companyId) {
      void this.notifyCounterpartyOfProposal(bo, bulkId, proposerName, user.companyId);
    }

    return changeRequest;
  }

  // ── List change requests ─────────────────────────────────────────────────

  async listChangeRequests(bulkOrderId: string, user: AuthenticatedUser) {
    const bo = await this.prisma.bulkOrder.findUnique({ where: { id: bulkOrderId } });
    if (!bo) throw new NotFoundException(ERR.bulkOrders.notFound);

    this.validateAccess(bo, user);

    return this.prisma.bulkOrderChangeRequest.findMany({
      where: { bulkOrderId },
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });
  }

  // ── Approve a change request ─────────────────────────────────────────────

  async approveChange(bulkOrderId: string, changeRequestId: string, user: AuthenticatedUser) {
    const bo = await this.prisma.bulkOrder.findUnique({
      where: { id: bulkOrderId },
      include: { lineItems: true },
    });
    if (!bo) throw new NotFoundException(ERR.bulkOrders.notFound);

    const cr = await this.prisma.bulkOrderChangeRequest.findUnique({
      where: { id: changeRequestId },
    });
    if (!cr) throw new NotFoundException(ERR.bulkOrders.changeRequestNotFound);
    if (cr.status !== BulkOrderChangeRequestStatus.PENDING) {
      throw new BadRequestException(ERR.bulkOrders.changeRequestNotPending);
    }
    if (cr.requestedByUserId === user.id) {
      throw new ForbiddenException(ERR.bulkOrders.cannotChangeOwnRequest);
    }

    const changes = cr.changes as {
      endDate?: string | null;
      lineItems?: Array<{
        lineItemId?: string;
        action: string;
        unitPrice?: number;
        quantity?: number;
        uom?: string;
        itemReference?: string;
        description?: string;
      }>;
    };

    await this.prisma.$transaction(async (tx) => {
      // Apply changes
      if (changes.endDate) {
        await tx.bulkOrder.update({
          where: { id: bulkOrderId },
          data: { endDate: new Date(changes.endDate) },
        });
      }

      if (changes.lineItems?.length) {
        for (const li of changes.lineItems) {
          if (li.action === 'update' && li.lineItemId) {
            const existing = bo.lineItems.find((item) => item.id === li.lineItemId);
            if (!existing) continue;

            const newQty = li.quantity ?? existing.qty;
            const newPrice = li.unitPrice ?? Number(existing.pricePerUnit);
            const qtyDiff = newQty - existing.qty;

            await tx.bulkOrderLineItem.update({
              where: { id: li.lineItemId },
              data: {
                ...(li.quantity !== undefined && {
                  qty: newQty,
                  qtyRemaining: existing.qtyRemaining + qtyDiff,
                }),
                ...(li.unitPrice !== undefined && { pricePerUnit: li.unitPrice }),
                ...(li.uom !== undefined && { unit: li.uom }),
                totalLineInc: newQty * newPrice,
              },
            });
          } else if (li.action === 'add') {
            const qty = li.quantity ?? 0;
            const price = li.unitPrice ?? 0;
            await tx.bulkOrderLineItem.create({
              data: {
                bulkOrderId,
                itemReference: li.itemReference ?? '',
                description: li.description ?? '',
                qty,
                unit: li.uom ?? 'EA',
                ordered: 0,
                qtyRemaining: qty,
                pricePerUnit: price,
                totalLineInc: qty * price,
              },
            });
          } else if (li.action === 'remove' && li.lineItemId) {
            await tx.bulkOrderLineItem.delete({ where: { id: li.lineItemId } });
          }
        }
      }

      // Recalculate total amount
      const allItems = await tx.bulkOrderLineItem.findMany({ where: { bulkOrderId } });
      const newTotal = allItems.reduce((sum, item) => sum + Number(item.totalLineInc), 0);

      // Bump version
      await tx.bulkOrder.update({
        where: { id: bulkOrderId },
        data: {
          version: { increment: 1 },
          totalAmount: newTotal,
        },
      });

      // Mark change request as approved
      await tx.bulkOrderChangeRequest.update({
        where: { id: changeRequestId },
        data: {
          status: BulkOrderChangeRequestStatus.APPROVED,
          resolvedByUserId: user.id,
          resolvedAt: new Date(),
        },
      });
    });

    await this.auditService.log({
      action: AuditAction.BULK_ORDER_CHANGE_APPROVED,
      performedById: user.id,
      targetType: 'BulkOrder',
      targetId: bulkOrderId,
      metadata: { changeRequestId },
    });

    // Notify both parties (fire-and-forget)
    const bulkId = `BO-${bulkOrderId.slice(0, 8).toUpperCase()}`;
    void this.notifyBothPartiesOfResolution(bo, bulkId, 'approved');

    return { approved: true };
  }

  // ── Reject a change request ──────────────────────────────────────────────

  async rejectChange(
    bulkOrderId: string,
    changeRequestId: string,
    dto: RejectChangeRequestDto,
    user: AuthenticatedUser,
  ) {
    const bo = await this.prisma.bulkOrder.findUnique({ where: { id: bulkOrderId } });
    if (!bo) throw new NotFoundException(ERR.bulkOrders.notFound);

    const cr = await this.prisma.bulkOrderChangeRequest.findUnique({
      where: { id: changeRequestId },
    });
    if (!cr) throw new NotFoundException(ERR.bulkOrders.changeRequestNotFound);
    if (cr.status !== BulkOrderChangeRequestStatus.PENDING) {
      throw new BadRequestException(ERR.bulkOrders.changeRequestNotPending);
    }
    if (cr.requestedByUserId === user.id) {
      throw new ForbiddenException(ERR.bulkOrders.cannotChangeOwnRequest);
    }

    await this.prisma.bulkOrderChangeRequest.update({
      where: { id: changeRequestId },
      data: {
        status: BulkOrderChangeRequestStatus.REJECTED,
        reason: dto.reason,
        resolvedByUserId: user.id,
        resolvedAt: new Date(),
      },
    });

    await this.auditService.log({
      action: AuditAction.BULK_ORDER_CHANGE_REJECTED,
      performedById: user.id,
      targetType: 'BulkOrder',
      targetId: bulkOrderId,
      metadata: { changeRequestId },
    });

    // Notify both parties (fire-and-forget)
    const bulkId = `BO-${bulkOrderId.slice(0, 8).toUpperCase()}`;
    void this.notifyBothPartiesOfResolution(bo, bulkId, 'rejected');

    return { rejected: true };
  }

  // ── Cancel bulk order ────────────────────────────────────────────────────

  async cancelBulkOrder(bulkOrderId: string, user: AuthenticatedUser) {
    const bo = await this.prisma.bulkOrder.findUnique({ where: { id: bulkOrderId } });
    if (!bo) throw new NotFoundException(ERR.bulkOrders.notFound);

    if (bo.status === BulkOrderStatus.CANCELLED) {
      throw new BadRequestException(ERR.bulkOrders.alreadyCancelled);
    }

    this.validateAccess(bo, user);

    await this.prisma.bulkOrder.update({
      where: { id: bulkOrderId },
      data: { status: BulkOrderStatus.CANCELLED },
    });

    // Reject all pending change requests
    await this.prisma.bulkOrderChangeRequest.updateMany({
      where: {
        bulkOrderId,
        status: BulkOrderChangeRequestStatus.PENDING,
      },
      data: {
        status: BulkOrderChangeRequestStatus.REJECTED,
        reason: 'Bulk order cancelled',
        resolvedByUserId: user.id,
        resolvedAt: new Date(),
      },
    });

    await this.auditService.log({
      action: AuditAction.BULK_ORDER_CANCELLED,
      performedById: user.id,
      targetType: 'BulkOrder',
      targetId: bulkOrderId,
    });

    // Notify both parties (fire-and-forget)
    const bulkId = `BO-${bulkOrderId.slice(0, 8).toUpperCase()}`;
    const cancellerUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true },
    });
    void this.notifyBothPartiesOfResolution(
      bo,
      bulkId,
      'cancelled',
      cancellerUser?.name ?? user.email,
    );

    return { cancelled: true };
  }

  // ── Access validation ────────────────────────────────────────────────────

  private validateAccess(
    bo: { companyId: string; vendorId: string },
    user: AuthenticatedUser,
  ): void {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (user.role === UserRole.VENDOR) {
      if (user.companyId !== bo.vendorId) {
        throw new ForbiddenException(ERR.general.accessDenied);
      }
    } else {
      if (user.companyId !== bo.companyId) {
        throw new ForbiddenException(ERR.general.accessDenied);
      }
    }
  }

  // ── Email notification helpers ─────────────────────────────────────────

  private getBulkOrderUrl(bulkOrderId: string, role: PrismaUserRole): string {
    const base =
      role === PrismaUserRole.VENDOR
        ? this.vendorAppUrl
        : role === PrismaUserRole.PROCUREMENT_OFFICER
          ? this.procurementOfficerAppUrl
          : this.companyAdminAppUrl;
    return `${base}/bulk-orders/${bulkOrderId}`;
  }

  private async getCounterpartyEmails(
    bo: { companyId: string; vendorId: string },
    requesterCompanyId: string,
  ): Promise<{ emails: string[]; isVendorCounterparty: boolean }> {
    const isRequesterVendor = requesterCompanyId === bo.vendorId;
    const counterpartyCompanyId = isRequesterVendor ? bo.companyId : bo.vendorId;
    const counterpartyRoles = isRequesterVendor
      ? [PrismaUserRole.COMPANY_ADMIN, PrismaUserRole.PROCUREMENT_OFFICER]
      : [PrismaUserRole.VENDOR];

    const users = await this.prisma.user.findMany({
      where: {
        companyId: counterpartyCompanyId,
        role: { in: counterpartyRoles },
        status: 'ACTIVE',
      },
      select: { email: true, role: true },
    });

    return {
      emails: users.map((u) => u.email),
      isVendorCounterparty: !isRequesterVendor,
    };
  }

  private async notifyCounterpartyOfProposal(
    bo: { id: string; companyId: string; vendorId: string },
    bulkId: string,
    proposerName: string,
    requesterCompanyId: string,
  ): Promise<void> {
    try {
      const { emails, isVendorCounterparty } = await this.getCounterpartyEmails(
        bo,
        requesterCompanyId,
      );
      const counterpartyRole = isVendorCounterparty
        ? PrismaUserRole.VENDOR
        : PrismaUserRole.COMPANY_ADMIN;
      const viewUrl = `${this.getBulkOrderUrl(bo.id, counterpartyRole)}/review-change`;

      await Promise.all(
        emails.map((email) =>
          this.emailService.sendChangeRequestProposedEmail(email, bulkId, proposerName, viewUrl),
        ),
      );
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  private async notifyBothPartiesOfResolution(
    bo: { id: string; companyId: string; vendorId: string },
    bulkId: string,
    type: 'approved' | 'rejected' | 'cancelled',
    cancelledByName?: string,
  ): Promise<void> {
    try {
      const allRoles = [
        PrismaUserRole.COMPANY_ADMIN,
        PrismaUserRole.PROCUREMENT_OFFICER,
        PrismaUserRole.VENDOR,
      ];

      const users = await this.prisma.user.findMany({
        where: {
          companyId: { in: [bo.companyId, bo.vendorId] },
          role: { in: allRoles },
          status: 'ACTIVE',
        },
        select: { email: true, role: true },
      });

      await Promise.all(
        users.map((u) => {
          const viewUrl = this.getBulkOrderUrl(bo.id, u.role);
          if (type === 'approved') {
            return this.emailService.sendChangeRequestApprovedEmail(u.email, bulkId, viewUrl);
          } else if (type === 'rejected') {
            return this.emailService.sendChangeRequestRejectedEmail(u.email, bulkId, viewUrl);
          } else {
            return this.emailService.sendBulkOrderCancelledEmail(
              u.email,
              bulkId,
              cancelledByName ?? '',
            );
          }
        }),
      );
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }
}
