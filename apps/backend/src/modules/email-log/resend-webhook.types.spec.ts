import { EmailEventType } from '@prisma/client';

import { parseResendEvent } from './resend-webhook.types';

describe('parseResendEvent', () => {
  it('maps each known Resend event type', () => {
    const cases: Array<[string, EmailEventType]> = [
      ['email.sent', EmailEventType.SENT],
      ['email.delivered', EmailEventType.DELIVERED],
      ['email.delivery_delayed', EmailEventType.DELIVERY_DELAYED],
      ['email.opened', EmailEventType.OPENED],
      ['email.clicked', EmailEventType.CLICKED],
      ['email.bounced', EmailEventType.BOUNCED],
      ['email.complained', EmailEventType.COMPLAINED],
      ['email.failed', EmailEventType.FAILED],
    ];

    for (const [type, expected] of cases) {
      const parsed = parseResendEvent({ type, data: { email_id: 'em_1' } });
      expect(parsed?.type).toBe(expected);
      expect(parsed?.emailId).toBe('em_1');
    }
  });

  it('returns null for an unrecognised event type', () => {
    expect(parseResendEvent({ type: 'email.scheduled', data: { email_id: 'em_1' } })).toBeNull();
  });

  it('returns null when the message id is missing', () => {
    expect(parseResendEvent({ type: 'email.delivered', data: {} })).toBeNull();
  });

  it('returns null when the event type is absent', () => {
    expect(parseResendEvent({ data: { email_id: 'em_1' } })).toBeNull();
  });

  it('extracts bounce type and reason from the bounce object', () => {
    const parsed = parseResendEvent({
      type: 'email.bounced',
      data: {
        email_id: 'em_1',
        bounce: { type: 'Permanent', message: "The recipient's inbox is full." },
      },
    });

    expect(parsed?.type).toBe(EmailEventType.BOUNCED);
    expect(parsed?.bounceType).toBe('Permanent');
    expect(parsed?.bounceReason).toBe("The recipient's inbox is full.");
  });

  it('falls back to data.reason for the bounce reason', () => {
    const parsed = parseResendEvent({
      type: 'email.bounced',
      data: { email_id: 'em_1', reason: 'Mailbox does not exist' },
    });

    expect(parsed?.bounceReason).toBe('Mailbox does not exist');
    expect(parsed?.bounceType).toBeNull();
  });

  it('prefers data.created_at for occurredAt and falls back to the envelope', () => {
    const fromData = parseResendEvent({
      type: 'email.delivered',
      created_at: '2026-06-04T09:00:00.000Z',
      data: { email_id: 'em_1', created_at: '2026-06-04T10:00:00.000Z' },
    });
    expect(fromData?.occurredAt.toISOString()).toBe('2026-06-04T10:00:00.000Z');

    const fromEnvelope = parseResendEvent({
      type: 'email.delivered',
      created_at: '2026-06-04T09:00:00.000Z',
      data: { email_id: 'em_1' },
    });
    expect(fromEnvelope?.occurredAt.toISOString()).toBe('2026-06-04T09:00:00.000Z');
  });

  it('falls back to a valid date when the timestamp is unparseable', () => {
    const parsed = parseResendEvent({
      type: 'email.delivered',
      data: { email_id: 'em_1', created_at: 'not-a-date' },
    });

    expect(parsed?.occurredAt).toBeInstanceOf(Date);
    expect(Number.isNaN(parsed?.occurredAt.getTime())).toBe(false);
  });
});
