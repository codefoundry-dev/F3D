# ADR-0008: Field PWA — append-only events, project-scoped offline cache, tiered media upload

**Status:** Accepted
**Date:** 2026-05-12

## Context

The Field epic has 18 user stories and is explicitly mobile-first, offline-first, GPS-aware, camera-aware. The naive design — let users edit the same record from multiple devices, sync best-effort, resolve conflicts manually — is the failure mode of every mobile-first SaaS in this category. Once two foremen are editing the same delivery report from two phones over patchy 3G, the conflict-resolution UX becomes the product.

Three independent choices shape this:
1. **What works offline?** Write-only data collection, or full project-scoped read+write?
2. **How do conflicts resolve?** Last-write-wins, first-write-wins, field-merge, or eliminate the problem?
3. **Media pipeline?** Upload-immediately vs upload-on-Wi-Fi vs tiered.

## Decision

**Append-only event model.** All field actions are events: a delivery report, a material request, a field purchase report, an in-app note, a release confirmation. Multiple events can attach to the same parent (PO, MR, warehouse) independently. There is no singleton "the delivery report" — only a stream of delivery events that aggregate during three-way match. This eliminates the entire concurrent-edit conflict class.

**15-minute edit window — on-device, pre-sync.** A field event can be amended on the device that created it for 15 minutes after submission. Edits happen entirely on-device, before the event syncs. After sync (or 15 minutes, whichever first), the event is immutable. Different devices cannot edit each other's events.

**Server-side deduplication via idempotency key.** Each event carries a client-generated UUID. The server rejects duplicate submissions of the same UUID. This handles the "phone retried sync and the server already accepted it" case cleanly.

**Project-scoped offline cache.** On first online load, the PWA pre-downloads: the user's active projects, those projects' open POs, pending deliveries, recently-used catalogue items, and the user's accessible warehouse inventory snapshot. Reads operate on the cache while offline. The cache refreshes opportunistically when online.

**Tiered media upload.** Photos and GPS are captured with the event. A compressed thumbnail (~100KB target) uploads as soon as any network is present, so the server has *something* on every event. The full-resolution original uploads as a background job that prefers Wi-Fi and resumes across app launches. Originals are retained on-device until the server confirms receipt.

**GPS is automatic, not user-entered.** No "type the address" affordance. If GPS is unavailable (denied permission, indoors), the event records `gps: null` and the server flags it for the Contractor's awareness — it does not block submission.

## Consequences

- **No edit-existing-record API on field events.** Server endpoints accept *new* events tied to a parent; they do not accept updates to existing event rows. Cleanup tools (admin force-correct) live elsewhere with audit logging.
- **The three-way match aggregator** must sum across the event stream per PO, not read a single delivery-report row. ADR-0004's "continuous match" already implies this, but it's worth flagging.
- **Pre-download size** is bounded by project scope but not trivially small. Foremen on many projects with long catalogues could hit ~tens of MB. We accept this; mobile users on first install run it on Wi-Fi.
- **The 15-min editable-on-device window** is implemented as: event held in a local pending queue until the timer expires *or* the user explicitly hits "send now." This makes the trade-off (immutable post-sync) feel deliberate to the user, not surprising.
- **Idempotency keys must be opaque to humans** and rotated only if the user explicitly creates a *new* event (e.g. "duplicate this report" UI). Otherwise a user re-tapping submit on the same draft must produce the same key.
- **Conflict UX** does still exist for one case: the server-side detection of "two delivery reports from two phones for the same PO line at the same minute" is *not* an error — it's a normal aggregate. The system never asks "which one wins?" because both are kept and both contribute to the totals.
- **What this rules out:** Foreman A starts a delivery report, Foreman B continues it from his phone. That collaborative-edit pattern does not exist in the system; if you want to delegate, you cancel and the other person starts fresh. We judge this acceptable for the field workflow.

## Alternatives considered

- **Last-write-wins on edit.** Rejected: silently loses data in exactly the contexts (damage photos, qty corrections) where data loss is most expensive.
- **Field-level merge with manual conflict UI.** Rejected: the UI for "two phones edited the same delivery line, here's the diff, which wins?" is unteachable to field workers on a 5-inch screen.
- **Write-only offline (no cached reads).** Rejected: forces the user back to paper for "what was on this PO again?" — exactly the workflow being replaced.
- **Upload full-res photos immediately.** Rejected: blocks the next action on a multi-MB upload over 3G, defeats the mobile-first claim.
- **Manual GPS entry as fallback.** Rejected: data quality collapses; the platform's "GPS-stamped evidence" claim is undermined.

## Amendment — Release 1 scope (2026-05-19)

The original "15-minute on-device edit window" is **replaced for Release 1** with a simpler **edit-until-sync** model:

- A field event is editable on the device that created it **until the first successful sync to the server**. After that ack, the event is immutable on every device — including the originating device.
- There is no 15-minute timer. Long-offline scenarios (24h with no signal) leave the event editable for the duration of the offline period; sync occurs the moment connectivity returns.
- Idempotency keys, append-only event model, tiered media upload (thumbnail-first, full-res background), and GPS-only capture all remain unchanged.

### Why edit-until-sync over the 15-minute timer

- **Simpler client state.** No countdown to track, no "your edit window expired while you were in a tunnel" surprise.
- **Aligns with the user's mental model.** "I haven't sent it yet, so I can still fix it" is what foremen already think.
- **No silent data loss.** A typo caught 90 seconds after offline submission is still editable; the original timer would have locked the edit at 15 minutes regardless of whether the event had reached the server.

### Trade-offs accepted

- A foreman on a long offline run could accumulate hours of editable events. We judge this acceptable because (a) the device that holds them is the same person's, and (b) sync usually happens within the same shift.
- "Send now" is still a per-event affordance — foremen who want immutability immediately can opt in.

The append-only event model, server-side dedupe, tiered media, and GPS-only rules are unchanged. The amendment touches only the edit-window semantics.
