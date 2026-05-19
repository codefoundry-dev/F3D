import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditAction,
  PoChangeType,
  PoStatus,
  UserRole,
  UserRole as PrismaUserRole,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../notifications/email.service';

import { CreatePoChangeRequestDto, RejectPoChangeRequestDto } from './po-change.dto';

// These will be available after `prisma generate` with the updated schema
const PoChangeRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

@Injectable()
export class PoChangeService {
  private readonly vendorAppUrl: string;
  private readonly companyAdminAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    config: ConfigService,
  ) {
    this.vendorAppUrl = config.get<string>('VENDOR_APP_URL', 'http://localhost:3003');
    this.companyAdminAppUrl = config.get<string>('COMPANY_ADMIN_APP_URL', 'http://localhost:3002');
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
            users: { where: { role: PrismaUserRole.COMPANY_ADMIN }, select: { email: true } },
          },
        },
        vendor: {
          select: { users: { where: { role: PrismaUserRole.VENDOR }, select: { email: true } } },
        },
      },
    });
    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    this.validateAccess(po, user);

    const allowedStatuses: PoStatus[] = [PoStatus.SENT, PoStatus.ACKNOWLEDGED, PoStatus.ACCEPTED];
    if (!allowedStatuses.includes(po.status)) {
      throw new BadRequestException(`Cannot propose changes: PO status is ${po.status}`);
    }

    const changeRequest = await this.prisma.poChangeRequest.create({
      data: {
        purchaseOrderId: poId,
        changeType: dto.changeType as PoChangeType,
        changedFields: dto.changedFields as object,
        requestedById: user.id,
      } as never,
      include: {
        requestedBy: { select: { id: true, name: true } },
      },
    });

    await this.auditService.log({
      action: 'PO_CHANGE_PROPOSED' as AuditAction,
      performedById: user.id,
      targetType: 'PurchaseOrder',
      targetId: poId,
      metadata: { changeRequestId: changeRequest.id },
    });

    // Notify the other party (fire-and-forget)
    const isVendor = user.role === UserRole.VENDOR;
    const recipients = isVendor ? (po.company?.users ?? []) : (po.vendor?.users ?? []);
    const viewUrl = isVendor
      ? `${this.companyAdminAppUrl}/purchase-orders/${poId}`
      : `${this.vendorAppUrl}/purchase-orders/${poId}`;
    const proposedBy = changeRequest.requestedBy?.name ?? 'A user';

    Promise.all(
      recipients.map((u) =>
        this.emailService.sendChangeRequestProposedEmail(u.email, po.poNumber, proposedBy, viewUrl),
      ),
    ).catch(() => {});

    return changeRequest;
  }

  // ── List change requests ─────────────────────────────────────────────────

  async listChangeRequests(poId: string, user: AuthenticatedUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: poId },
      select: { id: true, companyId: true, vendorId: true },
    });
    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    this.validateAccess(po, user);

    return this.prisma.poChangeRequest.findMany({
      where: { purchaseOrderId: poId },
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });
  }

  // ── Approve a change request ─────────────────────────────────────────────

  async approveChange(poId: string, changeRequestId: string, user: AuthenticatedUser) {
    const cr = await this.prisma.poChangeRequest.findUnique({
      where: { id: changeRequestId },
    });
    if (!cr) throw new NotFoundException('Change request not found');

    const status = (cr as unknown as Record<string, unknown>).status ?? 'PENDING';
    if (status !== PoChangeRequestStatus.PENDING) {
      throw new BadRequestException('Change request is not pending');
    }
    if (cr.requestedById === user.id) {
      throw new ForbiddenException('Cannot approve your own change request');
    }

    await this.prisma.poChangeRequest.update({
      where: { id: changeRequestId },
      data: {
        approvedById: user.id,
      } as never,
    });

    await this.auditService.log({
      action: 'PO_CHANGE_APPROVED' as AuditAction,
      performedById: user.id,
      targetType: 'PurchaseOrder',
      targetId: poId,
      metadata: { changeRequestId },
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
    });
    if (!cr) throw new NotFoundException('Change request not found');

    const status = (cr as unknown as Record<string, unknown>).status ?? 'PENDING';
    if (status !== PoChangeRequestStatus.PENDING) {
      throw new BadRequestException('Change request is not pending');
    }
    if (cr.requestedById === user.id) {
      throw new ForbiddenException('Cannot reject your own change request');
    }

    await this.prisma.poChangeRequest.update({
      where: { id: changeRequestId },
      data: {
        approvedById: user.id,
      } as never,
    });

    void dto.reason; // Will be stored after prisma generate

    await this.auditService.log({
      action: 'PO_CHANGE_REJECTED' as AuditAction,
      performedById: user.id,
      targetType: 'PurchaseOrder',
      targetId: poId,
      metadata: { changeRequestId, reason: dto.reason },
    });

    // Notify the requester that their change was rejected (fire-and-forget)
    this.notifyChangeRequestRequester(cr.requestedById, poId, 'rejected').catch(() => {});

    return { rejected: true };
  }

  // ── Access validation ────────────────────────────────────────────────────

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

    const viewUrl =
      requester.role === PrismaUserRole.VENDOR
        ? `${this.vendorAppUrl}/purchase-orders/${poId}`
        : `${this.companyAdminAppUrl}/purchase-orders/${poId}`;

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
