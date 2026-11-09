import * as fs from 'fs';
import * as path from 'path';

import emailTranslations from '@forethread/i18n/locales/en/emails.json';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import { EmailLogService } from '../email-log/email-log.service';
import type { EmailLogContext } from '../email-log/email-log.types';

import { EMAIL_TEMPLATES } from './email-templates.const';
import type { EmailTemplateName } from './email-templates.const';
import { ResendService } from './resend.service';
import { withSenderDisplayName } from './sender-address';

/** An attachment ready to hand to whichever transport is active. */
export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

/**
 * Issuing-company branding for a transactional email (FOR-267). When provided the
 * layout names the company above the message body (with its logo, if it has one)
 * and the `From` display name becomes "{name} via Forethread" (FOR-383).
 */
export interface EmailBrand {
  /** Company display name — shown in the header, the logo alt text and the sender. */
  name: string;
  /** URL to the company logo image; absent when the company has no logo. */
  logoUrl?: string;
}

/** Context for the vendor RFQ invitation copy. Every field is best-effort. */
export interface RfqInvitationDetails {
  /** The vendor rep being emailed; absent for a company contact email. */
  recipientName?: string | null;
  /** The contractor user who sent the RFQ. */
  senderName?: string | null;
  /** Overrides the brand name as the contractor company in the copy. */
  contractorCompanyName?: string | null;
  supplierCompanyName?: string | null;
  projectName?: string | null;
  /** Response deadline (`Rfq.deadlineEnd`) — a calendar date. */
  deadline?: Date | null;
}

/** Context for the material-request pending-approval copy. */
export interface MaterialRequestEmailDetails {
  recipientName?: string | null;
  requesterName?: string | null;
  requiredBy?: Date | null;
  priority?: string | null;
}

/** Placeholder for a detail the record does not carry. */
const NOT_SPECIFIED = '—';

/** The trimmed string, or `undefined` when it is missing or blank. */
function nonBlank(value?: string | null): string | undefined {
  return value?.trim() || undefined; // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing -- '' must fall through
}

/** First word of a display name (`User.name` is a single field); `undefined` when blank. */
function firstNameOf(name?: string | null): string | undefined {
  return nonBlank(name)?.split(/\s+/)[0];
}

/**
 * Calendar dates (deadlines, need-by dates) are stored as UTC midnight, so they
 * are formatted in UTC — a local timezone would show the previous day.
 */
function formatEmailDate(date?: Date | null): string {
  if (!date) return NOT_SPECIFIED;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Remove a clause from translated copy; tolerant of a missing key. */
function dropClause(text: string | undefined, clause: string): string {
  return (text ?? '').replace(clause, '');
}

/** `URGENT` → `Urgent`. */
function formatPriority(priority?: string | null): string {
  if (!priority) return NOT_SPECIFIED;
  return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
}

/** A rendered message ready to hand to whichever transport is active. */
interface EmailMessage {
  to: string;
  cc?: string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  /** Template key — recorded in the email log (FOR-213). */
  template?: string;
  /** When set, a successful dispatch is recorded in the email log (FOR-213). */
  log?: EmailLogContext;
  /** Issuing company shown as the sender's display name (FOR-383). */
  fromName?: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly templates = new Map<string, Handlebars.TemplateDelegate>();
  private layoutTemplate!: Handlebars.TemplateDelegate;

  constructor(
    config: ConfigService,
    private readonly resend: ResendService,
    private readonly emailLog: EmailLogService,
  ) {
    this.from = config.get<string>('SMTP_FROM', 'noreply@forethread.local');

    const smtpUser = config.get<string>('SMTP_USER');
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST', 'localhost'),
      port: config.get<number>('SMTP_PORT', 1025),
      secure: false,
      ...(smtpUser
        ? {
            auth: {
              user: smtpUser,
              pass: config.get<string>('SMTP_PASS'),
            },
          }
        : {}),
    });
  }

  onModuleInit(): void {
    const templatesDir = path.join(__dirname, 'templates');
    const partialsDir = path.join(templatesDir, 'partials');

    if (fs.existsSync(partialsDir)) {
      for (const file of fs.readdirSync(partialsDir)) {
        const name = path.basename(file, '.html');
        const source = fs.readFileSync(path.join(partialsDir, file), 'utf-8');
        Handlebars.registerPartial(name, source);
      }
    }

    const layoutSource = fs.readFileSync(path.join(templatesDir, 'layout.html'), 'utf-8');
    this.layoutTemplate = Handlebars.compile(layoutSource);

    for (const templateName of Object.values(EMAIL_TEMPLATES)) {
      const filePath = path.join(templatesDir, `${templateName}.html`);
      const source = fs.readFileSync(filePath, 'utf-8');
      this.templates.set(templateName, Handlebars.compile(source));
    }
  }

  private interpolate(text: string, vars: Record<string, string | number>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
      key in vars ? String(vars[key]) : '',
    );
  }

  private getTranslations(
    section: keyof typeof emailTranslations,
    vars: Record<string, string | number> = {},
  ): Record<string, string> {
    const raw = emailTranslations[section] as Record<string, string>;
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      result[key] = this.interpolate(value, vars);
    }
    return result;
  }

  private renderEmail(
    templateName: EmailTemplateName,
    translations: Record<string, string>,
    params: Record<string, unknown> = {},
    brand?: EmailBrand,
  ): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Email template "${templateName}" not found`);
    }

    const footer = emailTranslations.footer;
    const content = template({ t: translations, ...params });
    return this.layoutTemplate({ content, footer, ...(brand ? { brand } : {}) });
  }

  /** Sender display-name fields for a branded email (FOR-383); none when unbranded. */
  private brandSender(brand?: EmailBrand): Pick<EmailMessage, 'fromName'> {
    return brand ? { fromName: brand.name } : {};
  }

  /**
   * Send a rendered message through the preferred transport.
   *
   * Resend is preferred whenever `RESEND_API_KEY` is configured; otherwise we
   * fall back to SMTP (Mailhog in local dev). Resend failures are logged but
   * never re-thrown — every caller treats email as fire-and-forget, matching
   * the SMTP path whose rejections are swallowed by the caller's try/catch.
   */
  private async dispatch(message: EmailMessage): Promise<void> {
    const hasCc = message.cc && message.cc.length > 0;

    if (this.resend.isConfigured()) {
      const result = await this.resend.send({
        to: message.to,
        ...(hasCc ? { cc: message.cc } : {}),
        subject: message.subject,
        ...(message.html ? { html: message.html } : {}),
        ...(message.text ? { text: message.text } : {}),
        ...(message.attachments ? { attachments: message.attachments } : {}),
        ...(message.fromName ? { fromName: message.fromName } : {}),
      });
      if (result.status === 'error') {
        // The send is gone (retries already exhausted in ResendService). Log it
        // loudly and persist a FAILED row so the dropped email is visible on the
        // RFQ/PO log instead of silently missing (FOR-213).
        const reason = `${result.code}: ${result.message}`;
        this.logger.error(
          `Resend send to ${message.to} failed: ${reason}${this.logSuffix(message)}`,
        );
        await this.recordFailure(message, 'RESEND', reason);
        return;
      }
      await this.recordOutbound(message, 'RESEND', result.id);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: withSenderDisplayName(this.from, message.fromName),
        to: message.to,
        ...(hasCc ? { cc: message.cc } : {}),
        subject: message.subject,
        ...(message.html ? { html: message.html } : {}),
        ...(message.text ? { text: message.text } : {}),
        ...(message.attachments ? { attachments: message.attachments } : {}),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`SMTP send to ${message.to} failed: ${reason}${this.logSuffix(message)}`);
      await this.recordFailure(message, 'SMTP', reason);
      return;
    }
    await this.recordOutbound(message, 'SMTP', null);
  }

  /** RFQ/PO linkage suffix for failure logs, so a dropped send is traceable. */
  private logSuffix(message: EmailMessage): string {
    if (!message.log) return '';
    const parts: string[] = [];
    if (message.log.rfqId) parts.push(`rfqId=${message.log.rfqId}`);
    if (message.log.purchaseOrderId) parts.push(`poId=${message.log.purchaseOrderId}`);
    return parts.length > 0 ? ` (${parts.join(', ')})` : '';
  }

  /**
   * Persist a successfully dispatched email to the delivery log (FOR-213) when
   * the caller supplied linkage context. Best-effort: a logging failure must
   * never affect the (already completed) send.
   */
  private async recordOutbound(
    message: EmailMessage,
    provider: 'RESEND' | 'SMTP',
    providerMessageId: string | null,
  ): Promise<void> {
    if (!message.log || !message.template) {
      return;
    }
    try {
      await this.emailLog.recordOutbound({
        ...message.log,
        template: message.template,
        toEmail: message.to,
        subject: message.subject,
        provider,
        providerMessageId,
      });
    } catch (err) {
      this.logger.debug(
        `Failed to record outbound email log: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Persist a terminal FAILED row for a send the transport rejected (FOR-213) so
   * the dropped email shows on the RFQ/PO log with its reason, rather than just
   * being absent. Only logged when the caller supplied linkage context, and
   * best-effort: a logging failure must never surface over the (failed) send.
   */
  private async recordFailure(
    message: EmailMessage,
    provider: 'RESEND' | 'SMTP',
    reason: string,
  ): Promise<void> {
    if (!message.log || !message.template) {
      return;
    }
    try {
      await this.emailLog.recordFailed({
        ...message.log,
        template: message.template,
        toEmail: message.to,
        subject: message.subject,
        provider,
        reason,
      });
    } catch (err) {
      this.logger.debug(
        `Failed to record failed email log: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async sendInvitationEmail(to: string, activationUrl: string, name: string): Promise<void> {
    const t = this.getTranslations('invitation', { name });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.INVITATION, t, { activationUrl }),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  /**
   * Confirm to an invited user that activation completed and they can now sign
   * in. Email only — the account exists but the user is not signed in yet, so
   * there is no in-app inbox to mirror it into.
   */
  async sendAccountActivatedEmail(to: string, name: string, loginUrl: string): Promise<void> {
    const t = this.getTranslations('accountActivated', { name });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.ACCOUNT_ACTIVATED, t, { loginUrl }),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendOtpEmail(to: string, otp: string, expiresAt: Date): Promise<void> {
    const expiresMinutes = Math.round((expiresAt.getTime() - Date.now()) / 60000);
    const t = this.getTranslations('otp', { expiresMinutes });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        text: this.interpolate(emailTranslations.otp.plainText, { otp, expiresMinutes }),
        html: this.renderEmail(EMAIL_TEMPLATES.OTP, t, { otp, expiresMinutes }),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendDeliveryCodeEmail(
    to: string,
    code: string,
    expiresAt: Date,
    poNumber: string,
    brand?: EmailBrand,
  ): Promise<void> {
    const expiresMinutes = Math.round((expiresAt.getTime() - Date.now()) / 60000);
    const t = this.getTranslations('deliveryCode', { expiresMinutes, poNumber });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        text: this.interpolate(emailTranslations.deliveryCode.plainText, {
          code,
          expiresMinutes,
          poNumber,
        }),
        html: this.renderEmail(EMAIL_TEMPLATES.DELIVERY_CODE, t, { code, expiresMinutes }, brand),
        ...this.brandSender(brand),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendPasswordResetEmail(to: string, resetUrl: string, name: string): Promise<void> {
    const t = this.getTranslations('passwordReset', { name });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.PASSWORD_RESET, t, { resetUrl }),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendDeactivationEmail(to: string, name: string): Promise<void> {
    const t = this.getTranslations('deactivation', { name });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.DEACTIVATION, t),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendReactivationEmail(to: string, name: string): Promise<void> {
    const t = this.getTranslations('reactivation', { name });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.REACTIVATION, t),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendVendorInvitationEmail(to: string, activationUrl: string, name: string): Promise<void> {
    const t = this.getTranslations('vendorInvitation', { name });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.VENDOR_INVITATION, t, { activationUrl }),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendVendorCompanyInvitationEmail(to: string): Promise<void> {
    const t = this.getTranslations('vendorCompanyInvitation');

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.VENDOR_COMPANY_INVITATION, t),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  /**
   * Invite a vendor rep to quote on an RFQ. The copy names who invited whom, for
   * which project, and by when (client format, Nov 2026). Every name is optional
   * at the call site — a vendor quick-added with only a contact email has no rep
   * name, so the greeting degrades to "Hi there,".
   */
  async sendRfqReceivedEmail(
    to: string,
    rfqNumber: string,
    replyUrl: string,
    options?: {
      cc?: string[];
      attachments?: EmailAttachment[];
      brand?: EmailBrand;
      log?: EmailLogContext;
      details?: RfqInvitationDetails;
    },
  ): Promise<void> {
    const d = options?.details;
    const senderFullName = nonBlank(d?.senderName);
    const contractorCompanyName =
      nonBlank(d?.contractorCompanyName) ?? nonBlank(options?.brand?.name);
    const projectName = nonBlank(d?.projectName);
    const t = this.getTranslations('rfqReceived', {
      rfqNumber,
      recipientFirstName: firstNameOf(d?.recipientName) ?? 'there',
      senderFirstName: firstNameOf(senderFullName) ?? 'A contractor',
      contractorCompanyName: contractorCompanyName ?? NOT_SPECIFIED,
      supplierCompanyName: nonBlank(d?.supplierCompanyName) ?? 'your company',
      projectName: projectName ?? NOT_SPECIFIED,
    });
    // Drop clauses that would otherwise render a bare "—" placeholder.
    if (!contractorCompanyName) t.body = dropClause(t.body, ` from ${NOT_SPECIFIED}`);
    if (!projectName) t.subject = dropClause(t.subject, ` – ${NOT_SPECIFIED}`);
    const details = [
      { label: t.projectLabel, value: projectName ?? NOT_SPECIFIED },
      { label: t.referenceLabel, value: rfqNumber },
      {
        label: t.requestedByLabel,
        value:
          nonBlank([senderFullName, contractorCompanyName].filter(Boolean).join(', ')) ??
          NOT_SPECIFIED,
      },
      { label: t.deadlineLabel, value: formatEmailDate(d?.deadline) },
    ];

    try {
      await this.dispatch({
        to,
        ...(options?.cc && options.cc.length > 0 ? { cc: options.cc } : {}),
        subject: t.subject,
        html: this.renderEmail(
          EMAIL_TEMPLATES.RFQ_RECEIVED,
          t,
          { replyUrl, details },
          options?.brand,
        ),
        ...this.brandSender(options?.brand),
        ...(options?.attachments && options.attachments.length > 0
          ? { attachments: options.attachments }
          : {}),
        template: EMAIL_TEMPLATES.RFQ_RECEIVED,
        ...(options?.log ? { log: options.log } : {}),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendPoIssuedEmail(
    to: string,
    poNumber: string,
    viewUrl: string,
    pdfBuffer?: Buffer,
    log?: EmailLogContext,
    brand?: EmailBrand,
  ): Promise<void> {
    const t = this.getTranslations('poIssued', { poNumber });

    try {
      const attachments = pdfBuffer ? [{ filename: `PO-${poNumber}.pdf`, content: pdfBuffer }] : [];

      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.PO_ISSUED, t, { viewUrl }, brand),
        ...this.brandSender(brand),
        attachments,
        template: EMAIL_TEMPLATES.PO_ISSUED,
        ...(log ? { log } : {}),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendPoPendingApprovalEmail(
    to: string,
    poNumber: string,
    amount: string,
    viewUrl: string,
    log?: EmailLogContext,
    brand?: EmailBrand,
  ): Promise<void> {
    const t = this.getTranslations('poPendingApproval', { poNumber, amount });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.PO_PENDING_APPROVAL, t, { viewUrl }, brand),
        ...this.brandSender(brand),
        template: EMAIL_TEMPLATES.PO_PENDING_APPROVAL,
        ...(log ? { log } : {}),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  /**
   * Tell a Company Admin that a PO is stuck: it is awaiting approval but no
   * active user's `po.approve` cap covers its total, so the Approver Pool is
   * empty (FOR-302). They are a fallback *recipient*, not an approver — the
   * copy asks them to raise a limit or reduce the order, never to approve past
   * their own cap.
   */
  async sendPoApprovalUnroutableEmail(
    to: string,
    poNumber: string,
    amount: string,
    viewUrl: string,
    log?: EmailLogContext,
    brand?: EmailBrand,
  ): Promise<void> {
    const t = this.getTranslations('poApprovalUnroutable', { poNumber, amount });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.PO_APPROVAL_UNROUTABLE, t, { viewUrl }, brand),
        ...this.brandSender(brand),
        template: EMAIL_TEMPLATES.PO_APPROVAL_UNROUTABLE,
        ...(log ? { log } : {}),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  /**
   * Tell an Approver Pool member that a reviewed invoice went over the
   * reviewer's `invoice.approve` cap and now needs their sign-off (FOR-307).
   * The invoice equivalent of {@link sendPoPendingApprovalEmail}.
   */
  async sendInvoicePendingApprovalEmail(
    to: string,
    invoiceReference: string,
    amount: string,
    viewUrl: string,
    log?: EmailLogContext,
    brand?: EmailBrand,
  ): Promise<void> {
    const t = this.getTranslations('invoicePendingApproval', { invoiceReference, amount });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.INVOICE_PENDING_APPROVAL, t, { viewUrl }, brand),
        ...this.brandSender(brand),
        template: EMAIL_TEMPLATES.INVOICE_PENDING_APPROVAL,
        ...(log ? { log } : {}),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  /**
   * Tell a Company Admin that a reviewed invoice is stuck: it needs approval but
   * no active user's `invoice.approve` cap covers its total, so the Approver
   * Pool is empty. Same fallback-recipient rule as the PO case (FOR-302) — the
   * copy asks for a limit raise or a corrected amount, never for an approval
   * past their own cap.
   */
  async sendInvoiceApprovalUnroutableEmail(
    to: string,
    invoiceReference: string,
    amount: string,
    viewUrl: string,
    log?: EmailLogContext,
    brand?: EmailBrand,
  ): Promise<void> {
    const t = this.getTranslations('invoiceApprovalUnroutable', { invoiceReference, amount });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.INVOICE_APPROVAL_UNROUTABLE, t, { viewUrl }, brand),
        ...this.brandSender(brand),
        template: EMAIL_TEMPLATES.INVOICE_APPROVAL_UNROUTABLE,
        ...(log ? { log } : {}),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  /**
   * Tell an Approver Pool member that a material request has been submitted and
   * needs their sign-off (FOR-347). The MR equivalent of
   * {@link sendPoPendingApprovalEmail} — no amount, an MR carries none; the
   * project name stands in as context.
   */
  async sendMaterialRequestPendingApprovalEmail(
    to: string,
    mrNumber: string,
    projectName: string,
    viewUrl: string,
    log?: EmailLogContext,
    brand?: EmailBrand,
    details?: MaterialRequestEmailDetails,
  ): Promise<void> {
    const requesterName = nonBlank(details?.requesterName);
    const t = this.getTranslations('materialRequestPendingApproval', {
      mrNumber,
      projectName,
      recipientFirstName: firstNameOf(details?.recipientName) ?? 'there',
      requesterFirstName: firstNameOf(requesterName) ?? 'A team member',
    });
    const rows = [
      { label: t.referenceLabel, value: mrNumber },
      { label: t.projectLabel, value: projectName },
      { label: t.requestedByLabel, value: requesterName ?? NOT_SPECIFIED },
      { label: t.requiredByLabel, value: formatEmailDate(details?.requiredBy) },
      { label: t.priorityLabel, value: formatPriority(details?.priority) },
    ];

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(
          EMAIL_TEMPLATES.MATERIAL_REQUEST_PENDING_APPROVAL,
          t,
          { viewUrl, details: rows },
          brand,
        ),
        ...this.brandSender(brand),
        template: EMAIL_TEMPLATES.MATERIAL_REQUEST_PENDING_APPROVAL,
        ...(log ? { log } : {}),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  /**
   * Tell a Company Admin that a material request is stuck: it is awaiting
   * approval but nobody in the company holds `materialRequest.approve`, so the
   * Approver Pool is empty (FOR-347). Same fallback-recipient rule as the PO
   * case (FOR-302), except the remedy is granting the permission — an MR has no
   * amount, so there is no limit to raise.
   */
  async sendMaterialRequestApprovalUnroutableEmail(
    to: string,
    mrNumber: string,
    projectName: string,
    viewUrl: string,
    log?: EmailLogContext,
    brand?: EmailBrand,
  ): Promise<void> {
    const t = this.getTranslations('materialRequestApprovalUnroutable', { mrNumber, projectName });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(
          EMAIL_TEMPLATES.MATERIAL_REQUEST_APPROVAL_UNROUTABLE,
          t,
          { viewUrl },
          brand,
        ),
        ...this.brandSender(brand),
        template: EMAIL_TEMPLATES.MATERIAL_REQUEST_APPROVAL_UNROUTABLE,
        ...(log ? { log } : {}),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendPoDeclinedByVendorEmail(
    to: string,
    poNumber: string,
    vendorName: string,
    viewUrl: string,
    reason?: string,
    log?: EmailLogContext,
    brand?: EmailBrand,
  ): Promise<void> {
    const t = this.getTranslations('poDeclinedByVendor', { poNumber, vendorName });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(
          EMAIL_TEMPLATES.PO_DECLINED_BY_VENDOR,
          t,
          { viewUrl, reason },
          brand,
        ),
        ...this.brandSender(brand),
        template: EMAIL_TEMPLATES.PO_DECLINED_BY_VENDOR,
        ...(log ? { log } : {}),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendChangeRequestProposedEmail(
    to: string,
    bulkId: string,
    proposedBy: string,
    viewUrl: string,
    brand?: EmailBrand,
    comment?: string | null,
  ): Promise<void> {
    const t = this.getTranslations('changeRequestProposed', { bulkId, proposedBy });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(
          EMAIL_TEMPLATES.CHANGE_REQUEST_PROPOSED,
          t,
          { viewUrl, comment: comment ?? undefined },
          brand,
        ),
        ...this.brandSender(brand),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendChangeRequestApprovedEmail(
    to: string,
    bulkId: string,
    viewUrl: string,
    brand?: EmailBrand,
    comment?: string | null,
  ): Promise<void> {
    const t = this.getTranslations('changeRequestApproved', { bulkId });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(
          EMAIL_TEMPLATES.CHANGE_REQUEST_APPROVED,
          t,
          { viewUrl, comment: comment ?? undefined },
          brand,
        ),
        ...this.brandSender(brand),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendChangeRequestRejectedEmail(
    to: string,
    bulkId: string,
    viewUrl: string,
    brand?: EmailBrand,
    comment?: string | null,
  ): Promise<void> {
    const t = this.getTranslations('changeRequestRejected', { bulkId });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(
          EMAIL_TEMPLATES.CHANGE_REQUEST_REJECTED,
          t,
          { viewUrl, comment: comment ?? undefined },
          brand,
        ),
        ...this.brandSender(brand),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  /**
   * Purchase-order change-request emails (US 5.12). These are deliberately
   * separate from the bulk-agreement trio above: the matrix requires the email
   * to name the document type and the PO reference, and the two flows have
   * diverged enough (guest proposers, PO email log) that sharing one template
   * would mean templating the noun.
   *
   * Every one carries a short summary only — never a field-by-field preview of
   * the change and never a PDF. The full diff lives behind `viewUrl`.
   */
  async sendPoChangeProposedEmail(
    to: string,
    poNumber: string,
    proposedBy: string,
    viewUrl: string,
    options?: { comment?: string | null; brand?: EmailBrand; log?: EmailLogContext },
  ): Promise<void> {
    const t = this.getTranslations('poChangeProposed', { poNumber, proposedBy });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(
          EMAIL_TEMPLATES.PO_CHANGE_PROPOSED,
          t,
          { viewUrl, comment: options?.comment ?? undefined },
          options?.brand,
        ),
        ...this.brandSender(options?.brand),
        template: EMAIL_TEMPLATES.PO_CHANGE_PROPOSED,
        ...(options?.log ? { log: options.log } : {}),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendPoChangeApprovedEmail(
    to: string,
    poNumber: string,
    viewUrl: string,
    options?: { comment?: string | null; brand?: EmailBrand; log?: EmailLogContext },
  ): Promise<void> {
    const t = this.getTranslations('poChangeApproved', { poNumber });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(
          EMAIL_TEMPLATES.PO_CHANGE_APPROVED,
          t,
          { viewUrl, comment: options?.comment ?? undefined },
          options?.brand,
        ),
        ...this.brandSender(options?.brand),
        template: EMAIL_TEMPLATES.PO_CHANGE_APPROVED,
        ...(options?.log ? { log: options.log } : {}),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendPoChangeRejectedEmail(
    to: string,
    poNumber: string,
    viewUrl: string,
    options?: { comment?: string | null; brand?: EmailBrand; log?: EmailLogContext },
  ): Promise<void> {
    const t = this.getTranslations('poChangeRejected', { poNumber });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(
          EMAIL_TEMPLATES.PO_CHANGE_REJECTED,
          t,
          { viewUrl, comment: options?.comment ?? undefined },
          options?.brand,
        ),
        ...this.brandSender(options?.brand),
        template: EMAIL_TEMPLATES.PO_CHANGE_REJECTED,
        ...(options?.log ? { log: options.log } : {}),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  /**
   * An INTERNAL (non-commercial) PO change needs no counterparty approval, so
   * this tells the other party the document moved rather than asking them to
   * act. No user comment by matrix decision.
   */
  async sendPoInternalChangeEmail(
    to: string,
    poNumber: string,
    updatedBy: string,
    viewUrl: string,
    options?: { brand?: EmailBrand; log?: EmailLogContext },
  ): Promise<void> {
    const t = this.getTranslations('poInternalChange', { poNumber, updatedBy });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.PO_INTERNAL_CHANGE, t, { viewUrl }, options?.brand),
        ...this.brandSender(options?.brand),
        template: EMAIL_TEMPLATES.PO_INTERNAL_CHANGE,
        ...(options?.log ? { log: options.log } : {}),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  /**
   * Tell a vendor their invoice was rejected / a discrepancy was raised against
   * it (US 8.05 / 8.06). Supporting references stay behind `viewUrl` — the
   * matrix explicitly does not attach them.
   */
  async sendInvoiceRejectedEmail(
    to: string,
    params: { invoiceReference: string; companyName: string; projectName: string },
    viewUrl: string,
    options?: { comment?: string | null; brand?: EmailBrand },
  ): Promise<void> {
    const t = this.getTranslations('invoiceRejected', params);

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(
          EMAIL_TEMPLATES.INVOICE_REJECTED,
          t,
          { viewUrl, comment: options?.comment ?? undefined },
          options?.brand,
        ),
        ...this.brandSender(options?.brand),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  /** Approved invoice approaching its due date (US 8.09). */
  async sendPaymentDueReminderEmail(
    to: string,
    params: {
      invoiceReference: string;
      vendorName: string;
      amount: string;
      dueDate: string;
      daysUntilDue: number;
    },
    viewUrl: string,
    brand?: EmailBrand,
  ): Promise<void> {
    const t = this.getTranslations('paymentDueReminder', params);

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.PAYMENT_DUE_REMINDER, t, { viewUrl }, brand),
        ...this.brandSender(brand),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  /** Approved invoice past its due date and not yet paid (US 8.09). */
  async sendPaymentOverdueReminderEmail(
    to: string,
    params: {
      invoiceReference: string;
      vendorName: string;
      amount: string;
      dueDate: string;
    },
    viewUrl: string,
    brand?: EmailBrand,
  ): Promise<void> {
    const t = this.getTranslations('paymentOverdueReminder', params);

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.PAYMENT_OVERDUE_REMINDER, t, { viewUrl }, brand),
        ...this.brandSender(brand),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  /**
   * Daily overdue reminder (FOR-394): an MR not yet ordered, an RFQ not yet
   * awarded, or a PO not yet delivered passed its date. One layout, three copy
   * sections. Fire-and-forget like the payment reminders.
   */
  async sendOverdueReminderEmail(
    to: string,
    section: 'materialRequestOverdueReminder' | 'rfqOverdueReminder' | 'poDeliveryOverdueReminder',
    params: Record<string, string>,
    viewUrl: string,
    brand?: EmailBrand,
  ): Promise<void> {
    const t = this.getTranslations(section, params);

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.OVERDUE_REMINDER, t, { viewUrl }, brand),
        ...this.brandSender(brand),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  /**
   * Notify a catalogue contributor that their proposed edit to a PUBLIC material
   * was approved (US 4.01 Phase 3). Fire-and-forget, like every other transactional
   * email — the approval has already been committed by the time we send.
   */
  async sendMaterialChangeApprovedEmail(
    to: string,
    materialName: string,
    viewUrl: string,
  ): Promise<void> {
    const t = this.getTranslations('materialChangeApproved', { materialName });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.MATERIAL_CHANGE_APPROVED, t, { viewUrl }),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  /**
   * Notify a catalogue contributor that their proposed edit was rejected (US 4.01
   * Phase 3), optionally with the reviewer's reason.
   */
  async sendMaterialChangeRejectedEmail(
    to: string,
    materialName: string,
    viewUrl: string,
    reason?: string,
  ): Promise<void> {
    const t = this.getTranslations('materialChangeRejected', { materialName });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.MATERIAL_CHANGE_REJECTED, t, { viewUrl, reason }),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendBulkOrderCancelledEmail(
    to: string,
    bulkId: string,
    cancelledBy: string,
    brand?: EmailBrand,
    comment?: string | null,
  ): Promise<void> {
    const t = this.getTranslations('bulkOrderCancelled', { bulkId, cancelledBy });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(
          EMAIL_TEMPLATES.BULK_ORDER_CANCELLED,
          t,
          { comment: comment ?? undefined },
          brand,
        ),
        ...this.brandSender(brand),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendQuoteUpdatedEmail(
    to: string,
    rfqNumber: string,
    vendorName: string,
    viewUrl: string,
    brand?: EmailBrand,
    comment?: string | null,
  ): Promise<void> {
    const t = this.getTranslations('quoteUpdated', { rfqNumber, vendorName });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(
          EMAIL_TEMPLATES.QUOTE_UPDATED,
          t,
          { viewUrl, comment: comment ?? undefined },
          brand,
        ),
        ...this.brandSender(brand),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendQuoteSubmittedEmail(
    to: string,
    rfqNumber: string,
    vendorName: string,
    viewUrl: string,
    brand?: EmailBrand,
    comment?: string | null,
  ): Promise<void> {
    const t = this.getTranslations('quoteSubmitted', { rfqNumber, vendorName });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(
          EMAIL_TEMPLATES.QUOTE_SUBMITTED,
          t,
          { viewUrl, comment: comment ?? undefined },
          brand,
        ),
        ...this.brandSender(brand),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendInvitationExpiredNotification(
    adminEmail: string,
    adminName: string,
    invitedUserName: string,
    invitedUserEmail: string,
  ): Promise<void> {
    const t = this.getTranslations('invitationExpiredNotification', {
      name: adminName,
      invitedUserName,
      invitedUserEmail,
    });

    try {
      await this.dispatch({
        to: adminEmail,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.INVITATION_EXPIRED_NOTIFICATION, t),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }
}
