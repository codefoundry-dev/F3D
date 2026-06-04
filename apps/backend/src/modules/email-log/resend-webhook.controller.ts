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
import { Prisma } from '@prisma/client';
import { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';

import { EmailLogService } from './email-log.service';
import { verifyResendSignature } from './resend-signature';
import { parseResendEvent, type ResendWebhookPayload } from './resend-webhook.types';

/**
 * Receives Resend delivery webhooks (FOR-213) and folds them into the email log.
 * Public (no JWT) but signature-verified with the Svix scheme when
 * `RESEND_WEBHOOK_SECRET` is configured. Always answers 2xx for well-formed,
 * authentic calls — even unknown message ids or event types — so Resend doesn't
 * retry; only signature failures return 401.
 */
@Controller('webhooks/resend')
export class ResendWebhookController {
  private readonly logger = new Logger(ResendWebhookController.name);
  private readonly secret: string;

  constructor(
    config: ConfigService,
    private readonly emailLogService: EmailLogService,
  ) {
    this.secret = config.get<string>('RESEND_WEBHOOK_SECRET', '');
  }

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: ResendWebhookPayload,
    @Headers('svix-id') svixId?: string,
    @Headers('svix-timestamp') svixTimestamp?: string,
    @Headers('svix-signature') svixSignature?: string,
  ): Promise<{ received: boolean }> {
    this.assertSignature(req, svixId, svixTimestamp, svixSignature);

    const event = parseResendEvent(body);
    if (!event) {
      return { received: true };
    }

    await this.emailLogService.recordEvent({
      providerMessageId: event.emailId,
      type: event.type,
      occurredAt: event.occurredAt,
      providerEventId: svixId ?? null,
      bounceType: event.bounceType,
      bounceReason: event.bounceReason,
      // Retain the raw envelope for debugging/audit.
      payload: body as unknown as Prisma.InputJsonValue,
    });

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
      // visible. Production always sets RESEND_WEBHOOK_SECRET.
      this.logger.warn('RESEND_WEBHOOK_SECRET not set — skipping signature verification');
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
