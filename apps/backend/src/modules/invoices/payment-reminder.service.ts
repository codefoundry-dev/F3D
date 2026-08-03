import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  NotificationEntityType,
  NotificationType,
  InvoiceStatus as PrismaInvoiceStatus,
} from '@prisma/client';

import { invoiceReference } from '../../common/utils/invoice-reference.util';
import { PrismaService } from '../../prisma/prisma.service';
import { BrandingService } from '../export/branding.service';
import { NotificationService } from '../notification-feed/notification.service';
import { EmailService } from '../notifications/email.service';

/** How many days before the due date the "payment due" reminder goes out. */
const DEFAULT_LEAD_DAYS = 3;

/**
 * The invoice fields a reminder needs, plus the names it quotes. `vendor` is
 * nullable in the schema since FOR-290; the sweeps filter vendor-less invoices
 * out, so the fallback name never actually renders.
 */
type RemindableInvoice = {
  id: string;
  companyId: string;
  dueDate: Date | null;
  totalAmount: unknown;
  vendor: { legalName: string } | null;
};

/**
 * Daily sweep that reminds the contractor's payment approvers about approved
 * invoices approaching (and then past) their due date — the Payment Due and
 * Payment Overdue rows of the notification matrix (US 8.09).
 *
 * Recipients are the ACTIVE users of the invoice's own company whose role holds
 * `invoice.approve`. There is no separate "payment alert recipients" setting;
 * the people who can approve an invoice are the people who need to know it is
 * coming due.
 *
 * Each reminder is claimed before it is sent (the ledger column is stamped in a
 * conditional `updateMany`), so a re-run — or a second container — cannot
 * double-send. The trade is that a transport failure loses that one reminder
 * rather than risking a duplicate, which matches how every other email in this
 * codebase is treated.
 */
@Injectable()
export class PaymentReminderService {
  private readonly logger = new Logger(PaymentReminderService.name);
  private readonly webAppUrl: string;
  private readonly leadDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notifications: NotificationService,
    private readonly branding: BrandingService,
    config: ConfigService,
  ) {
    this.webAppUrl = config.get<string>('WEB_APP_URL', 'http://localhost:5179');
    const configured = Number(config.get<string>('PAYMENT_DUE_REMINDER_LEAD_DAYS'));
    this.leadDays = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_LEAD_DAYS;
  }

  /**
   * Runs once a day. Early morning so a reminder lands before the working day
   * rather than in the middle of it.
   */
  @Cron(CronExpression.EVERY_DAY_AT_7AM, { name: 'payment-reminders' })
  async runDailySweep(): Promise<void> {
    try {
      const dueCount = await this.sendDueReminders();
      const overdueCount = await this.sendOverdueReminders();
      if (dueCount > 0 || overdueCount > 0) {
        this.logger.log(`Payment reminders sent: ${dueCount} due, ${overdueCount} overdue`);
      }
    } catch (error) {
      // A scheduled job that throws takes no one with it, but it must not go
      // unnoticed either.
      this.logger.error(`Payment reminder sweep failed: ${String(error)}`);
    }
  }

  /** Approved invoices falling due within the lead window, not yet reminded. */
  async sendDueReminders(): Promise<number> {
    const startOfToday = this.startOfToday();
    const cutoff = new Date(startOfToday);
    cutoff.setDate(cutoff.getDate() + this.leadDays);
    cutoff.setHours(23, 59, 59, 999);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: PrismaInvoiceStatus.APPROVED,
        dueReminderSentAt: null,
        dueDate: { gte: startOfToday, lte: cutoff },
        // Approval requires a vendor since FOR-290, but pre-existing rows may
        // predate that guard — a vendor-less reminder has no one to name.
        vendorId: { not: null },
      },
      select: {
        id: true,
        companyId: true,
        dueDate: true,
        totalAmount: true,
        vendor: { select: { legalName: true } },
      },
    });

    let sent = 0;
    for (const invoice of invoices) {
      if (!(await this.claim(invoice.id, 'due'))) continue;
      await this.notifyDue(invoice);
      sent += 1;
    }
    return sent;
  }

  /** Approved invoices past their due date, not yet reminded. */
  async sendOverdueReminders(): Promise<number> {
    const startOfToday = this.startOfToday();

    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: PrismaInvoiceStatus.APPROVED,
        overdueReminderSentAt: null,
        dueDate: { lt: startOfToday },
        vendorId: { not: null },
      },
      select: {
        id: true,
        companyId: true,
        dueDate: true,
        totalAmount: true,
        vendor: { select: { legalName: true } },
      },
    });

    let sent = 0;
    for (const invoice of invoices) {
      if (!(await this.claim(invoice.id, 'overdue'))) continue;
      await this.notifyOverdue(invoice);
      sent += 1;
    }
    return sent;
  }

  /**
   * Stamp the reminder ledger, but only if it is still unstamped. Returns false
   * when another run got there first, in which case the caller must not send.
   */
  private async claim(invoiceId: string, kind: 'due' | 'overdue'): Promise<boolean> {
    const column = kind === 'due' ? 'dueReminderSentAt' : 'overdueReminderSentAt';
    const result = await this.prisma.invoice.updateMany({
      where: { id: invoiceId, [column]: null },
      data: { [column]: new Date() },
    });
    return result.count > 0;
  }

  private async notifyDue(invoice: RemindableInvoice): Promise<void> {
    const context = await this.buildContext(invoice);
    if (!context) return;

    const daysUntilDue = this.daysBetween(this.startOfToday(), invoice.dueDate as Date);

    await Promise.all(
      context.recipients.map((email) =>
        this.emailService.sendPaymentDueReminderEmail(
          email,
          { ...context.params, daysUntilDue },
          context.viewUrl,
          context.brand,
        ),
      ),
    );

    await this.notifications.createForEmails(context.recipients, {
      type: NotificationType.PAYMENT_DUE,
      title: 'Payment due soon',
      body: `Invoice ${context.params.invoiceReference} from ${context.params.vendorName} is due on ${context.params.dueDate}.`,
      entityType: NotificationEntityType.INVOICE,
      entityId: invoice.id,
    });
  }

  private async notifyOverdue(invoice: RemindableInvoice): Promise<void> {
    const context = await this.buildContext(invoice);
    if (!context) return;

    await Promise.all(
      context.recipients.map((email) =>
        this.emailService.sendPaymentOverdueReminderEmail(
          email,
          context.params,
          context.viewUrl,
          context.brand,
        ),
      ),
    );

    await this.notifications.createForEmails(context.recipients, {
      type: NotificationType.PAYMENT_OVERDUE,
      title: 'Payment overdue',
      body: `Invoice ${context.params.invoiceReference} from ${context.params.vendorName} was due on ${context.params.dueDate}.`,
      entityType: NotificationEntityType.INVOICE,
      entityId: invoice.id,
    });
  }

  /** Recipients, branding and copy parameters shared by both reminder kinds. */
  private async buildContext(invoice: RemindableInvoice) {
    if (!invoice.dueDate) return null;

    const recipients = await this.findPaymentApproverEmails(invoice.companyId);
    if (recipients.length === 0) return null;

    return {
      recipients,
      viewUrl: `${this.webAppUrl}/invoices/${invoice.id}`,
      brand: await this.branding.getEmailBrand(invoice.companyId),
      params: {
        invoiceReference: invoiceReference(invoice.id),
        vendorName: invoice.vendor?.legalName ?? 'the vendor',
        amount: this.formatAmount(invoice.totalAmount),
        dueDate: this.formatDate(invoice.dueDate),
      },
    };
  }

  /**
   * The contractor's payment-alert audience: ACTIVE users of the company whose
   * role grants `invoice.approve`. Unlike the PO approver lookup this ignores
   * role thresholds — a reminder is information, not an approval ask, so
   * everyone who could approve the invoice should see it regardless of amount.
   */
  private async findPaymentApproverEmails(companyId: string): Promise<string[]> {
    const grants = await this.prisma.rolePermission.findMany({
      where: { permission: { key: 'invoice.approve' } },
      select: { role: true },
    });
    const roles = [...new Set(grants.map((g) => g.role))];
    if (roles.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { companyId, status: 'ACTIVE', role: { in: roles } },
      select: { email: true },
    });
    return [...new Set(users.map((u) => u.email))];
  }

  /** Local midnight today — the boundary between "due soon" and "overdue". */
  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Whole days from `from` to `to`, rounded up so "later today" reads as 0. */
  private daysBetween(from: Date, to: Date): number {
    const ms = to.getTime() - from.getTime();
    return Math.max(0, Math.floor(ms / 86_400_000));
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private formatAmount(amount: unknown): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(amount));
  }
}
