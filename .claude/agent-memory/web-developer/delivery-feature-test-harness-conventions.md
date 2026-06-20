---
name: delivery-feature-test-harness-conventions
description: Test + screenshot-harness conventions specific to the Epic 6 deliveries feature (apps/web)
metadata:
  type: feedback
---

Conventions for testing/screenshotting the Epic 6 deliveries feature in apps/web.

**Why:** Avoid re-deriving the mock shape + harness wiring each session; one gotcha
(dynamic-path `vi.mock`) cost a debug cycle.

**How to apply:**

- **Vitest mock-everything style** (matches the pre-existing delivery specs):
  `vi.hoisted` for fns, mock `react-router-dom` (return `useParams`/`useNavigate`),
  `@tanstack/react-query` (return a stub `useQuery`), `@forethread/api-client`,
  `@forethread/i18n` (t echoes the key; interpolate `{{count}}` so summary
  assertions read), `@forethread/ui-components` (Button strips
  isLoading/variant/size/leftIcon/rightIcon before spreading), and each `*.svg?react`
  icon. Stub the heavy child (e.g. `PortalLineItem`) to expose just the buttons you
  need to drive — test the child's logic separately as a pure module.
- **GOTCHA — `vi.mock` with a template-literal path inside a `.forEach` FAILS**:
  `['a','b'].forEach(icon => vi.mock(\`...${icon}...\`, ...))` → `ReferenceError:
  icon is not defined`, because vitest hoists every `vi.mock` to the top of the file,
  out of the closure where `icon` is bound. Write each icon mock as a separate
  literal `vi.mock('.../paperclip.svg?react', ...)` call.
- **Run** with `npx vitest run --pool=threads <path>` (fork pool stalls when a dev
  server is up; threads avoids it — confirmed again here).
- **Screenshot harness** for a PUBLIC (guest) page is simpler than the authed ones:
  no auth seeding needed. Just Vite dev (`MSYS_NO_PATHCONV=1 VITE_API_URL=/v1 npx
  vite --port <p> --strictPort`) + Playwright `page.route('**/v1/**', ...)` mocking
  the portal endpoints (`/v1/delivery-portal/{po,identify,verify,submit,finalize}`
  + `/lines|/attachments`), all returning `{data:...}`. Use a MOBILE viewport
  (390x844, deviceScaleFactor 2) for the QR portal. Pattern in
  `.tmp/figma-delivery/shot_portal.mjs`. A 403 from the PO query replaces the WHOLE
  page with the error state (the error check precedes the step switch) — so don't
  wait for a step selector after forcing a 403.

See [[delivery-public-qr-portal-epic6c]].
