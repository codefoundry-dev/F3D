# ADR-0011: Event-driven notifications, dual-channel, in-app real-time + email digest

**Status:** Accepted
**Date:** 2026-05-12

## Context

Many user stories trigger notifications: MR submitted → Procurement notified; RFQ response received → Procurement notified; PO change request raised → counterparty notified; delivery submitted → Procurement notified; invoice due-date approaching → Finance notified; low-stock threshold crossed → Warehouse Officer notified; approval requested → approver notified; dispute opened → counterparty notified; etc. Without a single coherent model, the system ends up with several inconsistent notification mechanisms competing for attention.

Two failure modes to avoid:
1. **Notification spam** — one PO with three deliveries in five minutes produces three emails, the user mutes notifications, important alerts get missed.
2. **Notification silence** — only the "important" stuff fires, the user discovers everything else by manually checking. Defeats the platform.

A third constraint from [ADR-0001]: notifications to unactivated vendors must work over email alone — there is no in-app for them.

## Decision

**Internal event bus.** Domain code publishes typed events (`PO.acknowledged`, `Invoice.received`, `Delivery.submitted`, etc.) to an in-process event bus. A single Notification module subscribes, resolves recipients from the event payload + role/project assignments, applies per-user preferences, and fans out to channels. It is not a separate service in v1 — just a clean module boundary.

**Two channels:** in-app and email. In-app is delivered in real time via SSE or WebSocket. Email batches in a 5-minute window per `(recipient, parent_document)` and sends one digest.

**Preferences matrix.** Per user, per event type, per channel. Defaults:
- Both channels: approval requests, OTP, overdue payment, due-date approaching, dispute opened, over-delivery needs approval, RFQ response received, change request raised, low-stock threshold crossed, delivery submitted on a PO you procured.
- In-app only: catalogue update, project assignment change, vendor profile update, chat message in a thread you participate in (because the chat thread itself surfaces it).
- Email only: applies to unactivated vendors regardless of event type.

**Always-immediate types** (bypass the email digest, irrespective of user preference):
- OTP emails (per ADR-0002)
- Overdue payment alerts
- Approval-request-overdue alerts

**Vendor notifications.** Activated vendors get parity with Contractor users (both channels). Unactivated vendors only receive email (there is no in-app to push to).

## Consequences

- **The event bus is the spine of cross-module communication.** Three-way match recomputation (ADR-0004), stock-and-bulk re-check (ADR-0007), and notifications all subscribe to the same domain events. This is intentional — one event source, many subscribers, no separate notification triggers.
- **Email digest is per-parent-document, not global.** "3 delivery reports on PO #123" digests; "1 RFQ response on RFQ #45" plus "1 delivery on PO #123" do *not* digest together — they're separate emails. This keeps each email about one thing.
- **Always-immediate types must be enforced server-side** — the user preference UI must not show a "delay this" toggle for them.
- **SSE/WebSocket choice is deferred** — both work; pick at implementation time based on framework support. The PRD names "real-time in-app" without binding the wire protocol.
- **Subscribers fan out via role + project assignment**, not via per-document watch lists. When a Procurement Officer is assigned to a Project, they automatically receive notifications for that project's RFQs, POs, deliveries, etc. Removing them from the project unsubscribes them. We deliberately avoid per-document follow/unfollow in v1 — it's a power-user feature with significant UI cost.
- **For unactivated vendors,** every notification produces an email. There is no batching of their notifications across documents — each is a distinct email — because they have no inbox to consolidate the view.
- **Notification telemetry** (sent / delivered / opened / clicked, per channel, per type) is needed from day one. Without it, "notifications work" is unfalsifiable and quietly fails for whole segments of users.

## Alternatives considered

- **In-app only, no email.** Rejected: violates email-first for vendors and removes the platform's only reach to off-platform users (overdue payment alerts, etc.).
- **Email only.** Rejected: defeats the live working surface a Procurement Officer expects, and the dashboards depend on real-time updates already.
- **All real-time, no digesting.** Rejected: produces notification spam, drives users to mute.
- **All digested, no real-time.** Rejected: defeats the live working surface; OTPs and overdue alerts can't tolerate delay.
- **Polling-based "what's new" lists, no push.** Rejected: incompatible with the continuous-match / live-dashboard design already chosen in earlier ADRs.
- **Per-document follow/unfollow.** Rejected for v1: high UX cost, low marginal value over role+project subscription.
