import { createHmac } from 'crypto';

import { UnauthorizedException, type RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

import { InvoiceIntakeService } from '../invoice-intake.service';
import { ResendInboundController } from '../resend-inbound.controller';
import {
  extractEmailAddress,
  extractRecipients,
  parseInboundEmail,
  type ResendInboundPayload,
} from '../resend-inbound.types';

const SECRET = `whsec_${Buffer.from('forethread-inbound-test-key').toString('base64')}`;
const SVIX_ID = 'msg_inbound';
const TIMESTAMP = String(Math.floor(Date.now() / 1000));

/** Re-implements the Svix signing the controller verifies, for building fixtures. */
function sign(id: string, timestamp: string, payload: string): string {
  const key = Buffer.from(SECRET.slice('whsec_'.length), 'base64');
  const sig = createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64');
  return `v1,${sig}`;
}

function reqWith(rawBody: string | undefined): RawBodyRequest<Request> {
  return {
    rawBody: rawBody === undefined ? undefined : Buffer.from(rawBody, 'utf8'),
  } as RawBodyRequest<Request>;
}

const buildConfig = (secrets: Record<string, string>): jest.Mocked<ConfigService> =>
  ({
    get: jest.fn((key: string, defaultValue?: unknown) => secrets[key] ?? defaultValue),
  }) as unknown as jest.Mocked<ConfigService>;

const receivedBody = (emailId = 'recv-1'): ResendInboundPayload => ({
  type: 'email.received',
  data: {
    email_id: emailId,
    from: 'Accounts <accounts@vendor.com>',
    to: ['invoices-abc123@in.test.com'],
    subject: 'Invoice 42',
  },
});

describe('ResendInboundController', () => {
  let intakeService: { processInboundEmail: jest.Mock };

  beforeEach(() => {
    intakeService = {
      processInboundEmail: jest.fn().mockResolvedValue({ handled: true, invoicesCreated: 1 }),
    };
  });

  const makeController = (secrets: Record<string, string>): ResendInboundController =>
    new ResendInboundController(
      buildConfig(secrets),
      intakeService as unknown as InvoiceIntakeService,
    );

  describe('with a configured signing secret', () => {
    let controller: ResendInboundController;

    beforeEach(() => {
      controller = makeController({ RESEND_INBOUND_WEBHOOK_SECRET: SECRET });
    });

    it('processes a correctly signed email.received webhook and acks', async () => {
      const body = receivedBody();
      const raw = JSON.stringify(body);
      const signature = sign(SVIX_ID, TIMESTAMP, raw);

      const result = await controller.handle(reqWith(raw), body, SVIX_ID, TIMESTAMP, signature);

      expect(result).toEqual({ received: true });
      expect(intakeService.processInboundEmail).toHaveBeenCalledWith({
        emailId: 'recv-1',
        from: 'accounts@vendor.com',
        to: ['invoices-abc123@in.test.com'],
        subject: 'Invoice 42',
      });
    });

    it('acks without processing when the event type is not email.received', async () => {
      const body: ResendInboundPayload = {
        type: 'email.delivered',
        data: { email_id: 'recv-2' },
      };
      const raw = JSON.stringify(body);
      const signature = sign(SVIX_ID, TIMESTAMP, raw);

      const result = await controller.handle(reqWith(raw), body, SVIX_ID, TIMESTAMP, signature);

      expect(result).toEqual({ received: true });
      expect(intakeService.processInboundEmail).not.toHaveBeenCalled();
    });

    it('acks without processing when the email id is missing', async () => {
      const body: ResendInboundPayload = { type: 'email.received', data: {} };
      const raw = JSON.stringify(body);
      const signature = sign(SVIX_ID, TIMESTAMP, raw);

      const result = await controller.handle(reqWith(raw), body, SVIX_ID, TIMESTAMP, signature);

      expect(result).toEqual({ received: true });
      expect(intakeService.processInboundEmail).not.toHaveBeenCalled();
    });

    it('rejects with 401 when the signature does not match the body', async () => {
      const body = receivedBody();
      const raw = JSON.stringify(body);
      const signature = sign(SVIX_ID, TIMESTAMP, raw);

      await expect(
        controller.handle(reqWith(`${raw} `), body, SVIX_ID, TIMESTAMP, signature),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(intakeService.processInboundEmail).not.toHaveBeenCalled();
    });

    it('rejects with 401 when the svix headers are missing', async () => {
      const body = receivedBody();
      const raw = JSON.stringify(body);

      await expect(
        controller.handle(reqWith(raw), body, undefined, undefined, undefined),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(intakeService.processInboundEmail).not.toHaveBeenCalled();
    });

    it('propagates processing failures so the provider retries', async () => {
      intakeService.processInboundEmail.mockRejectedValue(new Error('storage down'));
      const body = receivedBody();
      const raw = JSON.stringify(body);
      const signature = sign(SVIX_ID, TIMESTAMP, raw);

      await expect(
        controller.handle(reqWith(raw), body, SVIX_ID, TIMESTAMP, signature),
      ).rejects.toThrow('storage down');
    });
  });

  describe('secret fallback', () => {
    it('falls back to RESEND_WEBHOOK_SECRET when no inbound secret is set', async () => {
      const controller = makeController({ RESEND_WEBHOOK_SECRET: SECRET });
      const body = receivedBody();
      const raw = JSON.stringify(body);

      // Unsigned call must be rejected — the fallback secret is in force.
      await expect(
        controller.handle(reqWith(raw), body, undefined, undefined, undefined),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('skips verification when no secret is configured (dev / staging)', async () => {
      const controller = makeController({});
      const body = receivedBody();

      const result = await controller.handle(reqWith(undefined), body);

      expect(result).toEqual({ received: true });
      expect(intakeService.processInboundEmail).toHaveBeenCalledTimes(1);
    });
  });
});

describe('resend-inbound payload parsing', () => {
  describe('extractEmailAddress', () => {
    it('handles bare addresses, display names, and objects', () => {
      expect(extractEmailAddress('a@b.com')).toBe('a@b.com');
      expect(extractEmailAddress('Accounts <A@Vendor.com>')).toBe('a@vendor.com');
      expect(extractEmailAddress({ email: 'a@b.com' })).toBe('a@b.com');
      expect(extractEmailAddress('not-an-email')).toBeNull();
      expect(extractEmailAddress(42)).toBeNull();
      expect(extractEmailAddress(null)).toBeNull();
    });
  });

  describe('extractRecipients', () => {
    it('normalises strings, arrays, and object arrays', () => {
      expect(extractRecipients('a@b.com')).toEqual(['a@b.com']);
      expect(extractRecipients(['a@b.com', 'X <c@d.com>'])).toEqual(['a@b.com', 'c@d.com']);
      expect(extractRecipients([{ email: 'a@b.com' }, 'junk'])).toEqual(['a@b.com']);
      expect(extractRecipients(undefined)).toEqual([]);
    });
  });

  describe('parseInboundEmail', () => {
    it('accepts the id under data.id as well as data.email_id', () => {
      expect(parseInboundEmail({ type: 'email.received', data: { id: 'recv-9' } })?.emailId).toBe(
        'recv-9',
      );
    });

    it('returns null for other event types or missing ids', () => {
      expect(parseInboundEmail({ type: 'email.sent', data: { email_id: 'x' } })).toBeNull();
      expect(parseInboundEmail({ type: 'email.received', data: {} })).toBeNull();
      expect(parseInboundEmail({})).toBeNull();
    });
  });
});
