import type { EmailEventType, Prisma } from '@prisma/client';

/**
 * Linkage + attribution context handed to {@link EmailLogService.recordOutbound}
 * when a transactional email is dispatched (FOR-213). The notification layer adds
 * the recipient, subject, template, and provider message id on top of this.
 */
export interface EmailLogContext {
  companyId: string;
  rfqId?: string;
  purchaseOrderId?: string;
  /** Best-effort attribution: the user who triggered the send. */
  sentByUserId?: string;
}

/** Full payload for recording an outbound email (FOR-213). */
export interface RecordOutboundInput extends EmailLogContext {
  template: string;
  toEmail: string;
  subject: string;
  provider: 'RESEND' | 'SMTP';
  /** Resend message id; null for the SMTP fallback (no webhooks). */
  providerMessageId?: string | null;
}

/**
 * Payload for recording a send that the provider rejected (FOR-213). A failed
 * send produces no provider message id and never receives delivery webhooks, so
 * we persist a terminal FAILED row up front — otherwise a dropped email simply
 * never appears on the log and looks like it was "never sent".
 */
export interface RecordFailedInput extends EmailLogContext {
  template: string;
  toEmail: string;
  subject: string;
  provider: 'RESEND' | 'SMTP';
  /** Human-readable failure reason (provider code + message), surfaced on the tab. */
  reason?: string | null;
}

/** A delivery event parsed from a Resend webhook, ready to be recorded (FOR-213). */
export interface RecordEventInput {
  /** Resend message id (`data.email_id`) used to locate the outbound message. */
  providerMessageId: string;
  type: EmailEventType;
  occurredAt: Date;
  /** Svix message id (`svix-id`) when present, for traceability + idempotency. */
  providerEventId?: string | null;
  bounceType?: string | null;
  bounceReason?: string | null;
  payload?: Prisma.InputJsonValue;
}
