import { createHmac } from 'crypto';

import { UnauthorizedException, type RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailEventType } from '@prisma/client';
import { Request } from 'express';

import { EmailLogService } from './email-log.service';
import { ResendWebhookController } from './resend-webhook.controller';
import { type ResendWebhookPayload } from './resend-webhook.types';

const SECRET = `whsec_${Buffer.from('forethread-webhook-test-key').toString('base64')}`;
const SVIX_ID = 'msg_2webhook';
const TIMESTAMP = String(Math.floor(Date.now() / 1000));

/** Re-implements the Svix signing the controller verifies, for building fixtures. */
function sign(id: string, timestamp: string, payload: string): string {
  const key = Buffer.from(SECRET.slice('whsec_'.length), 'base64');
  const sig = createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64');
  return `v1,${sig}`;
}

/** Build a RawBodyRequest carrying the exact bytes a signature is computed over. */
function reqWith(rawBody: string | undefined): RawBodyRequest<Request> {
  return {
    rawBody: rawBody === undefined ? undefined : Buffer.from(rawBody, 'utf8'),
  } as RawBodyRequest<Request>;
}

const buildConfig = (secret: string): jest.Mocked<ConfigService> =>
  ({
    get: jest.fn((key: string, defaultValue?: unknown) =>
      key === 'RESEND_WEBHOOK_SECRET' ? secret : defaultValue,
    ),
  }) as unknown as jest.Mocked<ConfigService>;

describe('ResendWebhookController', () => {
  let emailLogService: { recordEvent: jest.Mock };

  beforeEach(() => {
    emailLogService = { recordEvent: jest.fn().mockResolvedValue(true) };
  });

  const makeController = (secret: string): ResendWebhookController =>
    new ResendWebhookController(buildConfig(secret), emailLogService as unknown as EmailLogService);

  describe('with a configured signing secret', () => {
    let controller: ResendWebhookController;

    beforeEach(() => {
      controller = makeController(SECRET);
    });

    it('records a valid, correctly signed delivered webhook and acks', async () => {
      const body: ResendWebhookPayload = {
        type: 'email.delivered',
        data: { email_id: 'resend-msg-1', created_at: '2026-06-04T10:00:00.000Z' },
      };
      const raw = JSON.stringify(body);
      const signature = sign(SVIX_ID, TIMESTAMP, raw);

      const result = await controller.handle(reqWith(raw), body, SVIX_ID, TIMESTAMP, signature);

      expect(result).toEqual({ received: true });
      expect(emailLogService.recordEvent).toHaveBeenCalledTimes(1);
      const arg = emailLogService.recordEvent.mock.calls[0][0];
      expect(arg).toMatchObject({
        providerMessageId: 'resend-msg-1',
        type: EmailEventType.DELIVERED,
        providerEventId: SVIX_ID,
        occurredAt: new Date('2026-06-04T10:00:00.000Z'),
      });
      expect(arg.payload).toBe(body);
    });

    it('forwards bounce metadata for a signed bounce webhook', async () => {
      const body: ResendWebhookPayload = {
        type: 'email.bounced',
        data: {
          email_id: 'resend-msg-2',
          created_at: '2026-06-04T11:00:00.000Z',
          bounce: { type: 'Permanent', message: 'Mailbox does not exist' },
        },
      };
      const raw = JSON.stringify(body);
      const signature = sign(SVIX_ID, TIMESTAMP, raw);

      await controller.handle(reqWith(raw), body, SVIX_ID, TIMESTAMP, signature);

      const arg = emailLogService.recordEvent.mock.calls[0][0];
      expect(arg).toMatchObject({
        type: EmailEventType.BOUNCED,
        bounceType: 'Permanent',
        bounceReason: 'Mailbox does not exist',
      });
    });

    it('acks without recording when the event type is unrecognised', async () => {
      const body: ResendWebhookPayload = {
        type: 'email.some_future_event',
        data: { email_id: 'resend-msg-3' },
      };
      const raw = JSON.stringify(body);
      const signature = sign(SVIX_ID, TIMESTAMP, raw);

      const result = await controller.handle(reqWith(raw), body, SVIX_ID, TIMESTAMP, signature);

      expect(result).toEqual({ received: true });
      expect(emailLogService.recordEvent).not.toHaveBeenCalled();
    });

    it('acks without recording when the message id is missing', async () => {
      const body: ResendWebhookPayload = { type: 'email.delivered', data: {} };
      const raw = JSON.stringify(body);
      const signature = sign(SVIX_ID, TIMESTAMP, raw);

      const result = await controller.handle(reqWith(raw), body, SVIX_ID, TIMESTAMP, signature);

      expect(result).toEqual({ received: true });
      expect(emailLogService.recordEvent).not.toHaveBeenCalled();
    });

    it('rejects with 401 when the signature does not match the body', async () => {
      const body: ResendWebhookPayload = {
        type: 'email.delivered',
        data: { email_id: 'resend-msg-4' },
      };
      const raw = JSON.stringify(body);
      const signature = sign(SVIX_ID, TIMESTAMP, raw);
      // Verify against a tampered raw body so the HMAC no longer matches.
      const tamperedReq = reqWith(`${raw} `);

      await expect(
        controller.handle(tamperedReq, body, SVIX_ID, TIMESTAMP, signature),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(emailLogService.recordEvent).not.toHaveBeenCalled();
    });

    it('rejects with 401 when the svix headers are missing', async () => {
      const body: ResendWebhookPayload = {
        type: 'email.delivered',
        data: { email_id: 'resend-msg-5' },
      };
      const raw = JSON.stringify(body);

      await expect(
        controller.handle(reqWith(raw), body, undefined, undefined, undefined),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(emailLogService.recordEvent).not.toHaveBeenCalled();
    });

    it('rejects with 401 when the raw body is unavailable', async () => {
      const body: ResendWebhookPayload = {
        type: 'email.delivered',
        data: { email_id: 'resend-msg-6' },
      };
      const raw = JSON.stringify(body);
      const signature = sign(SVIX_ID, TIMESTAMP, raw);

      await expect(
        controller.handle(reqWith(undefined), body, SVIX_ID, TIMESTAMP, signature),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(emailLogService.recordEvent).not.toHaveBeenCalled();
    });
  });

  describe('without a signing secret (dev / staging)', () => {
    it('skips verification and records the event', async () => {
      const controller = makeController('');
      const body: ResendWebhookPayload = {
        type: 'email.opened',
        data: { email_id: 'resend-msg-7' },
      };

      // No svix headers at all, and providerEventId falls back to null.
      const result = await controller.handle(reqWith(undefined), body);

      expect(result).toEqual({ received: true });
      expect(emailLogService.recordEvent).toHaveBeenCalledTimes(1);
      expect(emailLogService.recordEvent.mock.calls[0][0]).toMatchObject({
        providerMessageId: 'resend-msg-7',
        type: EmailEventType.OPENED,
        providerEventId: null,
      });
    });
  });
});
