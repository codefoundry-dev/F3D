import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { verifyResendSignature } from '../email-log/resend-signature';

import { InvoiceIntakeService } from './invoice-intake.service';
import { parseInboundEmail, type ResendInboundPayload } from './resend-inbound.types';

/**
 * Receives Resend inbound-email webhooks for the invoice-intake inbox
 * (FOR-290). Public (no JWT) but signature-verified with the Svix scheme when
 * `RESEND_INBOUND_WEBHOOK_SECRET` is configured (falls back to
 * `RESEND_WEBHOOK_SECRET` when both endpoints share a signing secret).
 *
 * Answers 2xx for well-formed, authentic calls — even unhandled event types or
 * unmatched recipients — so Resend doesn't retry. Signature failures return
 * 401; a processing failure that persisted nothing propagates as 5xx so Resend
 * retries the email (dedup on the email id makes the retry safe).
 */
@Controller('webhooks/resend-inbound')
export class ResendInboundController {
  private readonly logger = new Logger(ResendInboundController.name);
  private readonly secret: string;

  constructor(
    config: ConfigService,
    private readonly intakeService: InvoiceIntakeService,
  ) {
    this.secret =
      config.get<string>('RESEND_INBOUND_WEBHOOK_SECRET', '') ||
      config.get<string>('RESEND_WEBHOOK_SECRET', '');
  }

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: ResendInboundPayload,
    @Headers('svix-id') svixId?: string,
    @Headers('svix-timestamp') svixTimestamp?: string,
    @Headers('svix-signature') svixSignature?: string,
  ): Promise<{ received: boolean }> {
    this.assertSignature(req, svixId, svixTimestamp, svixSignature);

    const email = parseInboundEmail(body);
    if (!email) {
      return { received: true };
    }

    const result = await this.intakeService.processInboundEmail(email);
    this.logger.log(
      `Inbound email ${email.emailId}: ${result.invoicesCreated} invoice(s) created` +
        (result.reason ? ` (${result.reason})` : ''),
    );

    return { received: true };
  }

  private assertSignature(
    req: RawBodyRequest<Request>,
    id?: string,
    timestamp?: string,
    signature?: string,
  ): void {
    if (!this.secret) {
      // Dev / staging without the secret: accept unsigned calls but make the gap
      // visible. Production always sets a webhook secret.
      this.logger.warn('RESEND_INBOUND_WEBHOOK_SECRET not set — skipping signature verification');
      return;
    }

    const raw = req.rawBody;
    if (!raw || !id || !timestamp || !signature) {
      throw new UnauthorizedException('Missing Resend webhook signature');
    }

    const verified = verifyResendSignature({
      secret: this.secret,
      payload: raw.toString('utf8'),
      headers: { id, timestamp, signature },
    });
    if (!verified) {
      throw new UnauthorizedException('Invalid Resend webhook signature');
    }
  }
}
