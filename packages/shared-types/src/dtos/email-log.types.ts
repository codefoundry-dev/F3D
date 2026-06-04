// Dependency-free email-log types (FOR-213) — no class-validator / @nestjs/swagger.
// Safe to ship to the browser via the client barrel; consumed by the RFQ/PO
// email-log tabs.

import type { EmailDeliveryStatus, EmailEventType } from '../enums/index';

/** A single Resend delivery event in an outbound email's timeline (FOR-213). */
export interface EmailEventResponse {
  id: string;
  type: EmailEventType;
  /** ISO-8601 timestamp of when the event occurred at the provider. */
  occurredAt: string;
}

/**
 * One outbound email shown in an RFQ or PO email log (FOR-213). `status` is the
 * rolled-up delivery state; the per-event timeline lives in `events`. When
 * `status` is `BOUNCED`, `bounceReason` carries the provider's reason so the UI
 * can surface a bounce alert to the sender.
 */
export interface EmailLogEntryResponse {
  id: string;
  /** Recipient address. */
  toEmail: string;
  subject: string;
  /** Template key, e.g. `rfq-received` or `po-issued`. */
  template: string;
  /** Rolled-up delivery status derived from the event stream. */
  status: EmailDeliveryStatus;
  /** ISO-8601 timestamps; null until the matching event arrives. */
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  bouncedAt: string | null;
  /** Count of distinct open events recorded. */
  openCount: number;
  /** Populated when the email bounced — surfaced as the bounce alert. */
  bounceReason: string | null;
  /** ISO-8601 timestamp of the most recent event (or the send itself). */
  lastEventAt: string | null;
  createdAt: string;
  /** Full event timeline, most-recent-first. */
  events: EmailEventResponse[];
}
