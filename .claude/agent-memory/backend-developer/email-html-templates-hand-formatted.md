---
name: email-html-templates-hand-formatted
description: Email HTML templates (notifications/templates/*.html) are hand-formatted; do NOT run prettier --write on them — it reformats the whole file
metadata:
  type: feedback
---

The email HTML templates under `apps/backend/src/modules/notifications/templates/` (e.g. `layout.html`) are hand-formatted with single-line inline `style="..."` attributes, and the repo's CI does NOT run prettier over them.

**Why:** Running `prettier --write` on `layout.html` reformats the ENTIRE file — it lowercases `<!DOCTYPE>`, explodes every inline style onto multiple lines, and newline-wraps all attributes — producing massive churn unrelated to your change. The committed file is not prettier-compliant under the repo config, so CI clearly skips prettier for these templates (only `.ts` is enforced via eslint `--max-warnings 0` + prettier). A `prettier --check` of a copy OUTSIDE the repo lies, because it falls back to prettier defaults instead of the repo config.

**How to apply:** When editing an email template, hand-edit in the existing single-line style and match surrounding indentation. Do NOT prettier-format it. Only run prettier on the `.ts`/`.spec.ts` files you touch. To render-test a template, compile the real `.html` with real Handlebars in a standalone spec (the `email.service.spec.ts` globally mocks `handlebars`/`fs`, so a separate spec file is needed). See [[backend-coverage-90-gate]].
