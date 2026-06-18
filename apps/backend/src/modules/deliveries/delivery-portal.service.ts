import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { AccessTokenPurpose, AccessTokenSubject, Prisma, type AccessToken } from '@prisma/client';
import type {
  DeliveryPortalPoResponse,
  PortalSubmitResponse,
} from '@forethread/shared-types';
import { DeliveryReportSource } from '@forethread/shared-types';

import { PrismaService } from '../../prisma/prisma.service';
import { AccessTokensService } from '../access-tokens/access-tokens.service';
import { EmailService } from '../notifications/email.service';

import { DeliveriesService, DeliveryLineInput } from './deliveries.service';
import { PortalSubmitDto } from './deliveries.dto';
import { DeliveryCodeService } from './delivery-code.service';

/** Lifetime of a short-lived delivery session token minted after code verify. */
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Metadata stamped onto a DELIVERY_SESSION token. */
interface SessionMetadata {
  email: string;
  name: string;
  deliveryReportId?: string;
}

@Injectable()
export class DeliveryPortalService {
  private readonly logger = new Logger(DeliveryPortalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessTokens: AccessTokensService,
    private readonly deliveryCode: DeliveryCodeService,
    private readonly emailService: EmailService,
    private readonly deliveriesService: DeliveriesService,
  ) {}

  // ── Read-only PO view (DELIVERY_SUBMIT token) ────────────────────────────────

  /** Read-only PO header + lines for the public form. PO comes from the token. */
  async getPortalPo(purchaseOrderId: string): Promise<DeliveryPortalPoResponse> {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: {
        poNumber: true,
        plannedDeliveryDate: true,
        project: { select: { name: true } },
        vendor: { select: { legalName: true } },
        deliveryLocation: { select: { label: true, address: true } },
        lineItems: {
          orderBy: { lineNumber: 'asc' },
          select: {
            id: true,
            lineNumber: true,
            materialCode: true,
            description: true,
            unitOfMeasure: true,
            quantityOrdered: true,
            material: { select: { name: true } },
          },
        },
      },
    });
    if (!po) throw new ForbiddenException('Invalid delivery link.');

    return {
      poNumber: po.poNumber,
      projectName: po.project?.name ?? null,
      vendorName: po.vendor?.legalName ?? null,
      deliveryLocationName: po.deliveryLocation
        ? (po.deliveryLocation.label ?? po.deliveryLocation.address)
        : null,
      deliveryDate: po.plannedDeliveryDate?.toISOString() ?? null,
      lines: po.lineItems.map((li) => ({
        id: li.id,
        lineItemRef: li.materialCode ?? `Line ${li.lineNumber}`,
        materialName: li.material?.name ?? li.description ?? '',
        description: li.description,
        uom: li.unitOfMeasure,
        quantityOrdered: li.quantityOrdered,
      })),
    };
  }

  // ── Identify: generate + email a code (DELIVERY_SUBMIT token) ─────────────────

  /**
   * Generate a 6-digit code for `(po, email)` and email it. ALWAYS resolves to
   * `{ ok: true }` regardless of outcome (anti-enumeration) — a failure to send
   * must not reveal whether the PO/email is valid.
   */
  async identify(
    purchaseOrderId: string,
    name: string,
    email: string,
  ): Promise<{ ok: true }> {
    try {
      const po = await this.prisma.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        select: { poNumber: true },
      });
      if (po) {
        const { code, expiresAt } = await this.deliveryCode.generateAndStore(
          purchaseOrderId,
          email,
        );
        await this.emailService.sendDeliveryCodeEmail(email, code, expiresAt, po.poNumber);
      }
    } catch (err) {
      // Swallow — never reveal whether the code was actually sent.
      this.logger.debug(
        `identify() suppressed error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    // `name` is captured later (on the session token at verify time).
    void name;
    return { ok: true };
  }

  // ── Verify: mint a DELIVERY_SESSION token (DELIVERY_SUBMIT token) ─────────────

  /**
   * Verify the emailed code; on success mint a 30-minute DELIVERY_SESSION token
   * carrying `{ email, name }` and return it. The verify call itself throws on
   * lockout / expiry; a plain non-match returns a 400.
   */
  async verify(
    purchaseOrderId: string,
    email: string,
    code: string,
    name: string,
  ): Promise<{ sessionToken: string }> {
    const ok = await this.deliveryCode.verifyCode(purchaseOrderId, email, code);
    if (!ok) {
      throw new BadRequestException('Incorrect or expired code.');
    }

    const issued = await this.accessTokens.issueToken({
      subjectType: AccessTokenSubject.PURCHASE_ORDER,
      subjectId: purchaseOrderId,
      purpose: AccessTokenPurpose.DELIVERY_SESSION,
      ttlMs: SESSION_TTL_MS,
      metadata: { email, name } satisfies SessionMetadata,
    });

    return { sessionToken: issued.token };
  }

  // ── Submit: create the EXTERNAL report (DELIVERY_SESSION token) ───────────────

  /**
   * Create the EXTERNAL delivery report from the session-token submitter identity,
   * then stamp the new report id back onto the session token's metadata so the
   * follow-up photo/attachment uploads can be bound to it.
   */
  async submit(token: AccessToken, dto: PortalSubmitDto): Promise<PortalSubmitResponse> {
    const meta = this.readSessionMeta(token);

    const lines: DeliveryLineInput[] = dto.lines.map((line) => ({
      poLineItemId: line.poLineItemId,
      quantityReceived: line.quantityReceived,
      outcome: line.outcome,
      notes: line.notes,
      damagedQuantity: line.damagedQuantity,
      damageType: line.damageType,
      damageDisposition: line.damageDisposition,
    }));

    const reportId = await this.deliveriesService.createReport(
      DeliveryReportSource.EXTERNAL,
      { userId: null, name: meta.name, email: meta.email },
      token.subjectId,
      {
        deliveryDate: dto.deliveryDate,
        contactPerson: dto.contactPerson,
        contactPhone: dto.contactPhone,
        overallNotes: dto.overallNotes,
      },
      lines,
    );

    // Stamp the report id onto the session token so uploads can be bound to it.
    await this.prisma.accessToken.update({
      where: { id: token.id },
      data: {
        metadata: { ...meta, deliveryReportId: reportId } as unknown as Prisma.InputJsonValue,
      },
    });

    const report = await this.prisma.deliveryReport.findUniqueOrThrow({
      where: { id: reportId },
      select: { reportNumber: true },
    });

    return { deliveryReportId: reportId, reportNumber: report.reportNumber };
  }

  // ── Finalize: consume the session token (DELIVERY_SESSION token) ──────────────

  async finalize(token: AccessToken): Promise<{ ok: true }> {
    await this.accessTokens.consumeToken(token.id);
    return { ok: true };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * The deliveryReportId previously stamped on the session token, asserting the
   * upload/line belongs to that report. Throws 403 if no report has been created
   * yet on this session.
   */
  resolveSessionReportId(token: AccessToken): string {
    const meta = this.readSessionMeta(token);
    if (!meta.deliveryReportId) {
      throw new ForbiddenException('No delivery report has been submitted on this session yet.');
    }
    return meta.deliveryReportId;
  }

  private readSessionMeta(token: AccessToken): SessionMetadata {
    const raw = token.metadata;
    if (!raw || typeof raw !== 'object') {
      throw new ForbiddenException('Invalid delivery session.');
    }
    const meta = raw as Partial<SessionMetadata>;
    if (typeof meta.email !== 'string' || typeof meta.name !== 'string') {
      throw new ForbiddenException('Invalid delivery session.');
    }
    return {
      email: meta.email,
      name: meta.name,
      deliveryReportId: typeof meta.deliveryReportId === 'string' ? meta.deliveryReportId : undefined,
    };
  }
}
