import * as fs from 'fs';
import * as path from 'path';

import emailTranslations from '@forethread/i18n/locales/en/emails.json';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import { EMAIL_TEMPLATES } from './email-templates.const';
import type { EmailTemplateName } from './email-templates.const';
import { ResendService } from './resend.service';

/** A rendered message ready to hand to whichever transport is active. */
interface EmailMessage {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments?: { filename: string; content: Buffer }[];
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
  ): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Email template "${templateName}" not found`);
    }

    const footer = emailTranslations.footer;
    const content = template({ t: translations, ...params });
    return this.layoutTemplate({ content, footer });
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
    if (this.resend.isConfigured()) {
      const result = await this.resend.send({
        to: message.to,
        subject: message.subject,
        ...(message.html ? { html: message.html } : {}),
        ...(message.text ? { text: message.text } : {}),
        ...(message.attachments ? { attachments: message.attachments } : {}),
      });
      if (result.status === 'error') {
        this.logger.warn(`Resend send failed [${result.code}]: ${result.message}`);
      }
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      ...(message.html ? { html: message.html } : {}),
      ...(message.text ? { text: message.text } : {}),
      ...(message.attachments ? { attachments: message.attachments } : {}),
    });
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

  async sendRfqReceivedEmail(to: string, rfqNumber: string, replyUrl: string): Promise<void> {
    const t = this.getTranslations('rfqReceived', { rfqNumber });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.RFQ_RECEIVED, t, { replyUrl }),
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
  ): Promise<void> {
    const t = this.getTranslations('poIssued', { poNumber });

    try {
      const attachments = pdfBuffer ? [{ filename: `PO-${poNumber}.pdf`, content: pdfBuffer }] : [];

      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.PO_ISSUED, t, { viewUrl }),
        attachments,
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
  ): Promise<void> {
    const t = this.getTranslations('poDeclinedByVendor', { poNumber, vendorName });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.PO_DECLINED_BY_VENDOR, t, { viewUrl, reason }),
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
  ): Promise<void> {
    const t = this.getTranslations('changeRequestProposed', { bulkId, proposedBy });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.CHANGE_REQUEST_PROPOSED, t, { viewUrl }),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendChangeRequestApprovedEmail(to: string, bulkId: string, viewUrl: string): Promise<void> {
    const t = this.getTranslations('changeRequestApproved', { bulkId });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.CHANGE_REQUEST_APPROVED, t, { viewUrl }),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendChangeRequestRejectedEmail(to: string, bulkId: string, viewUrl: string): Promise<void> {
    const t = this.getTranslations('changeRequestRejected', { bulkId });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.CHANGE_REQUEST_REJECTED, t, { viewUrl }),
      });
    } catch {
      // fire-and-forget: email failures are non-critical
    }
  }

  async sendBulkOrderCancelledEmail(
    to: string,
    bulkId: string,
    cancelledBy: string,
  ): Promise<void> {
    const t = this.getTranslations('bulkOrderCancelled', { bulkId, cancelledBy });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.BULK_ORDER_CANCELLED, t),
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
  ): Promise<void> {
    const t = this.getTranslations('quoteUpdated', { rfqNumber, vendorName });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.QUOTE_UPDATED, t, { viewUrl }),
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
  ): Promise<void> {
    const t = this.getTranslations('quoteSubmitted', { rfqNumber, vendorName });

    try {
      await this.dispatch({
        to,
        subject: t.subject,
        html: this.renderEmail(EMAIL_TEMPLATES.QUOTE_SUBMITTED, t, { viewUrl }),
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
