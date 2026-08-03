import { randomBytes, randomUUID } from 'crypto';
import * as path from 'path';

import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvoiceSource, Prisma } from '@prisma/client';

import { ERR } from '../../common/constants/error-messages.const';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { DocIntelligenceService } from '../doc-intelligence/doc-intelligence.service';
import { StorageService } from '../storage/storage.service';

import { ParsedInboundEmail } from './resend-inbound.types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/** Mirrors the doc-intelligence extractor's natively supported formats. */
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

/** Local-part prefix of every company intake address. */
const INBOX_LOCAL_PREFIX = 'invoices-';

const RESEND_API_BASE = 'https://api.resend.com';

interface InboundAttachment {
  id: string;
  filename: string;
  size: number;
  content_type: string;
  content_disposition?: string;
  download_url: string;
}

export interface InboundProcessingResult {
  handled: boolean;
  reason?: string;
  invoicesCreated: number;
}

/**
 * Invoice intake (FOR-290): every path an invoice can enter the system by —
 * manual upload by the buyer team, or arrival on the company's intake email
 * inbox — creating an Invoice record in Pending ("to review") for the review
 * flow (FOR-291) to fill in.
 */
@Injectable()
export class InvoiceIntakeService {
  private readonly logger = new Logger(InvoiceIntakeService.name);
  private readonly inboundDomain: string;
  private readonly resendApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly docIntelligence: DocIntelligenceService,
    config: ConfigService,
  ) {
    this.inboundDomain = config.get<string>('INVOICE_INBOUND_DOMAIN', '').toLowerCase();
    this.resendApiKey = config.get<string>('RESEND_API_KEY', '');
  }

  // ── Manual upload ──────────────────────────────────────────────────────────

  /**
   * One uploaded file = one new Pending invoice with the file attached as its
   * first document. Vendor/project/amount stay empty until review (FOR-291).
   */
  async uploadInvoice(file: Express.Multer.File, user: AuthenticatedUser) {
    if (!file) throw new BadRequestException(ERR.storage.noFileProvided);
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException(ERR.storage.fileTooLarge('10MB'));
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(ERR.storage.fileTypeNotAllowed);
    }
    if (!user.companyId) throw new ForbiddenException(ERR.general.accessDenied);

    const invoiceId = randomUUID();
    const ext = path.extname(file.originalname);
    const key = `invoice-documents/${invoiceId}/${randomUUID()}${ext}`;
    const stored = await this.storageService.upload(key, file.buffer, file.mimetype);

    const invoice = await this.prisma.invoice.create({
      data: {
        id: invoiceId,
        companyId: user.companyId,
        createdByUserId: user.id,
        source: InvoiceSource.MANUAL,
        documents: {
          create: {
            file: {
              create: {
                bucket: stored.bucket,
                key: stored.key,
                filename: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                uploadedById: user.id,
              },
            },
          },
        },
      },
      include: {
        documents: { include: { file: { select: { id: true, filename: true } } } },
      },
    });

    // Read the invoice automatically (FOR-291); review shows the result for
    // the reviewer to confirm or correct.
    this.startExtraction(invoice.id, user.companyId, user.id, [
      { fileId: invoice.documents[0].file.id, mimeType: file.mimetype, data: file.buffer },
    ]);

    return {
      id: invoice.id,
      status: invoice.status,
      source: invoice.source,
      createdAt: invoice.createdAt.toISOString(),
      documents: invoice.documents.map((doc) => ({
        id: doc.id,
        name: doc.file.filename,
        fileId: doc.file.id,
      })),
    };
  }

  // ── Intake inbox address ───────────────────────────────────────────────────

  /**
   * The company's invoice-intake email address, generating its inbox key on
   * first view. Returns `email: null` when inbound email isn't configured
   * (INVOICE_INBOUND_DOMAIN unset), so the UI can hide the panel.
   */
  async getIntakeAddress(user: AuthenticatedUser): Promise<{ email: string | null }> {
    if (!user.companyId) throw new ForbiddenException(ERR.general.accessDenied);
    if (!this.inboundDomain) return { email: null };

    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: user.companyId },
      select: { invoiceInboxKey: true },
    });

    let inboxKey = company.invoiceInboxKey;
    inboxKey ??= await this.assignInboxKey(user.companyId);

    return { email: `${INBOX_LOCAL_PREFIX}${inboxKey}@${this.inboundDomain}` };
  }

  /** Generate + persist a fresh inbox key, retrying the rare unique collision. */
  private async assignInboxKey(companyId: string): Promise<string> {
    for (let attempt = 0; ; attempt++) {
      // 10 bytes → 16 lowercase base32 chars; unguessable but typeable.
      const candidate = randomBytes(10).toString('hex').slice(0, 16);
      try {
        await this.prisma.company.update({
          where: { id: companyId },
          data: { invoiceInboxKey: candidate },
        });
        return candidate;
      } catch (error) {
        const isUniqueClash =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!isUniqueClash || attempt >= 2) throw error;
      }
    }
  }

  // ── Email intake ───────────────────────────────────────────────────────────

  /**
   * Turn a received email into Pending invoices for the company whose intake
   * address it was sent to. Each PDF attachment becomes its own invoice (one
   * invoice per email is the norm, but vendors do batch); image attachments are
   * grouped into a single invoice, since multiple images are usually pages of
   * one photographed invoice. Inline images (signature logos) are ignored.
   *
   * Idempotent on the provider email id: a webhook retry after success is a
   * no-op. When every attachment fails to persist, the error propagates so the
   * provider retries the whole email.
   */
  async processInboundEmail(email: ParsedInboundEmail): Promise<InboundProcessingResult> {
    const company = await this.resolveCompany(email.to);
    if (!company) {
      this.logger.warn(`Inbound email ${email.emailId}: no company matches ${email.to.join(', ')}`);
      return { handled: false, reason: 'no-matching-company', invoicesCreated: 0 };
    }

    const existing = await this.prisma.invoice.findFirst({
      where: { intakeEmailId: email.emailId },
      select: { id: true },
    });
    if (existing) {
      return { handled: true, reason: 'duplicate-delivery', invoicesCreated: 0 };
    }

    const attachments = await this.listAttachments(email.emailId);
    const usable = attachments.filter((att) => this.isUsableAttachment(att, email.emailId));
    if (usable.length === 0) {
      this.logger.warn(`Inbound email ${email.emailId}: no usable invoice attachments`);
      return { handled: true, reason: 'no-usable-attachments', invoicesCreated: 0 };
    }

    const pdfGroups = usable
      .filter((att) => att.content_type === 'application/pdf')
      .map((att) => [att]);
    const imageGroup = usable.filter((att) => att.content_type !== 'application/pdf');
    const groups = imageGroup.length > 0 ? [...pdfGroups, imageGroup] : pdfGroups;

    let created = 0;
    let lastError: unknown = null;
    for (const group of groups) {
      try {
        await this.createInvoiceFromAttachments(company.id, email, group);
        created++;
      } catch (error) {
        lastError = error;
        this.logger.error(
          `Inbound email ${email.emailId}: failed to store attachment group (${group
            .map((a) => a.filename)
            .join(', ')})`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    // Nothing persisted → let the provider retry the whole email later.
    if (created === 0 && lastError !== null) {
      throw lastError instanceof Error ? lastError : new Error(JSON.stringify(lastError));
    }

    return { handled: true, invoicesCreated: created };
  }

  /** Match any recipient shaped `invoices-<key>@<inbound domain>` to a company. */
  private async resolveCompany(recipients: string[]): Promise<{ id: string } | null> {
    if (!this.inboundDomain) return null;

    for (const recipient of recipients) {
      const [localPart, domain] = recipient.split('@');
      if (domain !== this.inboundDomain || !localPart.startsWith(INBOX_LOCAL_PREFIX)) continue;

      const key = localPart.slice(INBOX_LOCAL_PREFIX.length);
      if (!key) continue;

      const company = await this.prisma.company.findUnique({
        where: { invoiceInboxKey: key },
        select: { id: true },
      });
      if (company) return company;
    }
    return null;
  }

  private isUsableAttachment(att: InboundAttachment, emailId: string): boolean {
    // Inline parts are signature logos / embedded images, not documents.
    if (att.content_disposition === 'inline') return false;
    if (!ALLOWED_MIME_TYPES.includes(att.content_type)) {
      this.logger.warn(
        `Inbound email ${emailId}: skipping "${att.filename}" (${att.content_type})`,
      );
      return false;
    }
    if (att.size > MAX_FILE_SIZE) {
      this.logger.warn(`Inbound email ${emailId}: skipping oversized "${att.filename}"`);
      return false;
    }
    return true;
  }

  private async createInvoiceFromAttachments(
    companyId: string,
    email: ParsedInboundEmail,
    attachments: InboundAttachment[],
  ): Promise<void> {
    const invoiceId = randomUUID();

    const files: {
      id: string;
      bucket: string;
      key: string;
      filename: string;
      mimeType: string;
      size: number;
    }[] = [];
    // Attachment payloads, kept alongside their pre-generated file ids so the
    // extraction (FOR-291) can send them to Gemini without re-downloading.
    const buffers: Buffer[] = [];
    for (const att of attachments) {
      const buffer = await this.downloadAttachment(att);
      const ext = path.extname(att.filename) || this.extensionFor(att.content_type);
      const key = `invoice-documents/${invoiceId}/${randomUUID()}${ext}`;
      const stored = await this.storageService.upload(key, buffer, att.content_type);
      files.push({
        id: randomUUID(),
        bucket: stored.bucket,
        key: stored.key,
        filename: att.filename,
        mimeType: att.content_type,
        size: buffer.length,
      });
      buffers.push(buffer);
    }

    await this.prisma.invoice.create({
      data: {
        id: invoiceId,
        companyId,
        source: InvoiceSource.EMAIL,
        senderEmail: email.from,
        intakeEmailId: email.emailId,
        documents: {
          create: files.map((file) => ({ file: { create: file } })),
        },
      },
    });

    // Read the invoice automatically (FOR-291). Email intake has no acting
    // user, so the extraction is unattributed.
    this.startExtraction(
      invoiceId,
      companyId,
      null,
      files.map((file, i) => ({ fileId: file.id, mimeType: file.mimeType, data: buffers[i] })),
    );
  }

  /**
   * Kick off the Gemini extraction for a just-created intake invoice.
   * Fire-and-forget: intake has already committed the invoice, so extraction
   * problems must never fail the upload or make the email webhook retry.
   */
  private startExtraction(
    invoiceId: string,
    companyId: string,
    createdByUserId: string | null,
    files: { fileId: string; mimeType: string; data: Buffer }[],
  ): void {
    void this.docIntelligence
      .createInvoiceExtraction({ invoiceId, companyId, createdByUserId, files })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to start extraction for invoice ${invoiceId}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
  }

  // ── Resend receiving API ───────────────────────────────────────────────────

  private async listAttachments(emailId: string): Promise<InboundAttachment[]> {
    if (!this.resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured — cannot fetch inbound attachments');
    }

    const response = await fetch(
      `${RESEND_API_BASE}/emails/receiving/${emailId}/attachments?limit=100`,
      { headers: { Authorization: `Bearer ${this.resendApiKey}` } },
    );
    if (!response.ok) {
      throw new Error(`Resend attachments API returned ${response.status} for email ${emailId}`);
    }

    const body = (await response.json()) as { data?: InboundAttachment[]; has_more?: boolean };
    if (body.has_more) {
      this.logger.warn(`Inbound email ${emailId}: more than 100 attachments; extra ones ignored`);
    }
    return body.data ?? [];
  }

  private async downloadAttachment(att: InboundAttachment): Promise<Buffer> {
    const response = await fetch(att.download_url);
    if (!response.ok) {
      throw new Error(`Attachment download failed (${response.status}) for "${att.filename}"`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private extensionFor(mimeType: string): string {
    switch (mimeType) {
      case 'application/pdf':
        return '.pdf';
      case 'image/png':
        return '.png';
      case 'image/jpeg':
        return '.jpg';
      case 'image/webp':
        return '.webp';
      default:
        return '';
    }
  }
}
