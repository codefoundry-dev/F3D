# ADR-0014: PDF generation uses `pdfkit`; PDF viewing uses `react-pdf` (pdf.js)

**Status:** Accepted **Date:** 2026-05-21

## Context

Forethread has two distinct PDF concerns:

1. **Server-side generation.** Forethread produces PDFs we send out: POs, invoices, company
   profiles, exported lists. These are templated documents with deterministic layout, served as
   Resend attachments or download URLs.
2. **Browser-side viewing.** Forethread receives PDFs from users: vendor-uploaded quotes,
   contractor-uploaded BOMs, vendor-uploaded invoices. Reviewers need to see the original
   side-by-side with the extracted fields (ADR-0005 Tier C: quotes, invoices). Native browser PDF
   viewers (`<iframe src="...pdf">`) work, but they're inconsistent across Chrome / Safari / mobile
   and we can't render side-by-side with our review UI in a controllable way.

PDF _parsing_ — turning a PDF into structured data — is **not** in scope for this ADR. That is
handled by Gemini multimodal (ADR-0005, wired up in FOR-190). This ADR is about _rendering_: making
bytes-on-disk into something humans can read.

## Decision

### Server-side generation: `pdfkit`

Already in use under `apps/backend/src/modules/export/pdf-export.service.ts`. We keep it.

- Library: `pdfkit@^0.17`
- License: MIT
- Approach: hand-rolled templates in service code. `PdfExportOptions` and `InvoiceExportOptions`
  shapes already exist; new document types extend the same pattern.
- Output: streams to a `Buffer`, handed to `StorageService` for S3 upload or to Resend as an
  attachment.

### Browser-side viewing: `react-pdf` (which wraps `pdfjs-dist`)

For in-app PDF viewing alongside extraction review forms.

- Library: `react-pdf` (npm: `react-pdf`, Wojciech Maj) — a thin React wrapper around Mozilla's
  `pdfjs-dist`
- License: MIT
- Where it lives: a `<PdfViewer>` component in `packages/ui-components` that renders one page at a
  time on a `<canvas>`, with optional zoom controls. Lazy-loaded (`React.lazy` + `Suspense`) so the
  ~600KB gzip cost only lands on routes that view PDFs.
- Worker hosting: the pdfjs worker (`pdf.worker.mjs`) is shipped from the same origin to avoid CORS
  hassles. Vite's `?url` import handles this.

> Beware the naming clash: there is also a package called **`@react-pdf/renderer`** which is for
> _generating_ PDFs in React (different author, different purpose). We are not using
> `@react-pdf/renderer`.

## Consequences

- One server-side library, one client-side library. Cleaner mental model than mixing several.
- `pdfkit` is mature and easy to template. Limitation: pure imperative API — no HTML-to-PDF. If we
  ever need to render a complex marketing-style PO or invoice template that designers iterate on
  visually, we should revisit (Puppeteer or `@react-pdf/renderer` server-side).
- `react-pdf` renders to `<canvas>`. Selection / copy-paste of text from a viewed PDF works but is
  character-positioned, not perfect. That's the standard pdf.js trade-off and is acceptable for our
  use case (review, not edit).
- Worker hosting via Vite asset URLs ties the viewer to our build pipeline; not a problem given we
  control the shell (ADR-0013).
- The Field PWA's offline mode (ADR-0008) needs to consider that pdfjs worker assets are cacheable
  but ~1MB. We will pre-cache them in the service worker manifest only on devices where a Foreman is
  likely to view delivery PDFs offline; otherwise on-demand load is fine.

## Alternatives considered

### Server-side

- **`pdf-lib`.** Modern, ergonomic, can read+modify existing PDFs. Considered. Rejected for new work
  because `pdfkit` is already entrenched in the export service and works for our templates —
  switching now is churn without a concrete payoff. Worth revisiting if we ever need to
  stamp/annotate existing uploaded PDFs.
- **`puppeteer` (HTML→PDF via headless Chromium).** Rejected: ~300MB on disk, slow cold start,
  runtime-fragile, adds an opaque Chromium dependency to backend deploys.
- **`pdfmake`.** Considered. Declarative JSON document model is nice; the trade-off is less
  flexibility than pdfkit's imperative API and another templating dialect to learn. Not worth
  swapping for.

### Client-side

- **Native browser viewer (`<iframe src={pdfUrl}>` or `<embed>`).** Rejected as the primary path.
  Inconsistent UX across Chrome, Firefox, Safari, mobile webviews; can't render side-by-side with
  our review form; can't be styled. Still acceptable as a _download_ fallback ("Open in browser") —
  that does not require `react-pdf`.
- **`pdfjs-dist` directly (no React wrapper).** Works but requires hand-writing the integration glue
  every time (page navigation, render-on-viewport, error handling). `react-pdf` is a thin wrapper
  that doesn't hide pdfjs — escape hatches remain — but eliminates ~150 lines of boilerplate per
  consumer.
- **`@react-pdf/renderer` for viewing.** Misuse of the library. `@react-pdf/renderer` _produces_
  PDFs from React components; it does not render existing PDF files.
- **A SaaS PDF viewer (PDFTron, Adobe Embed).** Rejected: adds vendor risk, license cost, and an
  external runtime for what amounts to "show the page in a canvas."
