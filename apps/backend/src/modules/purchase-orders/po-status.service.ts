import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApprovalStatus,
  PoStatus as PrismaPoStatus,
  UserRole as PrismaUserRole,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';

import { PoExportService } from './po-export.service';
import { VendorAcceptPoDto, VendorDeclinePoDto } from './po-vendor.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

@Injectable()
export class PoStatusService {
  private readonly vendorAppUrl: string;
  private readonly companyAdminAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PurchaseOrdersService))
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly emailService: EmailService,
    private readonly poExportService: PoExportService,
    config: ConfigService,
  ) {
    this.vendorAppUrl = config.get<string>('VENDOR_APP_URL', 'http://localhost:3003');
    this.companyAdminAppUrl = config.get<string>('COMPANY_ADMIN_APP_URL', 'http://localhost:3002');
  }

  // ── Issue Purchase Order ───────────────────────────────────────────────

  async issuePurchaseOrder(id: string, user: AuthenticatedUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true },
    });

    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== po.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (po.status !== PrismaPoStatus.DRAFT) {
      throw new BadRequestException(ERR.purchaseOrders.cannotIssue(po.status));
    }

    const updated = await this.prisma.purchaseOrder.update({
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
            users: { where: { role: PrismaUserRole.VENDOR }, select: { email: true } },
          },
        },
      },
    });

    // Send email notification to vendor with PDF attachment (fire-and-forget)
    this.notifyVendorOfPo(id, updated.poNumber, updated.vendor?.users ?? [], user).catch(() => {});

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

    await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PrismaPoStatus.ACKNOWLEDGED,
        lastModifiedById: user.id,
      },
    });

    return this.purchaseOrdersService.getPurchaseOrder(id, user);
  }

  // ── Approve Purchase Order ───────────────────────────────────────────────

  async approvePurchaseOrder(id: string, user: AuthenticatedUser) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true },
    });

    if (!po) throw new NotFoundException(ERR.purchaseOrders.notFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== po.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (po.status !== PrismaPoStatus.DRAFT && po.status !== PrismaPoStatus.SENT) {
      throw new BadRequestException(ERR.purchaseOrders.cannotApprove(po.status));
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PrismaPoStatus.ACKNOWLEDGED,
        approvalStatus: ApprovalStatus.APPROVED,
        approvedById: user.id,
        lastModifiedById: user.id,
      },
      include: {
        project: { select: { name: true } },
        vendor: { select: { legalName: true } },
      },
    });

    return {
      id: updated.id,
      projectName: updated.project.name,
      status: updated.status,
      vendorName: updated.vendor?.legalName ?? null,
    };
  }

  // ── Decline Purchase Order ───────────────────────────────────────────────

  async declinePurchaseOrder(id: string, user: AuthenticatedUser) {
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

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PrismaPoStatus.CANCELLED,
        approvalStatus: ApprovalStatus.REJECTED,
        lastModifiedById: user.id,
      },
      include: {
        project: { select: { name: true } },
        vendor: { select: { legalName: true } },
      },
    });

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
              where: { role: PrismaUserRole.COMPANY_ADMIN },
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

    await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PrismaPoStatus.CANCELLED_BY_VENDOR,
        lastModifiedById: user.id,
        ...(dto?.reason && { deliveryNotes: dto.reason }),
      },
    });

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

    await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PrismaPoStatus.CANCELLED, lastModifiedById: user.id },
    });

    return { success: true };
  }

  // ── Email notification helpers ──────────────────────────────────────────

  private async notifyVendorOfPo(
    poId: string,
    poNumber: string,
    vendorUsers: Array<{ email: string }>,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (vendorUsers.length === 0) return;

    // Generate PDF buffer for email attachment
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await this.poExportService.generatePoPdfBuffer(poId, user);
    } catch {
      // PDF generation failure is non-critical — send email without attachment
    }

    const viewUrl = `${this.vendorAppUrl}/purchase-orders/${poId}`;

    await Promise.all(
      vendorUsers.map((u) =>
        this.emailService.sendPoIssuedEmail(u.email, poNumber, viewUrl, pdfBuffer),
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

    const viewUrl = `${this.companyAdminAppUrl}/purchase-orders/${poId}`;

    await Promise.all(
      companyAdmins.map((u) =>
        this.emailService.sendPoDeclinedByVendorEmail(
          u.email,
          poNumber,
          vendorName,
          viewUrl,
          reason,
        ),
      ),
    );
  }
}
