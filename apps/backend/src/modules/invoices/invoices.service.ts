import { randomUUID } from 'crypto';
import * as path from 'path';

import {
  ApproveInvoiceDto,
  InvoiceListQueryDto,
  RejectInvoiceDto,
  ReviewInvoiceDto,
  buildPaginationMeta,
  type InvoiceExtractionResult,
} from '@forethread/shared-types';
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
  ApprovalStatus,
  CompanyType,
  DocExtractionStatus,
  DocExtractionType,
  NotificationEntityType,
  NotificationType,
  InvoiceStatus as PrismaInvoiceStatus,
  Prisma,
  UserRole,
} from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ApprovalAuthorizationService, type ApproverPoolMember } from '../../common/permissions';
import { invoiceReference } from '../../common/utils/invoice-reference.util';
import { resolveVendorEmailRecipients } from '../../common/utils/vendor-recipients.util';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { AuditAction, AuditService } from '../audit/audit.service';
import { BrandingService } from '../export/branding.service';
import { NotificationService } from '../notification-feed/notification.service';
import { EmailService } from '../notifications/email.service';
import { StorageService } from '../storage/storage.service';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Money as it reads in an invoice email. Invoices carry no currency column, so
 * every invoice email formats in USD — matching `PaymentReminderService`, so two
 * emails about one invoice never quote two different-looking amounts.
 */
function formatInvoiceAmount(amount: unknown): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number(amount ?? 0),
  );
}

/** Reviewed text fields collapse to null when blank — '' is never stored. */
function trimmedOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? null : trimmed;
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);
  private readonly webAppUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly emailService: EmailService,
    private readonly notifications: NotificationService,
    private readonly branding: BrandingService,
    private readonly audit: AuditService,
    private readonly approvalAuth: ApprovalAuthorizationService,
    private readonly approvals: ApprovalsService,
    config: ConfigService,
  ) {
    this.webAppUrl = config.get<string>('WEB_APP_URL', 'http://localhost:5179');
  }

  /**
   * Record an invoice state transition on the audit trail (FOR-294), with the
   * reviewer's reason when one was given. Best-effort: the transition is
   * already committed, so an audit failure must never throw back into the
   * request.
   */
  private async auditTransition(
    action: AuditAction,
    invoiceId: string,
    user: AuthenticatedUser,
    from: PrismaInvoiceStatus,
    to: PrismaInvoiceStatus,
    reason?: string | null,
  ): Promise<void> {
    try {
      await this.audit.log({
        action,
        performedById: user.id,
        targetType: 'Invoice',
        targetId: invoiceId,
        metadata: { from, to, ...(reason ? { reason } : {}) },
      });
    } catch (err) {
      this.logger.debug(
        `Failed to audit invoice transition ${from}→${to}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // ── List Invoices ──────────────────────────────────────────────────────────

  async listInvoices(query: InvoiceListQueryDto, user: AuthenticatedUser) {
    const sortBy = query.sortBy ?? 'dueDate';
    const sortDir = query.sortDir ?? 'desc';

    const where: Prisma.InvoiceWhereInput = {};

    // Role-based scoping
    if (user.role === UserRole.VENDOR) {
      if (user.companyId) where.vendorId = user.companyId;
    } else if (user.role !== UserRole.SUPER_ADMIN) {
      if (user.companyId) where.companyId = user.companyId;
    }

    // Status filter
    if (query.status) {
      where.status = query.status as PrismaInvoiceStatus;
    }

    // Project filter
    if (query.projectId) {
      where.projectId = query.projectId;
    }

    // Vendor filter
    if (query.vendorId) {
      where.vendorId = query.vendorId;
    }

    // Due date range filter
    if (query.dueDateFrom || query.dueDateTo) {
      where.dueDate = {};
      if (query.dueDateFrom) {
        where.dueDate.gte = new Date(query.dueDateFrom);
      }
      if (query.dueDateTo) {
        where.dueDate.lte = new Date(query.dueDateTo);
      }
    }

    // Amount range filter
    if (query.amountMin !== undefined || query.amountMax !== undefined) {
      where.totalAmount = {};
      if (query.amountMin !== undefined) {
        where.totalAmount.gte = query.amountMin;
      }
      if (query.amountMax !== undefined) {
        where.totalAmount.lte = query.amountMax;
      }
    }

    // Search
    if (query.search) {
      where.OR = [
        { id: { contains: query.search, mode: 'insensitive' } },
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { project: { name: { contains: query.search, mode: 'insensitive' } } },
        { vendor: { legalName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    // Sorting
    const orderBy: Prisma.InvoiceOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'id':
        orderBy.id = sortDir;
        break;
      case 'projectName':
        orderBy.project = { name: sortDir };
        break;
      case 'vendorName':
        orderBy.vendor = { legalName: sortDir };
        break;
      case 'status':
        orderBy.status = sortDir;
        break;
      case 'totalAmount':
        orderBy.totalAmount = sortDir;
        break;
      default:
        orderBy.dueDate = sortDir;
    }

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy,
        include: {
          project: { select: { name: true, code: true } },
          vendor: { select: { legalName: true } },
          relatedPo: { select: { id: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      // project/vendor/totalAmount are null on intake-created invoices that
      // haven't been reviewed yet (FOR-290).
      items: items.map((inv) => ({
        id: inv.id,
        projectName: inv.project?.name ?? null,
        projectId: inv.projectId,
        projectCode: inv.project?.code ?? null,
        vendorName: inv.vendor?.legalName ?? null,
        status: inv.status,
        source: inv.source,
        relatedPo: inv.relatedPo?.id ?? null,
        totalAmount: inv.totalAmount === null ? null : Number(inv.totalAmount),
        dueDate: inv.dueDate?.toISOString() ?? null,
        invoiceNumber: inv.invoiceNumber,
      })),
      meta: buildPaginationMeta(query.page ?? 1, query.take, total),
    };
  }

  // ── Get single Invoice ─────────────────────────────────────────────────────

  async getInvoice(id: string, _user: AuthenticatedUser) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        project: { select: { name: true } },
        vendor: { select: { legalName: true } },
        relatedPo: { select: { id: true, poNumber: true } },
        lines: { orderBy: { position: 'asc' } },
        documents: {
          include: {
            file: {
              include: { uploadedBy: { select: { id: true, name: true, email: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!inv) throw new NotFoundException(ERR.invoices.notFound);

    // The latest extraction for this invoice (FOR-291) — the review UI's
    // prefill source and processing/failure indicator.
    const extraction = await this.prisma.docExtraction.findFirst({
      where: { invoiceId: id, type: DocExtractionType.INVOICE },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        errorCode: true,
        editedResult: true,
        completedAt: true,
      },
    });

    return {
      id: inv.id,
      projectName: inv.project?.name ?? null,
      projectId: inv.projectId,
      vendorName: inv.vendor?.legalName ?? null,
      status: inv.status,
      source: inv.source,
      senderEmail: inv.senderEmail,
      relatedPo: inv.relatedPo?.id ?? null,
      relatedPoNumber: inv.relatedPo?.poNumber ?? null,
      totalAmount: inv.totalAmount === null ? null : Number(inv.totalAmount),
      dueDate: inv.dueDate?.toISOString() ?? null,
      invoiceNumber: inv.invoiceNumber,
      issuedDate: inv.issuedDate?.toISOString() ?? null,
      reviewedAt: inv.reviewedAt?.toISOString() ?? null,
      lines: inv.lines.map((line) => ({
        id: line.id,
        lineId: line.lineId,
        description: line.description,
        quantity: line.quantity === null ? null : Number(line.quantity),
        unit: line.unit,
        unitPrice: line.unitPrice === null ? null : Number(line.unitPrice),
        lineTotal: line.lineTotal === null ? null : Number(line.lineTotal),
        costCode: line.costCode,
        glAccount: line.glAccount,
      })),
      extraction: extraction
        ? {
            id: extraction.id,
            status: extraction.status,
            errorCode: extraction.errorCode,
            completedAt: extraction.completedAt?.toISOString() ?? null,
            result:
              extraction.status === DocExtractionStatus.COMPLETED ||
              extraction.status === DocExtractionStatus.CONFIRMED
                ? (extraction.editedResult as unknown as InvoiceExtractionResult | null)
                : null,
          }
        : null,
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
      documents: inv.documents.map((doc) => ({
        id: doc.id,
        name: doc.file.filename,
        fileId: doc.fileId,
        // Email-intake documents have no uploading user (FOR-290).
        uploadedBy: doc.file.uploadedBy
          ? {
              name: doc.file.uploadedBy.name,
              email: doc.file.uploadedBy.email,
              avatarUrl: null,
            }
          : null,
        uploadedAt: doc.createdAt.toISOString(),
      })),
    };
  }

  // ── Review Invoice (FOR-291) ───────────────────────────────────────────────

  /**
   * Persist the reviewer's confirmed/corrected fields onto the invoice.
   * Replace semantics: every save writes the full set of reviewed fields and
   * swaps the line items wholesale, so the record always reflects the
   * reviewer's latest statement of what the document says. Only Pending
   * invoices are reviewable — approval freezes the record.
   */
  async reviewInvoice(id: string, dto: ReviewInvoiceDto, user: AuthenticatedUser) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true },
    });

    if (!inv) throw new NotFoundException(ERR.invoices.notFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== inv.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (inv.status !== PrismaInvoiceStatus.PENDING) {
      throw new BadRequestException(ERR.invoices.cannotReview(inv.status));
    }

    if (dto.vendorId) {
      const vendor = await this.prisma.company.findFirst({
        where: { id: dto.vendorId, type: CompanyType.VENDOR },
        select: { id: true },
      });
      if (!vendor) throw new BadRequestException(ERR.invoices.reviewVendorNotFound);
    }

    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, companyId: inv.companyId },
        select: { id: true },
      });
      if (!project) throw new BadRequestException(ERR.invoices.reviewProjectNotFound);
    }

    // The PO the invoice bills against (FOR-293) — must be one of the buying
    // company's own POs.
    if (dto.relatedPoId) {
      const po = await this.prisma.purchaseOrder.findFirst({
        where: { id: dto.relatedPoId, companyId: inv.companyId },
        select: { id: true },
      });
      if (!po) throw new BadRequestException(ERR.invoices.reviewPoNotFound);
    }

    // FOR-307: an invoice *arrives* from a vendor rather than being raised by a
    // spender, so there is no "creator hits their threshold" moment. Review
    // completion is the structural analogue of the PO's submit: the reviewer
    // stands in for the creator, and their `invoice.approve` cap is what decides
    // whether the invoice can be approved in-house or must go to the Pool.
    //
    // Recomputed on every review, so a corrected total re-routes rather than
    // keeping a stale status — the review's replace-semantics apply here too.
    const routing = await this.resolveInvoiceApprovalRouting(user, dto.totalAmount ?? null);
    const nomineeIds = dto.nomineeIds ?? [];
    let pool: ApproverPoolMember[] = [];
    if (routing === ApprovalStatus.PENDING) {
      pool = await this.approvalAuth.resolveApproverPool(
        inv.companyId,
        'invoice.approve',
        dto.totalAmount ?? null,
      );
      // Vet nominees before the write, so a bad id is a 400 on the unchanged
      // invoice rather than a half-applied review (FOR-309).
      if (nomineeIds.length > 0) {
        await this.approvals.assertNomineesInPool(inv.companyId, pool, nomineeIds);
      }
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.invoice.update({
        where: { id },
        data: {
          vendorId: dto.vendorId ?? null,
          projectId: dto.projectId ?? null,
          relatedPoId: dto.relatedPoId ?? null,
          invoiceNumber: trimmedOrNull(dto.invoiceNumber),
          issuedDate: dto.issuedDate ? new Date(dto.issuedDate) : null,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          totalAmount: dto.totalAmount ?? null,
          approvalStatus: routing,
          // A re-review re-opens the question, so any previous decision's actor
          // is cleared with it — keeping it would credit an approval that no
          // longer applies to these numbers.
          approvedById: null,
          reviewedByUserId: user.id,
          reviewedAt: now,
          // Review moves dueDate, so the reminder ledger (US 8.09) must reset —
          // the new date is what should be reminded on. Reviews only happen
          // while Pending (reminders sweep Approved), so nothing has fired yet.
          dueReminderSentAt: null,
          overdueReminderSentAt: null,
        },
        select: { id: true },
      }),
      this.prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } }),
      this.prisma.invoiceLineItem.createMany({
        data: dto.lines.map((line, position) => ({
          invoiceId: id,
          position,
          lineId: trimmedOrNull(line.lineId),
          description: line.description.trim(),
          quantity: line.quantity ?? null,
          unit: trimmedOrNull(line.unit),
          unitPrice: line.unitPrice ?? null,
          lineTotal: line.lineTotal ?? null,
          costCode: trimmedOrNull(line.costCode),
          glAccount: trimmedOrNull(line.glAccount),
        })),
      }),
      // A human has signed off on the extracted values — the completed
      // extraction job graduates to Confirmed.
      this.prisma.docExtraction.updateMany({
        where: {
          invoiceId: id,
          type: DocExtractionType.INVOICE,
          status: DocExtractionStatus.COMPLETED,
        },
        data: {
          status: DocExtractionStatus.CONFIRMED,
          confirmedByUserId: user.id,
          confirmedAt: now,
        },
      }),
    ]);

    if (routing === ApprovalStatus.PENDING) {
      // Nominations are part of the record, so they are awaited; the fan-out is
      // best-effort like every other notification path.
      if (nomineeIds.length > 0) {
        await this.approvals.recordNominationsAtSubmit(
          ApprovalEntityType.INVOICE,
          id,
          inv.companyId,
          pool,
          nomineeIds,
          user.id,
        );
      }
      this.notifyApproversOfPendingInvoice(id, inv.companyId, pool, user.id).catch(() => {});
    }

    return this.getInvoice(id, user);
  }

  /**
   * Whether a reviewed invoice needs a higher-tier approver (FOR-307).
   *
   * Measured against the **reviewer's** effective `invoice.approve` cap, using
   * the same custom-role-first resolution the approve path enforces — so the
   * routing decision and the later 403 can never disagree.
   *
   * `NOT_REQUIRED` does not mean "anyone may approve this": `approveInvoice`
   * still evaluates the approver's own cap live (FOR-303). It means only that
   * the reviewer could have approved it themselves, so nobody needed telling.
   */
  private async resolveInvoiceApprovalRouting(
    user: AuthenticatedUser,
    totalAmount: number | null,
  ): Promise<ApprovalStatus> {
    // SUPER_ADMIN is unlimited as break-glass, matching the PO issue path.
    if (user.role === UserRole.SUPER_ADMIN) return ApprovalStatus.NOT_REQUIRED;

    const decision = await this.approvalAuth.evaluate(user, 'invoice.approve', totalAmount);
    return decision.outcome === 'allowed' ? ApprovalStatus.NOT_REQUIRED : ApprovalStatus.PENDING;
  }

  /**
   * Tell the Approver Pool that a reviewed invoice is over the reviewer's cap.
   *
   * Mirrors `PoStatusService.notifyApproversOfPendingPo` deliberately, including
   * the FOR-302 empty-Pool fallback: an invoice routed to nobody would sit
   * silently forever, so Company Admins are told it cannot be approved as it
   * stands. They are recipients, never granted authority — their own cap is
   * untouched, and the way out is raising a limit or correcting the amount.
   */
  private async notifyApproversOfPendingInvoice(
    invoiceId: string,
    companyId: string,
    pool: ApproverPoolMember[],
    reviewedByUserId: string,
  ): Promise<void> {
    const inv = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, totalAmount: true },
    });
    if (!inv) return;

    const reference = invoiceReference(inv.id);
    const amountLabel = formatInvoiceAmount(inv.totalAmount);
    const viewUrl = `${this.webAppUrl}/invoices/${invoiceId}`;
    const log = { companyId, invoiceId };
    const brand = await this.branding.getEmailBrand(companyId);

    if (pool.length === 0) {
      const admins = await this.approvalAuth.findCompanyAdminRecipients(companyId);
      const adminEmails = [...new Set(admins.map((a) => a.email))];
      const title = 'Invoice has no eligible approver';
      const body =
        `Invoice ${reference} (${amountLabel}) is awaiting approval, but no one in ` +
        `your company has an approval limit that covers this amount. Raise an approval ` +
        `limit or correct the amount to move it forward.`;

      await Promise.all(
        adminEmails.map((email) =>
          this.emailService.sendInvoiceApprovalUnroutableEmail(
            email,
            reference,
            amountLabel,
            viewUrl,
            log,
            brand,
          ),
        ),
      );
      await this.notifications.createForEmails(adminEmails, {
        type: NotificationType.INVOICE_APPROVAL_UNROUTABLE,
        title,
        body,
        entityType: NotificationEntityType.INVOICE,
        entityId: invoiceId,
      });

      // The reviewer hears about it too, so completing a review is never a
      // silent dead end. Skipped when they were already reached as an admin.
      if (!admins.some((a) => a.id === reviewedByUserId)) {
        await this.notifications.createForUsers({
          userIds: [reviewedByUserId],
          type: NotificationType.INVOICE_APPROVAL_UNROUTABLE,
          title,
          body,
          entityType: NotificationEntityType.INVOICE,
          entityId: invoiceId,
        });
      }
      return;
    }

    // Nominating narrows the fan-out; nominating nobody notifies the whole Pool.
    const targets = await this.approvals.resolveNotificationTargets(
      ApprovalEntityType.INVOICE,
      invoiceId,
      pool,
    );
    const recipients = [...new Set(targets.map((m) => m.email))];

    await Promise.all(
      recipients.map((email) =>
        this.emailService.sendInvoicePendingApprovalEmail(
          email,
          reference,
          amountLabel,
          viewUrl,
          log,
          brand,
        ),
      ),
    );

    await this.notifications.createForEmails(recipients, {
      type: NotificationType.INVOICE_PENDING_APPROVAL,
      title: 'Invoice awaiting approval',
      body: `Invoice ${reference} (${amountLabel}) needs your approval.`,
      entityType: NotificationEntityType.INVOICE,
      entityId: invoiceId,
    });
  }

  // ── Nomination (FOR-309) ──────────────────────────────────────────────────

  /**
   * Nominate further Approver Pool members on an invoice already awaiting
   * approval, and notify exactly the people newly added. The invoice twin of
   * `PoStatusService.nominateApprovers`: the rules live in the shared
   * `ApprovalsService`, the email lives here with the invoice's templates.
   */
  async nominateApprovers(id: string, userIds: string[], user: AuthenticatedUser) {
    const { view, notify } = await this.approvals.addNominations(
      ApprovalEntityType.INVOICE,
      id,
      userIds,
      user,
    );

    if (notify.length > 0) {
      this.notifyNominatedInvoiceApprovers(id, notify).catch(() => {});
    }

    return view;
  }

  /**
   * Tell newly nominated Pool members that an invoice is waiting on them.
   * Deliberately the same INVOICE_PENDING_APPROVAL signal the review-time
   * fan-out sends — from the nominee's side nothing is different, and a
   * "you were nominated" type would imply the nomination granted them something.
   */
  private async notifyNominatedInvoiceApprovers(
    invoiceId: string,
    nominees: ApproverPoolMember[],
  ): Promise<void> {
    const inv = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, companyId: true, totalAmount: true },
    });
    if (!inv) return;

    const reference = invoiceReference(inv.id);
    const amountLabel = formatInvoiceAmount(inv.totalAmount);
    const viewUrl = `${this.webAppUrl}/invoices/${invoiceId}`;
    const log = { companyId: inv.companyId, invoiceId };
    const brand = await this.branding.getEmailBrand(inv.companyId);
    const recipients = [...new Set(nominees.map((n) => n.email))];

    await Promise.all(
      recipients.map((email) =>
        this.emailService.sendInvoicePendingApprovalEmail(
          email,
          reference,
          amountLabel,
          viewUrl,
          log,
          brand,
        ),
      ),
    );

    await this.notifications.createForEmails(recipients, {
      type: NotificationType.INVOICE_PENDING_APPROVAL,
      title: 'Invoice awaiting approval',
      body: `Invoice ${reference} (${amountLabel}) needs your approval.`,
      entityType: NotificationEntityType.INVOICE,
      entityId: invoiceId,
    });
  }

  // ── Approve Invoice ────────────────────────────────────────────────────────

  /**
   * Reject the approval unless `user`'s effective `invoice.approve` grant covers
   * `totalAmount` (FOR-303). Custom-role-first resolution and the null-cap
   * (unlimited) rule both come from `ApprovalAuthorizationService.evaluate` —
   * this must never reimplement them.
   *
   * SUPER_ADMIN is exempt, matching `PoStatusService.approvePurchaseOrder`: the
   * role exists to break the glass on otherwise-locked workflows.
   */
  private async assertMayApproveAmount(
    user: AuthenticatedUser,
    totalAmount: Prisma.Decimal | number,
  ): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) return;

    const decision = await this.approvalAuth.evaluate(user, 'invoice.approve', totalAmount);
    if (decision.outcome === 'belowThreshold') {
      throw new ForbiddenException(
        ERR.invoices.approvalThresholdExceeded(
          totalAmount.toString(),
          decision.threshold.toString(),
        ),
      );
    }
    if (decision.outcome === 'notGranted') {
      throw new ForbiddenException(ERR.general.accessDenied);
    }
  }

  async approveInvoice(id: string, dto: ApproveInvoiceDto, user: AuthenticatedUser) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        companyId: true,
        projectId: true,
        vendorId: true,
        totalAmount: true,
      },
    });

    if (!inv) throw new NotFoundException(ERR.invoices.notFound);

    // Check company access
    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== inv.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (inv.status !== PrismaInvoiceStatus.PENDING) {
      throw new BadRequestException(ERR.invoices.cannotApprove(inv.status));
    }

    // Intake-created invoices (FOR-290) stay unapprovable until review
    // (FOR-291) has filled in who it's from, what it's for, and how much.
    // Runs BEFORE the threshold check — an unreviewed invoice has no total to
    // test, so "not reviewed" is the accurate error.
    if (inv.vendorId === null || inv.projectId === null || inv.totalAmount === null) {
      throw new BadRequestException(ERR.invoices.notReviewed);
    }

    // FOR-303: `invoice.approve` is threshold-aware and its cap is editable in
    // the Approval configuration tab, but nothing enforced it — any holder
    // could approve any amount. Mirrors the PO path's `evaluate` call.
    // SUPER_ADMIN bypasses the threshold as break-glass; the approving user is
    // still recorded for audit either way.
    await this.assertMayApproveAmount(user, inv.totalAmount);

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: PrismaInvoiceStatus.APPROVED,
        // FOR-307: the approval axis resolves alongside the document status, and
        // records WHO — ADR-0006's audit requirement wants a person, not just a
        // state. Set unconditionally: an invoice approved within the reviewer's
        // own cap was NOT_REQUIRED, and it is still true that this user approved
        // it.
        approvalStatus: ApprovalStatus.APPROVED,
        approvedById: user.id,
      },
      include: {
        project: { select: { name: true } },
        vendor: { select: { legalName: true } },
        relatedPo: { select: { id: true } },
      },
    });

    await this.auditTransition(
      AuditAction.INVOICE_APPROVED,
      id,
      user,
      inv.status,
      PrismaInvoiceStatus.APPROVED,
      trimmedOrNull(dto.reason),
    );

    return {
      id: updated.id,
      projectName: updated.project?.name ?? null,
      projectId: updated.projectId,
      vendorName: updated.vendor?.legalName ?? null,
      status: updated.status,
      relatedPo: updated.relatedPo?.id ?? null,
      totalAmount: updated.totalAmount === null ? null : Number(updated.totalAmount),
      dueDate: updated.dueDate?.toISOString() ?? null,
    };
  }

  // ── Reject Invoice ────────────────────────────────────────────────────────

  async rejectInvoice(id: string, dto: RejectInvoiceDto, user: AuthenticatedUser) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true },
    });

    if (!inv) throw new NotFoundException(ERR.invoices.notFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== inv.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    if (inv.status !== PrismaInvoiceStatus.PENDING && inv.status !== PrismaInvoiceStatus.DISPUTED) {
      throw new BadRequestException(ERR.invoices.cannotReject(inv.status));
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: PrismaInvoiceStatus.REJECTED,
        rejectionReason: dto.reason ?? null,
        // The approval question is settled by a rejection too (FOR-307).
        approvalStatus: ApprovalStatus.REJECTED,
        approvedById: user.id,
      },
      include: {
        project: { select: { name: true } },
        company: { select: { legalName: true } },
        vendor: { select: { legalName: true } },
        relatedPo: { select: { id: true } },
      },
    });

    await this.auditTransition(
      AuditAction.INVOICE_REJECTED,
      id,
      user,
      inv.status,
      PrismaInvoiceStatus.REJECTED,
      trimmedOrNull(dto.reason),
    );

    // Tell the vendor their invoice was rejected / a discrepancy was raised
    // (US 8.05 / 8.06). Fire-and-forget, like every other transactional
    // notification — the status change is already committed.
    void this.notifyVendorOfRejection(updated, user.id).catch(() => {});

    return {
      id: updated.id,
      projectName: updated.project?.name ?? null,
      projectId: updated.projectId,
      vendorName: updated.vendor?.legalName ?? null,
      status: updated.status,
      relatedPo: updated.relatedPo?.id ?? null,
      totalAmount: updated.totalAmount === null ? null : Number(updated.totalAmount),
      dueDate: updated.dueDate?.toISOString() ?? null,
    };
  }

  /**
   * Email the vendor that their invoice was rejected / a discrepancy was raised,
   * and mirror it into the in-app feed for any vendor rep with an account
   * (US 8.05 / 8.06). Supporting references stay behind the invoice link — the
   * matrix explicitly does not attach them.
   *
   * Best-effort: the rejection is already committed, so nothing here may throw
   * back into the request.
   */
  private async notifyVendorOfRejection(
    invoice: {
      id: string;
      companyId: string;
      vendorId: string | null;
      rejectionReason: string | null;
      project: { name: string } | null;
      company: { legalName: string };
    },
    rejectedByUserId: string,
  ): Promise<void> {
    // Intake invoices that review never linked to a vendor have no one to tell.
    if (!invoice.vendorId) return;

    const vendor = await this.prisma.company.findUnique({
      where: { id: invoice.vendorId },
      select: {
        contactEmail: true,
        users: {
          where: { role: UserRole.VENDOR, status: { not: 'INACTIVE' } },
          select: { email: true },
        },
      },
    });
    if (!vendor) return;

    const recipients = resolveVendorEmailRecipients(vendor.users, vendor.contactEmail);
    if (recipients.length === 0) return;

    const reference = invoiceReference(invoice.id);
    const viewUrl = `${this.webAppUrl}/invoices/${invoice.id}`;
    // Intake invoices may be rejected before review linked them to a project.
    const projectName = invoice.project?.name ?? null;
    // The rejecting (buyer) company's logo + name, shown atop the email (FOR-288).
    const brand = await this.branding.getEmailBrand(invoice.companyId);

    await Promise.all(
      recipients.map((email) =>
        this.emailService.sendInvoiceRejectedEmail(
          email,
          {
            invoiceReference: reference,
            companyName: invoice.company.legalName,
            projectName: projectName ?? '',
          },
          viewUrl,
          { comment: invoice.rejectionReason, brand },
        ),
      ),
    );

    await this.notifications.createForEmails(recipients, {
      type: NotificationType.INVOICE_REJECTED,
      title: 'Invoice rejected',
      body: projectName
        ? `${invoice.company.legalName} rejected invoice ${reference} for ${projectName}.`
        : `${invoice.company.legalName} rejected invoice ${reference}.`,
      entityType: NotificationEntityType.INVOICE,
      entityId: invoice.id,
      metadata: { rejectedByUserId },
    });
  }

  // ── Bulk Approve Invoices ──────────────────────────────────────────────────

  async bulkApproveInvoices(ids: string[], user: AuthenticatedUser) {
    if (ids.length === 0) {
      throw new BadRequestException(ERR.invoices.noIdsProvided);
    }

    const where: Prisma.InvoiceWhereInput = {
      id: { in: ids },
      status: PrismaInvoiceStatus.PENDING,
      // Unreviewed intake invoices (FOR-290) are skipped, mirroring the
      // single-approve guard; approvedCount reflects how many qualified.
      vendorId: { not: null },
      projectId: { not: null },
      totalAmount: { not: null },
    };

    // Scope by company
    if (user.role !== UserRole.SUPER_ADMIN && user.companyId) {
      where.companyId = user.companyId;
    }

    // Resolve the qualifying rows first so each approval lands on the audit
    // trail (FOR-294); the updateMany keeps the same guard so a row that
    // changed in between is not silently approved.
    const qualifying = await this.prisma.invoice.findMany({
      where,
      select: { id: true, totalAmount: true },
    });

    // FOR-303: the same `invoice.approve` cap the single-approve path enforces
    // applies here, per invoice. The caller's effective grant is resolved once
    // (custom-role-first, via `evaluate` with no amount, which returns the cap
    // without comparing) and each total is then compared locally — a per-row
    // `evaluate` would be one query per selected invoice.
    const cap = await this.resolveBulkApprovalCap(user);
    const withinCap = qualifying.filter((q) => cap === null || !q.totalAmount?.greaterThan(cap));
    const skippedOverLimitCount = qualifying.length - withinCap.length;

    const result = await this.prisma.invoice.updateMany({
      where: { ...where, id: { in: withinCap.map((q) => q.id) } },
      data: {
        status: PrismaInvoiceStatus.APPROVED,
        approvalStatus: ApprovalStatus.APPROVED,
        approvedById: user.id,
      },
    });

    await Promise.all(
      withinCap.map((q) =>
        this.auditTransition(
          AuditAction.INVOICE_APPROVED,
          q.id,
          user,
          PrismaInvoiceStatus.PENDING,
          PrismaInvoiceStatus.APPROVED,
        ),
      ),
    );

    return {
      approvedCount: result.count,
      requestedCount: ids.length,
      skippedOverLimitCount,
    };
  }

  /**
   * The caller's effective `invoice.approve` cap for a bulk run, or `null` for
   * unlimited (FOR-303). SUPER_ADMIN is unlimited as break-glass; a caller who
   * holds `invoice.bulkApprove` but not `invoice.approve` is refused outright
   * rather than silently approving nothing, matching the single-approve path.
   */
  private async resolveBulkApprovalCap(user: AuthenticatedUser): Promise<Prisma.Decimal | null> {
    if (user.role === UserRole.SUPER_ADMIN) return null;

    const decision = await this.approvalAuth.evaluate(user, 'invoice.approve', null);
    if (decision.outcome === 'notGranted') {
      throw new ForbiddenException(ERR.general.accessDenied);
    }
    return decision.threshold;
  }

  // ── Invoice audit trail (FOR-294) ─────────────────────────────────────────

  /**
   * Chronological state history for an invoice: who moved it, when, and why
   * (approve note / rejection reason travel in `metadata.reason`). Visibility
   * mirrors the list scoping — the owning (buyer) company, the billed vendor,
   * and SUPER_ADMIN.
   */
  async getAuditTrail(id: string, user: AuthenticatedUser) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true, companyId: true, vendorId: true },
    });

    if (!inv) throw new NotFoundException(ERR.invoices.notFound);

    const hasAccess =
      user.role === UserRole.SUPER_ADMIN ||
      user.companyId === inv.companyId ||
      (inv.vendorId !== null && user.companyId === inv.vendorId);
    if (!hasAccess) throw new ForbiddenException(ERR.general.accessDenied);

    const logs = await this.prisma.auditLog.findMany({
      where: { targetType: 'Invoice', targetId: id },
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

  // ── Upload Invoice Document ─────────────────────────────────────────────────

  async uploadDocument(invoiceId: string, file: Express.Multer.File, user: AuthenticatedUser) {
    if (!file) throw new BadRequestException(ERR.storage.noFileProvided);
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException(ERR.storage.fileTooLarge('10MB'));

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, companyId: true },
    });
    if (!invoice) throw new NotFoundException(ERR.invoices.notFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== invoice.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    const ext = path.extname(file.originalname);
    const key = `invoice-documents/${invoiceId}/${randomUUID()}${ext}`;

    const result = await this.storageService.upload(key, file.buffer, file.mimetype);

    const fileRecord = await this.prisma.file.create({
      data: {
        bucket: result.bucket,
        key: result.key,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedById: user.id,
      },
    });

    const doc = await this.prisma.invoiceDocument.create({
      data: { invoiceId, fileId: fileRecord.id },
      include: {
        file: { include: { uploadedBy: { select: { id: true, name: true, email: true } } } },
      },
    });

    return {
      id: doc.id,
      name: doc.file.filename,
      fileId: doc.fileId,
      // Always present on this path (the file was just created with an
      // uploader); typed nullable since FOR-290 email-intake files.
      uploadedBy: doc.file.uploadedBy
        ? {
            name: doc.file.uploadedBy.name,
            email: doc.file.uploadedBy.email,
            avatarUrl: null,
          }
        : null,
      uploadedAt: doc.createdAt.toISOString(),
    };
  }

  // ── Delete Invoice Document ─────────────────────────────────────────────────

  async deleteDocument(invoiceId: string, docId: string, user: AuthenticatedUser) {
    const doc = await this.prisma.invoiceDocument.findFirst({
      where: { id: docId, invoiceId },
      include: { file: true, invoice: { select: { companyId: true } } },
    });

    if (!doc) throw new NotFoundException(ERR.invoices.documentNotFound);

    if (user.role !== UserRole.SUPER_ADMIN && user.companyId !== doc.invoice.companyId) {
      throw new ForbiddenException(ERR.general.accessDenied);
    }

    await this.storageService.delete(doc.file.key);
    await this.prisma.invoiceDocument.delete({ where: { id: docId } });
    await this.prisma.file.delete({ where: { id: doc.fileId } });

    return { success: true };
  }
}
