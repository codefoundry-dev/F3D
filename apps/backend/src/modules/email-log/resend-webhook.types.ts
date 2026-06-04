import { EmailEventType } from '@prisma/client';

/** Raw Resend webhook envelope (FOR-213). Only the fields we consume are typed. */
export interface ResendWebhookPayload {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    created_at?: string;
    reason?: string;
    bounce?: {
      type?: string;
      subType?: string;
      message?: string;
    };
  };
}

/** A Resend event normalised into the shape {@link EmailLogService.recordEvent} wants. */
export interface ParsedResendEvent {
  type: EmailEventType;
  emailId: string;
  occurredAt: Date;
  bounceType: string | null;
  bounceReason: string | null;
}

/** Resend event-type strings → our EmailEventType. Unmapped types are ignored. */
const EVENT_TYPE_MAP: Record<string, EmailEventType> = {
  'email.sent': EmailEventType.SENT,
  'email.delivered': EmailEventType.DELIVERED,
  'email.delivery_delayed': EmailEventType.DELIVERY_DELAYED,
  'email.opened': EmailEventType.OPENED,
  'email.clicked': EmailEventType.CLICKED,
  'email.bounced': EmailEventType.BOUNCED,
  'email.complained': EmailEventType.COMPLAINED,
  'email.failed': EmailEventType.FAILED,
};

/**
 * Normalise a Resend webhook payload (FOR-213). Returns null when the event type
 * is unrecognised or the message id is missing, so the caller can ack-and-skip
 * rather than error (Resend retries non-2xx responses).
 */
export function parseResendEvent(payload: ResendWebhookPayload): ParsedResendEvent | null {
  const type = payload.type ? EVENT_TYPE_MAP[payload.type] : undefined;
  const emailId = payload.data?.email_id;
  if (!type || !emailId) {
    return null;
  }

  const rawOccurredAt = payload.data?.created_at ?? payload.created_at;
  const parsed = rawOccurredAt ? new Date(rawOccurredAt) : new Date();
  const occurredAt = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  const bounce = payload.data?.bounce;
  const bounceType = bounce?.type ?? null;
  const bounceReason = bounce?.message ?? payload.data?.reason ?? null;

  return { type, emailId, occurredAt, bounceType, bounceReason };
}
