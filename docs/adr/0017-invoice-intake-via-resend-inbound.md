# ADR-0017: Invoice email intake via Resend Inbound

Date: 2026-07-28
Status: Accepted
Relates to: ADR-0010 (threads with email-in), FOR-290

## Context

Phase 2 invoice reconciliation (FOR-290) needs invoices to arrive two ways:
manual upload by the buyer team, and vendors emailing invoices to a company
inbox. ADR-0010 designed reply-address email-in for message threads and left
the inbound provider open ("SES inbound + Lambda / Mailgun routes / Postmark
inbound"), noting a future ADR would pick one. This is that ADR, decided first
for the invoice-intake use case.

## Decision

Use **Resend Inbound** as the inbound email provider.

- A dedicated receiving domain (`INVOICE_INBOUND_DOMAIN`, e.g.
  `in.forethread.com`) gets Resend MX records. Resend receives any address on
  the domain (catch-all), so per-company addresses need no per-address
  provisioning.
- Each company gets a lazily generated, unguessable inbox key
  (`Company.invoiceInboxKey`, 16 hex chars) forming its intake address:
  `invoices-<key>@<domain>`. The address is surfaced (and generated on first
  view) by `GET /v1/invoices/intake-address`.
- Resend fires an `email.received` webhook (metadata only) at
  `POST /v1/webhooks/resend-inbound`, Svix-verified with
  `RESEND_INBOUND_WEBHOOK_SECRET` — the same verification scheme as the
  existing delivery-event receiver (FOR-213), whose `verifyResendSignature`
  implementation is reused.
- Attachments are fetched on demand from the Resend receiving API
  (`GET /emails/receiving/:id/attachments` → short-lived `download_url`s),
  filtered to the doc-intelligence-supported types (PDF/PNG/JPEG/WEBP, ≤10 MB,
  non-inline), stored in S3 under `invoice-documents/`, and turned into
  Pending `Invoice` rows: one per PDF, images grouped as one.
- Idempotency: the provider email id is stored on `Invoice.intakeEmailId`;
  webhook retries that find it are acked without re-processing. A delivery
  where nothing could be persisted returns 5xx so Resend retries it.

## Why Resend (vs SES / Mailgun / Postmark)

- Resend is already the platform's outbound transport with API key, Svix
  webhook verification, and event plumbing in place — inbound adds a webhook
  endpoint and MX records, no new vendor, credentials, or Lambda infrastructure.
- SES inbound would drag in S3/Lambda/SNS wiring and raw MIME parsing;
  Mailgun/Postmark would add a second email vendor for one feature.
- The metadata-only webhook + fetch-attachments API suits our flow: the
  webhook stays fast and small, and attachment download happens inside the
  backend where S3 credentials live.

## Consequences

- Vendor invoice emails only work once `INVOICE_INBOUND_DOMAIN` has MX records
  verified in Resend and the webhook endpoint + secret are configured per
  environment. With the env var unset the feature degrades cleanly (UI hides
  the address; webhook ignores traffic).
- ADR-0010's thread reply addresses can adopt the same receiving domain and
  webhook pattern later; nothing here precludes it.
- The intake address is a capability URL in email form: anyone who knows it
  can file an invoice into the company's review queue. Keys are unguessable
  and per-company, review gates everything downstream, and a leaked key can be
  rotated by clearing `invoiceInboxKey` (a regeneration endpoint can come
  later if needed).
